import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type TradeEntry = {
  id: string;
  user_id: string;
  created_at: string;
  exchange: string;
  symbol: string;
  direction: "Long" | "Short";
  entry_price: number;
  stop_price: number;
  take_profit: number | null;
  exposure_mode: string;
  risk_mode: string;
  margin_capital: number | null;
  position_size: number | null;
  risk_value: number | null;
  price_delta: number | null;
  price_delta_pct: number | null;
  theoretical_max_leverage: number | null;
  max_leverage: number | null;
  max_position_size: number | null;
  allowed_loss: number | null;
  loss_at_stop: number | null;
  risk_percent_of_capital: number | null;
  risk_reward_ratio: number | null;
  expected_profit: number | null;
  expected_return_pct: number | null;
  notes: string | null;
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  });
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/?redirectedFrom=history");
  }

  const { data: tradesData, error } = await supabase
    .from("trade_entries")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`거래 내역을 불러오지 못했습니다: ${error.message}`);
  }

  const trades = (tradesData ?? []) as TradeEntry[];
  const hasTrades = trades.length > 0;

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
        {!hasTrades ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            {"아직 저장된 거래 기록이 없습니다. 계산기에서 \"거래 기록으로 저장\" 버튼을 눌러 신규 항목을 추가하세요."}
          </div>
        ) : (
          <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/25">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {trades!.map((trade) => (
                  <tr key={trade.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3 align-top text-slate-300">
                      {formatDate(trade.created_at)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
