"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";
import { useTranslations } from "@/i18n/context";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { TradeEntry } from "@/types/trade";

interface HistoryTableProps {
  trades: TradeEntry[];
}

type TableRow = TradeEntry & { index: number };

type OutcomeOption = "take_profit" | "stop_loss" | "open" | "";

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
  "exit_outcome",
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
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeOption>("");
  const [isEditing, setIsEditing] = useState(false);
  const [mutationState, setMutationState] = useState<
    "idle" | "saving" | "deleting" | "success" | "error"
  >( "idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);

  const { supabase } = useSupabase();
  const t = useTranslations();
  const router = useRouter();

  const tableRows = useMemo<TableRow[]>(
    () => trades.map((trade, index) => ({ ...trade, index })),
    [trades],
  );

  const outcomeLabel = (value: TradeEntry["exit_outcome"]) => {
    switch (value) {
      case "take_profit":
        return t("outcome.take_profit");
      case "stop_loss":
        return t("outcome.stop_loss");
      case "open":
        return t("outcome.open");
      default:
        return t("outcome.none");
    }
  };

  useEffect(() => {
    if (selectedTrade) {
      setNoteDraft(selectedTrade.notes ?? "");
      setOutcomeDraft(selectedTrade.exit_outcome ?? "");
      setIsEditing(false);
      setMutationState("idle");
      setMutationMessage(null);
    }
  }, [selectedTrade]);

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

  const handleDelete = async () => {
    if (!selectedTrade || mutationState === "deleting") return;
    const confirmed = window.confirm(t("history.table.modal.deleteConfirm"));
    if (!confirmed) return;

    setMutationState("deleting");
    setMutationMessage(null);
    const { error } = await supabase.from("trade_entries").delete().eq("id", selectedTrade.id);
    if (error) {
      setMutationState("error");
      setMutationMessage(error.message ?? t("history.table.modal.deleteError"));
      return;
    }

    setMutationState("success");
    setMutationMessage(t("history.table.modal.deleteSuccess"));
    setSelectedTrade(null);
    router.refresh();
  };

  const handleSave = async () => {
    if (!selectedTrade || mutationState === "saving") return;
    setMutationState("saving");
    setMutationMessage(null);

    const payload = {
      notes: noteDraft.trim() ? noteDraft.trim() : null,
      exit_outcome: outcomeDraft || null,
    };

    const { error } = await supabase
      .from("trade_entries")
      .update(payload)
      .eq("id", selectedTrade.id);

    if (error) {
      setMutationState("error");
      setMutationMessage(error.message ?? t("history.table.modal.saveError"));
      return;
    }

    setMutationState("success");
    setMutationMessage(t("history.table.modal.saveSuccess"));
    setSelectedTrade(null);
    router.refresh();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-100">
          {t("history.table.title")}
        </h2>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
        >
          {t("history.table.export")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/25">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">{t("history.table.index")}</th>
              <th className="px-4 py-3 text-left">{t("history.table.savedAt")}</th>
              <th className="px-4 py-3 text-left">{t("history.table.market")}</th>
              <th className="px-4 py-3 text-left">{t("history.table.direction")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.entry")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.stop")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.takeProfit")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.maxLeverage")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.investment")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.rr")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.allowedLoss")}</th>
              <th className="px-4 py-3 text-right">{t("history.table.expectedProfit")}</th>
              <th className="px-4 py-3 text-left">{t("history.table.notes")}</th>
              <th className="px-4 py-3 text-left">{t("history.table.outcome")}</th>
              <th className="px-4 py-3 text-center">{t("history.table.details")}</th>
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
                    {t(trade.exposure_mode === "margin" ? "mode.margin" : "mode.position")}
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
                    {t(trade.direction === "Long" ? "direction.long" : "direction.short")}
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
                  {formatNumber(trade.margin_capital)}
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
                <td className="px-4 py-3 align-top text-slate-300">
                  {outcomeLabel(trade.exit_outcome)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedTrade(trade)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-sky-200"
                  >
                    {t("history.table.details")}
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
              {t("history.table.modal.close")}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="absolute right-20 top-4 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-slate-500"
            >
              {isEditing ? t("history.table.modal.close") : t("history.table.modal.edit")}
            </button>
            <h3 className="text-lg font-semibold text-slate-50">
              {t("history.table.modal.summary", {
                exchange: selectedTrade.exchange.toUpperCase(),
                symbol: selectedTrade.symbol,
              })}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("history.table.modal.saved", {
                createdAt: formatDateTime(selectedTrade.created_at),
                direction: t(
                  selectedTrade.direction === "Long"
                    ? "direction.long"
                    : "direction.short",
                ),
                mode: t(
                  selectedTrade.exposure_mode === "margin"
                    ? "mode.margin"
                    : "mode.position",
                ),
              })}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-200">
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.entry")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.entry_price)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.stop")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.stop_price)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.takeProfit")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.take_profit)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.allowedLoss")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.allowed_loss)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.leverage")}</h4>
                <p className="font-mono text-slate-100">
                  {selectedTrade.max_leverage ? `${selectedTrade.max_leverage.toFixed(2)}x` : "-"}
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.rr")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.risk_reward_ratio)}
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.expectedProfit")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.expected_profit)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.expectedReturn")}</h4>
                <p className="font-mono text-slate-100">
                  {formatPercent(selectedTrade.expected_return_pct)}
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.investment")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.margin_capital)} USD
                </p>
              </div>
              <div>
                <h4 className="text-xs text-slate-400">{t("history.table.modal.position")}</h4>
                <p className="font-mono text-slate-100">
                  {formatNumber(selectedTrade.position_size)} USD
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">{t("history.table.modal.memo")}</span>
                  <textarea
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    disabled={!isEditing}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-slate-400">{t("history.table.modal.outcome")}</span>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={outcomeDraft}
                    onChange={(event) =>
                      setOutcomeDraft(event.target.value as OutcomeOption)
                    }
                    disabled={!isEditing}
                  >
                    <option value="">{t("history.table.modal.outcomeNone")}</option>
                    <option value="take_profit">{t("history.table.modal.outcomeTp")}</option>
                    <option value="stop_loss">{t("history.table.modal.outcomeSl")}</option>
                    <option value="open">{t("history.table.modal.outcomeOpen")}</option>
                  </select>
                </label>
              </div>
            </div>

            {mutationMessage ? (
              <p
                className={`mt-3 text-xs ${
                  mutationState === "error" ? "text-rose-400" : "text-sky-400"
                }`}
              >
                {mutationMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-rose-600 bg-rose-600/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/20 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={mutationState === "deleting"}
              >
                {mutationState === "deleting"
                  ? t("history.table.modal.deleting")
                  : t("history.table.modal.delete")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-sky-500 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/30 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={mutationState === "saving" || !isEditing}
              >
                {mutationState === "saving"
                  ? t("history.table.modal.saving")
                  : t("history.table.modal.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
