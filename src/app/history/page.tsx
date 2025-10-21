import Link from "next/link";
import { redirect } from "next/navigation";

import { HistoryTable } from "@/components/history/history-table";
import { formatDateTime, formatNumber } from "@/lib/format";
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
    throw new Error(`거래 내역을 불러오지 못했습니다: ${error.message}`);
  }

  const trades = (data ?? []) as TradeEntry[];
  const totalCount = count ?? trades.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasTrades = trades.length > 0;

  const summaryQuery = supabase
    .from("trade_entries")
    .select(
      `count:count(*),
       sum_expected_profit:sum(expected_profit),
       sum_allowed_loss:sum(allowed_loss),
       sum_margin:sum(margin_capital),
       sum_position:sum(max_position_size),
       win_count:sum(exit_outcome = 'take_profit'),
       loss_count:sum(exit_outcome = 'stop_loss')`
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-sky-400">
              lvcheck
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              거래 내역 아카이브
            </h1>
            <p className="text-sm text-slate-400">
              저장한 레버리지 계산을 요약해서 확인합니다. 최신 항목이 상단에 표시됩니다.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
          >
            ← 계산기로 돌아가기
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-200 shadow-lg shadow-black/20 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">총 거래</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {totalTrades.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">필터 조건에 해당하는 거래 수</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">승률</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">
              {winCount.toLocaleString()}승 / {(totalTrades - winCount).toLocaleString()}패
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">누적 예상 수익</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {formatNumber(sumExpectedProfit)} USD
            </p>
            <p className="text-xs text-slate-500">익절 표적 기준 총합</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">누적 허용 손실</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300">
              {formatNumber(sumAllowedLoss)} USD
            </p>
            <p className="text-xs text-slate-500">리스크 한도 총합</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 sm:col-span-2 lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">총 투자금</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(sumMargin)} USD
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">총 포지션 규모</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(sumPosition)} USD
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
          <form className="grid gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto]" method="get">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>심볼</span>
              <input
                name="symbol"
                defaultValue={symbolFilter}
                placeholder="예: BTCUSDT"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>거래소</span>
              <input
                name="exchange"
                defaultValue={exchangeFilter}
                placeholder="예: binance"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>방향</span>
              <select
                name="direction"
                defaultValue={directionFilter || ""}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">전체</option>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>저장일 (시작)</span>
              <input
                name="fromDate"
                defaultValue={fromDateFilter}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>저장일 (종료)</span>
              <input
                name="toDate"
                defaultValue={toDateFilter}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                type="date"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="h-fit rounded-lg border border-sky-500 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/30"
              >
                필터 적용
              </button>
              <Link
                href="/history"
                className="h-fit rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                초기화
              </Link>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            {`조회 기간: ${formatDateTime(trades.at(-1)?.created_at ?? null)} ~ ${formatDateTime(trades.at(0)?.created_at ?? null)}`}
          </p>
        </section>

        {!hasTrades ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            {"아직 저장된 거래 기록이 없습니다. 계산기에서 \"거래 기록으로 저장\" 버튼을 눌러 신규 항목을 추가하세요."}
          </div>
        ) : (
          <HistoryTable trades={trades} />
        )}

        <footer className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalCount === 0 ? (
              "기록이 없습니다."
            ) : (
              <span>
                {`총 ${totalCount.toLocaleString()}건 중 ${showingStart.toLocaleString()}-${showingEnd.toLocaleString()} 표시`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/history?${prevParams.toString()}`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                currentPage <= 1
                  ? "cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-500"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
              aria-disabled={currentPage <= 1}
            >
              이전
            </Link>
            <span className="text-xs font-medium text-slate-400">
              {currentPage} / {totalPages}
            </span>
            <Link
              href={`/history?${nextParams.toString()}`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                currentPage >= totalPages
                  ? "cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-500"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
              aria-disabled={currentPage >= totalPages}
            >
              다음
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
