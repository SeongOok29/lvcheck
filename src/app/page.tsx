"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import {
  calculateMetrics,
  type ExposureMode,
  type RiskMode,
} from "@/lib/calculator";

const EXCHANGES: Array<{
  id: string;
  name: string;
  symbols: string[];
}> = [
  {
    id: "binance",
    name: "Binance Futures",
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"],
  },
  {
    id: "bybit",
    name: "Bybit",
    symbols: ["BTCUSDT", "ETHUSDT", "BNBUSDT"],
  },
  {
    id: "okx",
    name: "OKX",
    symbols: ["BTCUSDT", "ETHUSDT", "DOGEUSDT"],
  },
];

const formatNumber = (value: number | undefined, fractionDigits = 2) => {
  if (value === undefined || Number.isNaN(value)) return "-";
  const absValue = Math.abs(value);
  const digits = absValue >= 1000 ? 0 : fractionDigits;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

const formatLeverage = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}x`;
};

const parseNumeric = (raw: string): number | undefined => {
  if (!raw) return undefined;
  const normalised = raw.replace(/,/g, "");
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function Home() {
  type ExchangeId = (typeof EXCHANGES)[number]["id"];

  const [exchangeId, setExchangeId] = useState<ExchangeId>(EXCHANGES[0].id);
  const [symbol, setSymbol] = useState<string>(EXCHANGES[0].symbols[0]);

  const [entryInput, setEntryInput] = useState("");
  const [stopInput, setStopInput] = useState("");
  const [takeProfitInput, setTakeProfitInput] = useState("");

  const [exposureMode, setExposureMode] = useState<ExposureMode>("margin");
  const [riskMode, setRiskMode] = useState<RiskMode>("amount");

  const [marginInput, setMarginInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
  const [riskInput, setRiskInput] = useState("");
  const { supabase, session } = useSupabase();

  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [noteInput, setNoteInput] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error" | "unauthenticated"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);

  useEffect(() => {
    const targetExchange = EXCHANGES.find((ex) => ex.id === exchangeId);
    if (!targetExchange) return;
    if (!targetExchange.symbols.includes(symbol)) {
      setSymbol(targetExchange.symbols[0]);
    }
  }, [exchangeId, symbol]);

  useEffect(() => {
    if (exposureMode === "position" && riskMode === "percent") {
      setRiskMode("amount");
    }
  }, [exposureMode, riskMode]);

  const entryPrice = parseNumeric(entryInput);
  const stopPrice = parseNumeric(stopInput);
  const takeProfit = parseNumeric(takeProfitInput);
  const marginCapital = parseNumeric(marginInput);
  const positionSize = parseNumeric(positionInput);
  const riskValue = parseNumeric(riskInput);

  const calculation = useMemo(
    () =>
      calculateMetrics({
        entryPrice,
        stopPrice,
        takeProfit,
        exposureMode,
        marginCapital: exposureMode === "margin" ? marginCapital : undefined,
        positionSize: exposureMode === "position" ? positionSize : undefined,
        riskMode,
        riskValue,
      }),
    [
      entryPrice,
      stopPrice,
      takeProfit,
      exposureMode,
      marginCapital,
      positionSize,
      riskMode,
      riskValue,
    ],
  );

  const symbols = useMemo(() => {
    const ex = EXCHANGES.find((item) => item.id === exchangeId);
    return ex?.symbols ?? [];
  }, [exchangeId]);

  const showRiskPercentInput = exposureMode === "margin" && riskMode === "percent";
  const riskLabel =
    exposureMode === "margin"
      ? riskMode === "percent"
        ? "허용 손실률 (% of 증거금)"
        : "허용 손실 금액 (USD)"
      : "허용 손실 금액 (USD)";

  const userDisplayName =
    session?.user?.email ??
    (session?.user?.user_metadata?.name as string | undefined) ??
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    undefined;

  const handleSendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authEmail) {
      setAuthError("이메일을 입력하세요.");
      return;
    }

    setAuthLoading(true);
    setAuthStatus(null);
    setAuthError(null);

    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?redirect=/`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: emailRedirectTo
          ? {
              emailRedirectTo,
            }
          : undefined,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      setAuthStatus("로그인 링크를 전송했습니다. 이메일을 확인하세요.");
      setAuthEmail("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSaveState("idle");
    setSaveMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleSaveTrade = async () => {
    if (!session) {
      setSaveState("unauthenticated");
      setSaveMessage("로그인 후 거래 기록을 저장할 수 있습니다.");
      return;
    }

    if (!calculation.ready || !entryPrice || !stopPrice) {
      setSaveState("error");
      setSaveMessage("유효한 진입가와 손절가를 입력한 뒤 저장하세요.");
      return;
    }

    setSaveState("saving");
    setSaveMessage(null);

    const payload = {
      user_id: session.user.id,
      exchange: exchangeId,
      symbol,
      direction: calculation.direction ?? (stopPrice < entryPrice ? "Long" : "Short"),
      entry_price: entryPrice,
      stop_price: stopPrice,
      take_profit: takeProfit ?? null,
      exposure_mode: exposureMode,
      risk_mode: riskMode,
      margin_capital: exposureMode === "margin" ? marginCapital ?? null : null,
      position_size: exposureMode === "position" ? positionSize ?? null : null,
      risk_value: riskValue ?? null,
      price_delta: calculation.priceDelta ?? null,
      price_delta_pct: calculation.priceDeltaPct ?? null,
      theoretical_max_leverage: calculation.theoreticalMaxLeverage ?? null,
      max_leverage: calculation.maxLeverage ?? null,
      max_position_size: calculation.maxPositionSize ?? null,
      allowed_loss: calculation.allowedLoss ?? null,
      loss_at_stop: calculation.lossAtStop ?? null,
      risk_percent_of_capital: calculation.riskPercentOfCapital ?? null,
      risk_reward_ratio: calculation.riskRewardRatio ?? null,
      expected_profit: calculation.expectedProfit ?? null,
      expected_return_pct: calculation.expectedReturnPct ?? null,
      notes: noteInput.trim() ? noteInput.trim() : null,
    };

    const { error } = await supabase.from("trade_entries").insert(payload);

    if (error) {
      setSaveState("error");
      setSaveMessage(
        error.message ?? "거래 기록 저장 중 문제가 발생했습니다. 다시 시도하세요.",
      );
      return;
    }

    setSaveState("success");
    setSaveMessage("거래 기록을 저장했습니다.");
    setNoteInput("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-400">
              lvcheck
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              최대 레버리지 계산기
            </h1>
            <p className="text-sm text-slate-400">
              진입가, 손절가, 허용 손실만으로 즉시 최대 레버리지를 추산합니다.
            </p>
          </div>
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
            {session ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-400">
                    Signed in
                  </p>
                  <p className="mt-1 font-medium text-slate-100">
                    {userDisplayName ?? "사용자"}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href="/history"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                  >
                    거래 내역 보기
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <form className="space-y-2" onSubmit={handleSendMagicLink}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    이메일로 로그인 (Magic Link)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="trader@example.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  {authLoading ? "전송 중..." : "로그인 링크 보내기"}
                </button>
                {authStatus ? (
                  <p className="text-xs text-sky-400">{authStatus}</p>
                ) : null}
                {authError ? (
                  <p className="text-xs text-rose-400">{authError}</p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">시장 선택</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">거래소</span>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={exchangeId}
                    onChange={(event) =>
                      setExchangeId(event.target.value as ExchangeId)
                    }
                  >
                    {EXCHANGES.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>
                        {exchange.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">심볼</span>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value)}
                  >
                    {symbols.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">가격 입력</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">진입가 (USD)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={entryInput}
                    onChange={(event) => setEntryInput(event.target.value)}
                    placeholder="예: 63250"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">손절가 (USD)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={stopInput}
                    onChange={(event) => setStopInput(event.target.value)}
                    placeholder="예: 61800"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">익절가 (선택)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={takeProfitInput}
                    onChange={(event) => setTakeProfitInput(event.target.value)}
                    placeholder="예: 67200"
                  />
                </label>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  onClick={async () => {
                    if (priceLoading) return;

                    if (exchangeId !== "binance") {
                      setPriceMessage("현재가는 Binance 선물만 지원합니다.");
                      return;
                    }

                    setPriceLoading(true);
                    setPriceMessage(null);

                    try {
                      const response = await fetch(
                        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
                      );

                      if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                      }

                      const data: { price?: string } = await response.json();
                      if (!data.price) {
                        throw new Error("No price returned");
                      }

                      setEntryInput(data.price);
                      setPriceMessage("현재가를 불러왔습니다.");
                    } catch (error) {
                      setPriceMessage("가격을 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
                      console.error(error);
                    } finally {
                      setPriceLoading(false);
                    }
                  }}
                  disabled={priceLoading}
                >
                  {priceLoading ? "불러오는 중..." : "현재가 불러오기"}
                </button>
              </div>
              {priceMessage ? (
                <p className="text-xs text-slate-400">{priceMessage}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">리스크 입력</h2>
              <div className="flex gap-2 text-xs font-medium text-slate-300">
                <button
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 transition ${
                    exposureMode === "margin"
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  }`}
                  onClick={() => setExposureMode("margin")}
                >
                  증거금 기준
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 transition ${
                    exposureMode === "position"
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  }`}
                  onClick={() => setExposureMode("position")}
                >
                  총 포지션 기준
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {exposureMode === "margin" ? (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">증거금 / 자본 (USD)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      value={marginInput}
                      onChange={(event) => setMarginInput(event.target.value)}
                      placeholder="예: 5000"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">총 포지션 규모 (USD)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      value={positionInput}
                      onChange={(event) => setPositionInput(event.target.value)}
                      placeholder="예: 25000"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">{riskLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={riskInput}
                    onChange={(event) => setRiskInput(event.target.value)}
                    placeholder={showRiskPercentInput ? "예: 1" : "예: 300"}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-300">거래 메모 (선택)</span>
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder="전략 요약, 트리거 조건, 체크리스트 등을 기록하세요."
                />
              </label>

              <div className="flex gap-2 text-xs font-medium text-slate-300">
                <button
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 transition ${
                    riskMode === "amount"
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  }`}
                  onClick={() => setRiskMode("amount")}
                >
                  손실 금액
                </button>
                <button
                  type="button"
                  disabled={exposureMode === "position"}
                  className={`flex-1 rounded-lg border px-3 py-2 transition ${
                    exposureMode === "position"
                      ? "cursor-not-allowed border-slate-800 bg-slate-800/60 text-slate-500"
                      : riskMode === "percent"
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  }`}
                  onClick={() => {
                    if (exposureMode === "position") return;
                    setRiskMode("percent");
                  }}
                >
                  손실률 (% of 증거금)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
              <h2 className="text-lg font-semibold text-slate-100">결과</h2>
              <div className="mt-4 grid gap-4">
                <ItemRow label="방향" value={calculation.direction ?? "-"} />
                <ItemRow
                  label="손절 폭"
                  value={`${formatNumber(calculation.priceDelta)} USD (${formatNumber(calculation.priceDeltaPct)}%)`}
                />
                <ItemRow
                  label="이론상 최대 레버리지"
                  value={formatLeverage(calculation.theoreticalMaxLeverage)}
                  tooltip="손절폭만으로 계산한 이론적 값으로, 레버리지 한도를 단순 비교할 때 참고하세요."
                />
                <ItemRow
                  label="허용 기준 최대 레버리지"
                  value={formatLeverage(calculation.maxLeverage)}
                />
                <ItemRow
                  label="허용 손실"
                  value={
                    calculation.allowedLoss !== undefined
                      ? `${formatNumber(calculation.allowedLoss)} USD`
                      : "-"
                  }
                />
                {exposureMode === "margin" ? (
                  <ItemRow
                    label="허용 레버리지 기준 포지션"
                    value={
                      calculation.maxPositionSize !== undefined
                        ? `${formatNumber(calculation.maxPositionSize)} USD`
                        : "-"
                    }
                  />
                ) : (
                  <ItemRow
                    label="손절 시 예상 손실"
                    value={
                      calculation.lossAtStop !== undefined
                        ? `${formatNumber(calculation.lossAtStop)} USD`
                        : "-"
                    }
                  />
                )}
                <ItemRow
                  label="증거금 대비 손실 비중"
                  value={
                    calculation.riskPercentOfCapital !== undefined
                      ? `${formatNumber(calculation.riskPercentOfCapital, 2)}%`
                      : "-"
                  }
                />
                {calculation.riskRewardRatio !== undefined && (
                  <ItemRow
                    label="손익비 (R:R)"
                    value={formatNumber(calculation.riskRewardRatio, 2)}
                  />
                )}
                {calculation.expectedProfit !== undefined && (
                  <ItemRow
                    label="익절 시 예상 수익"
                    value={`${formatNumber(calculation.expectedProfit)} USD`}
                  />
                )}
                {calculation.expectedReturnPct !== undefined && (
                  <ItemRow
                    label="익절 시 예상 수익률"
                    value={`${formatNumber(calculation.expectedReturnPct, 2)}%`}
                  />
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveTrade}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-500 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                    disabled={saveState === "saving"}
                  >
                    {saveState === "saving" ? "저장 중..." : "거래 기록으로 저장"}
                  </button>
                  {saveMessage ? (
                    <p
                      className={`mt-2 text-xs ${
                        saveState === "success"
                          ? "text-sky-400"
                          : saveState === "unauthenticated"
                          ? "text-amber-300"
                          : "text-rose-400"
                      }`}
                    >
                      {saveMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
              <h2 className="text-lg font-semibold text-slate-100">유효성 & 메모</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {calculation.warnings.length === 0 ? (
                  <li className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-slate-400">
                    입력값을 채우면 계산 결과가 즉시 업데이트됩니다. 추후 버전에서는 실시간 시세 연동을 제공합니다.
                  </li>
                ) : (
                  calculation.warnings.map((warning, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-slate-800 bg-red-500/10 px-3 py-2 text-red-200"
                    >
                      {warning}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-800 bg-slate-900/80 px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} lvcheck — 레버리지 리스크 관리 도구
          </p>
          <p>
            Vercel 서버리스 환경에 최적화된 Next.js 애플리케이션
          </p>
        </div>
      </footer>
    </div>
  );
}

interface ItemRowProps {
  label: string;
  value: string;
  tooltip?: string;
}

function ItemRow({ label, value, tooltip }: ItemRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center gap-1 text-sm font-medium text-slate-300">
        <span>{label}</span>
        {tooltip ? (
          <span className="text-xs text-slate-500">{tooltip}</span>
        ) : null}
      </div>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  );
}
