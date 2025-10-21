"use client";

import Link from "next/link";

import { useTranslations } from "@/i18n/context";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { TradeEntry } from "@/types/trade";

import { HistoryTable } from "./history-table";

interface FiltersState {
  symbol: string;
  exchange: string;
  direction: string;
  fromDate: string;
  toDate: string;
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  showingStart: number;
  showingEnd: number;
  prevQuery: string;
  nextQuery: string;
}

interface SummaryState {
  totalTrades: number;
  sumExpectedProfit: number;
  sumAllowedLoss: number;
  sumMargin: number;
  sumPosition: number;
  winCount: number;
  winRate: number;
  rangeStart: string | null;
  rangeEnd: string | null;
}

interface HistoryContentProps {
  trades: TradeEntry[];
  filters: FiltersState;
  pagination: PaginationState;
  summary: SummaryState;
}

export function HistoryContent({ trades, filters, pagination, summary }: HistoryContentProps) {
  const t = useTranslations();

  const hasTrades = trades.length > 0;

  const rangeStartText = summary.rangeStart ? formatDateTime(summary.rangeStart) : "-";
  const rangeEndText = summary.rangeEnd ? formatDateTime(summary.rangeEnd) : "-";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-sky-400">
              {t("brand")}
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              {t("history.title")}
            </h1>
            <p className="text-sm text-slate-400">{t("history.subtitle")}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
          >
            {t("history.back")}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-200 shadow-lg shadow-black/20 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("history.summary.totalTrades")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {summary.totalTrades.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">{t("history.summary.cardHint")}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("history.summary.winRate")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {summary.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">
              {t("history.summary.winLoss", {
                wins: summary.winCount.toLocaleString(),
                losses: Math.max(summary.totalTrades - summary.winCount, 0).toLocaleString(),
              })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("history.summary.totalExpected")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {formatNumber(summary.sumExpectedProfit)} USD
            </p>
            <p className="text-xs text-slate-500">{t("results.expectedProfit")}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("history.summary.totalLoss")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-300">
              {formatNumber(summary.sumAllowedLoss)} USD
            </p>
            <p className="text-xs text-slate-500">{t("results.allowedLoss")}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 sm:col-span-2 lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {t("history.summary.totalMargin")}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(summary.sumMargin)} USD
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {t("history.summary.totalPosition")}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(summary.sumPosition)} USD
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t("history.summary.range", { start: rangeStartText, end: rangeEndText })}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
          <form className="grid gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto]" method="get">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>{t("history.filters.symbol")}</span>
              <input
                name="symbol"
                defaultValue={filters.symbol}
                placeholder="BTCUSDT"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>{t("history.filters.exchange")}</span>
              <input
                name="exchange"
                defaultValue={filters.exchange}
                placeholder="binance"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>{t("history.filters.direction")}</span>
              <select
                name="direction"
                defaultValue={filters.direction}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">{t("history.table.modal.outcomeNone")}</option>
                <option value="Long">{t("direction.long")}</option>
                <option value="Short">{t("direction.short")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>{t("history.filters.dateStart")}</span>
              <input
                name="fromDate"
                type="date"
                defaultValue={filters.fromDate}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              <span>{t("history.filters.dateEnd")}</span>
              <input
                name="toDate"
                type="date"
                defaultValue={filters.toDate}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="h-fit rounded-lg border border-sky-500 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/30"
              >
                {t("history.filters.apply")}
              </button>
              <Link
                href="/history"
                className="h-fit rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                {t("history.filters.reset")}
              </Link>
            </div>
          </form>
        </section>

        {!hasTrades ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            {t("history.empty")}
          </div>
        ) : (
          <HistoryTable trades={trades} />
        )}

        <footer className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {pagination.totalCount === 0 ? (
              t("history.pagination.none")
            ) : (
              <span>
                {t("history.pagination.showing", {
                  total: pagination.totalCount.toLocaleString(),
                  start: pagination.showingStart.toLocaleString(),
                  end: pagination.showingEnd.toLocaleString(),
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/history?${pagination.prevQuery}`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                pagination.currentPage <= 1
                  ? "cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-500"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
              aria-disabled={pagination.currentPage <= 1}
            >
              {t("history.pagination.prev")}
            </Link>
            <span className="text-xs font-medium text-slate-400">
              {t("history.pagination.page", {
                current: pagination.currentPage,
                total: pagination.totalPages,
              })}
            </span>
            <Link
              href={`/history?${pagination.nextQuery}`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                pagination.currentPage >= pagination.totalPages
                  ? "cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-500"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
              aria-disabled={pagination.currentPage >= pagination.totalPages}
            >
              {t("history.pagination.next")}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
