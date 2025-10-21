import { redirect } from "next/navigation";

import { HistoryContent } from "@/components/history/history-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TradeEntry } from "@/types/trade";

const PAGE_SIZE = 20;

const ensureSingleValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
};

type ResolvedSearchParams = Record<string, string | string[] | undefined>;

interface HistoryPageProps {
  searchParams?: Promise<ResolvedSearchParams | undefined>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/?redirectedFrom=history");
  }

  const resolvedParams = (await searchParams) ?? {};
  const pageParam = ensureSingleValue(resolvedParams.page);
  const symbolFilter = ensureSingleValue(resolvedParams.symbol)?.trim() ?? "";
  const exchangeFilter = ensureSingleValue(resolvedParams.exchange)?.trim() ?? "";
  const directionFilter = ensureSingleValue(resolvedParams.direction)?.trim() ?? "";
  const fromDateFilter = ensureSingleValue(resolvedParams.fromDate)?.trim() ?? "";
  const toDateFilter = ensureSingleValue(resolvedParams.toDate)?.trim() ?? "";

  const pageFromParam = Number.parseInt(pageParam ?? "1", 10);
  const currentPage = Number.isFinite(pageFromParam) && pageFromParam > 0 ? pageFromParam : 1;
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("trade_entries")
    .select("*", { count: "exact" })
    .eq("user_id", session.user.id);

  if (symbolFilter) {
    query = query.ilike("symbol", `%${symbolFilter}%`);
  }

  if (exchangeFilter) {
    query = query.ilike("exchange", `%${exchangeFilter}%`);
  }

  if (directionFilter && (directionFilter === "Long" || directionFilter === "Short")) {
    query = query.eq("direction", directionFilter);
  }

  if (fromDateFilter) {
    const fromDate = new Date(fromDateFilter);
    if (!Number.isNaN(fromDate.getTime())) {
      query = query.gte("created_at", fromDate.toISOString());
    }
  }

  if (toDateFilter) {
    const toDate = new Date(toDateFilter);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", toDate.toISOString());
    }
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch trade history: ${error.message}`);
  }

  const trades = (data ?? []) as TradeEntry[];
  const totalCount = count ?? trades.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const summaryQuery = supabase
    .from("trade_entries")
    .select(
      `count:count(*),
       sum_expected_profit:sum(expected_profit),
       sum_allowed_loss:sum(allowed_loss),
       sum_margin:sum(margin_capital),
       sum_position:sum(max_position_size),
       win_count:sum(exit_outcome = 'take_profit')`
    )
    .eq("user_id", session.user.id);

  if (symbolFilter) summaryQuery.ilike("symbol", `%${symbolFilter}%`);
  if (exchangeFilter) summaryQuery.ilike("exchange", `%${exchangeFilter}%`);
  if (directionFilter && (directionFilter === "Long" || directionFilter === "Short")) {
    summaryQuery.eq("direction", directionFilter);
  }
  if (fromDateFilter) {
    const fromDate = new Date(fromDateFilter);
    if (!Number.isNaN(fromDate.getTime())) {
      summaryQuery.gte("created_at", fromDate.toISOString());
    }
  }
  if (toDateFilter) {
    const toDate = new Date(toDateFilter);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      summaryQuery.lte("created_at", toDate.toISOString());
    }
  }

  const { data: summaryDataRaw } = await summaryQuery.single();
  const summaryData = (summaryDataRaw ?? {}) as Record<string, unknown>;

  const totalTrades = Number(summaryData.count ?? 0);
  const sumExpectedProfit = Number(summaryData.sum_expected_profit ?? 0);
  const sumAllowedLoss = Number(summaryData.sum_allowed_loss ?? 0);
  const sumMargin = Number(summaryData.sum_margin ?? 0);
  const sumPosition = Number(summaryData.sum_position ?? 0);
  const winCount = Number(summaryData.win_count ?? 0);
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const baseParams = new URLSearchParams();
  if (symbolFilter) baseParams.set("symbol", symbolFilter);
  if (exchangeFilter) baseParams.set("exchange", exchangeFilter);
  if (directionFilter) baseParams.set("direction", directionFilter);
  if (fromDateFilter) baseParams.set("fromDate", fromDateFilter);
  if (toDateFilter) baseParams.set("toDate", toDateFilter);

  const prevParams = new URLSearchParams(baseParams);
  prevParams.set("page", String(Math.max(1, currentPage - 1)));

  const nextParams = new URLSearchParams(baseParams);
  nextParams.set("page", String(currentPage + 1));

  const showingStart = totalCount === 0 ? 0 : from + 1;
  const showingEnd = from + trades.length;

  return (
    <HistoryContent
      trades={trades}
      filters={{
        symbol: symbolFilter,
        exchange: exchangeFilter,
        direction: directionFilter,
        fromDate: fromDateFilter,
        toDate: toDateFilter,
      }}
      pagination={{
        currentPage,
        totalPages,
        totalCount,
        showingStart,
        showingEnd,
        prevQuery: prevParams.toString(),
        nextQuery: nextParams.toString(),
      }}
      summary={{
        totalTrades,
        sumExpectedProfit,
        sumAllowedLoss,
        sumMargin,
        sumPosition,
        winCount,
        winRate,
        rangeStart: trades.at(-1)?.created_at ?? null,
        rangeEnd: trades.at(0)?.created_at ?? null,
      }}
    />
  );
}
