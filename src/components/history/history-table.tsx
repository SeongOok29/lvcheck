"use client";

import { useMemo, useState } from "react";

import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { TradeEntry } from "@/types/trade";

interface HistoryTableProps {
  trades: TradeEntry[];
}

type TableRow = TradeEntry & { index: number };

const csvHeaders: Array<keyof TradeEntry | "index"> = [
  "index",
  "created_at",
  "exchange",
  "symbol",
  "direction",
  "entry_price",
  "stop_price",
  "take_profit",
  "exposure_mode",
  "risk_mode",
  "margin_capital",
  "position_size",
  "risk_value",
  "price_delta",
  "price_delta_pct",
  "theoretical_max_leverage",
  "max_leverage",
  "max_position_size",
  "allowed_loss",
  "loss_at_stop",
  "risk_percent_of_capital",
  "risk_reward_ratio",
  "expected_profit",
  "expected_return_pct",
  "notes",
];

const makeCsvRow = (row: TableRow) =>
  csvHeaders
    .map((header) => {
      const value = header === "index" ? row.index + 1 : row[header as keyof TradeEntry];
      if (value === null || value === undefined) {
        return "";
      }
      const valueString = String(value).replace(/"/g, '""');
      return /[",\n]/.test(valueString) ? `"${valueString}"` : valueString;
    })
    .join(",");

export function HistoryTable({ trades }: HistoryTableProps) {
  const [selectedTrade, setSelectedTrade] = useState<TableRow | null>(null);

  const tableRows = useMemo<TableRow[]>(
    () => trades.map((trade, index) => ({ ...trade, index })),
    [trades],
  );

  const csvContent = useMemo(() => {
    if (!tableRows.length) return "";
    const headerRow = csvHeaders.join(",");
    const bodyRows = tableRows.map(makeCsvRow);
    return [headerRow, ...bodyRows].join("\n");
  }, [tableRows]);

  const handleExportCsv = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lvcheck-trades-${new Date().toISOString()}.csv`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-100">거래 목록</h2>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
        >
          CSV 내보내기
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/25">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">저장일시</th>
              <th className="px-4 py-3 text-left">시장</th>
              <th className="px-4 py-3 text-left">방향</th>
              <th className="px-4 py-3 text-right">진입가</th>
              <th className="px-4 py-3 text-right">손절가</th>
              <th className="px-4 py-3 text-right">익절가</th>
              <th className="px-4 py-3 text-right">최대 레버리지</th>
              <th className="px-4 py-3 text-right">손익비</th>
              <th className="px-4 py-3 text-right">허용 손실</th>
              <th className="px-4 py-3 text-right">익절 예상 수익</th>
              <th className="px-4 py-3 text-left">메모</th>
              <th className="px-4 py-3 text-center">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {tableRows.map((trade) => (
              <tr key={trade.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3 text-left font-mono text-xs text-slate-500">
                  {trade.index + 1}
                </td>
                <td className="px-4 py-3 align-top text-slate-300">
                  {formatDateTime(trade.created_at)}
                </td>
                <td className="px-4 py-3 align-top text-slate-200">
                  <div className="font-medium">
                    {trade.exchange.toUpperCase()} · {trade.symbol}
                  </div>
                  <div className="text-xs text-slate-500">
                    {trade.exposure_mode === "margin" ? "증거금 기준" : "총 포지션 기준"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-slate-200">
                  <span
                    className={
                      trade.direction === "Long"
                        ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300"
                        : "rounded-full bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300"
                    }
                  >
                    {trade.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-100">
                  {formatNumber(trade.entry_price)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-100">
                  {formatNumber(trade.stop_price)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {formatNumber(trade.take_profit)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-100">
                  {trade.max_leverage ? `${trade.max_leverage.toFixed(2)}x` : "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {formatNumber(trade.risk_reward_ratio)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {formatNumber(trade.allowed_loss)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {formatNumber(trade.expected_profit)}
                  {trade.expected_return_pct !== null && trade.expected_return_pct !== undefined ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {formatPercent(trade.expected_return_pct)}
                    </span>
                  ) : null}
                </td>
                <td className="max-w-xs px-4 py-3 align-top text-slate-300">
                  {trade.notes ?? "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedTrade(trade)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTrade ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <button
              type="button"
              onClick={() => setSelectedTrade(null)}
              className="absolute right-4 top-4 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-slate-500"
            >
              닫기
            </button>
            <h3 className="text-lg font-semibold text-slate-50">
              {selectedTrade.exchange.toUpperCase()} · {selectedTrade.symbol}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {formatDateTime(selectedTrade.created_at)} 저장 · {selectedTrade.direction} ·{
                " "
              }
              {selectedTrade.exposure_mode === "margin" ? "증거금" : "총 포지션"} 기준
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-200">
              <div>
                <dt className="text-xs text-slate-400">진입가</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.entry_price)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">손절가</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.stop_price)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">익절가</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.take_profit)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">허용 손실</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.allowed_loss)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">최대 레버리지</dt>
                <dd className="font-mono text-slate-100">
                  {selectedTrade.max_leverage ? `${selectedTrade.max_leverage.toFixed(2)}x` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">손익비</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.risk_reward_ratio)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">익절 예상 수익</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.expected_profit)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">익절 예상 수익률</dt>
                <dd className="font-mono text-slate-100">
                  {formatPercent(selectedTrade.expected_return_pct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">증거금</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.margin_capital)} USD
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">총 포지션</dt>
                <dd className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.position_size)} USD
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">메모</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-slate-200">
                  {selectedTrade.notes ?? "-"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </section>
  );
}
