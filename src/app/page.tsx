"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import {
  calculateMetrics,
  type ExposureMode,
  type RiskMode,
} from "@/lib/calculator";
import { LanguageToggle } from "@/components/language-toggle";
import { useTranslations } from "@/i18n/context";

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

  const t = useTranslations();

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
        ? t("inputs.lossPercent")
        : t("inputs.lossAmount")
      : t("inputs.lossAmount");

  const userDisplayName =
    session?.user?.email ??
    (session?.user?.user_metadata?.name as string | undefined) ??
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    undefined;

  const handleSendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authEmail) {
      setAuthError(t("auth.errorEmail"));
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

      setAuthStatus(t("auth.sent"));
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
      setSaveMessage(t("auth.loginRequired"));
      return;
    }

    if (!calculation.ready || !entryPrice || !stopPrice) {
      setSaveState("error");
      setSaveMessage(t("auth.validInputs"));
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
      exit_outcome: null,
      notes: noteInput.trim() ? noteInput.trim() : null,
    };

    const { error } = await supabase.from("trade_entries").insert(payload);

    if (error) {
      setSaveState("error");
      setSaveMessage(error.message ?? t("save.error"));
      return;
    }

    setSaveState("success");
    setSaveMessage(t("save.success"));
    setNoteInput("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-400">
              {t("brand")}
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              {t("app.title")}
            </h1>
            <p className="text-sm text-slate-400">{t("app.subtitle")}</p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3 text-sm text-slate-200">
            <div className="flex justify-end">
              <LanguageToggle />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              {session ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-400">
                      {t("auth.signedIn")}
                    </p>
                    <p className="mt-1 font-medium text-slate-100">
                      {userDisplayName ?? t("auth.userPlaceholder")}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/history"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                    >
                      {t("history.link")}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                    >
                      {t("auth.logout")}
                    </button>
                  </div>
                </div>
              ) : (
                <form className="space-y-2" onSubmit={handleSendMagicLink}>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      {t("auth.loginHeading")}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder={t("auth.emailPlaceholder")}
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
                    {authLoading ? t("auth.sending") : t("auth.sendLink")}
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
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {t("inputs.marketSection")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">{t("inputs.exchange")}</span>
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
                  <span className="text-slate-300">{t("inputs.symbol")}</span>
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
              <h2 className="text-lg font-semibold text-slate-100">
                {t("inputs.priceSection")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">{t("inputs.entry")}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={entryInput}
                    onChange={(event) => setEntryInput(event.target.value)}
                    placeholder="63250"
                  />
                </label>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  onClick={async () => {
                    if (priceLoading) return;

                    if (exchangeId !== "binance") {
                      setPriceMessage(t("auth.priceFetchNote"));
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
                      setPriceMessage(t("auth.linkFetched"));
                    } catch (error) {
                      setPriceMessage(t("auth.linkFailed"));
                      console.error(error);
                    } finally {
                      setPriceLoading(false);
                    }
                  }}
                  disabled={priceLoading}
                >
                  {priceLoading ? t("auth.priceFetching") : t("auth.priceFetchTitle")}
                </button>
              </div>
              {priceMessage ? (
                <p className="text-xs text-slate-400">{priceMessage}</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">{t("inputs.stop")}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={stopInput}
                    onChange={(event) => setStopInput(event.target.value)}
                    placeholder="61800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">{t("inputs.takeProfit")}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    value={takeProfitInput}
                    onChange={(event) => setTakeProfitInput(event.target.value)}
                    placeholder="67200"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">
                {t("inputs.riskSection")}
              </h2>
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
                  {t("inputs.marginMode")}
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
                  {t("inputs.positionMode")}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {exposureMode === "margin" ? (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">{t("inputs.marginCapital")}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      value={marginInput}
                      onChange={(event) => setMarginInput(event.target.value)}
                      placeholder="5000"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">{t("inputs.positionSize")}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      value={positionInput}
                      onChange={(event) => setPositionInput(event.target.value)}
                      placeholder="25000"
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
                    placeholder={showRiskPercentInput ? "1" : "300"}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-300">{t("inputs.tradeNote")}</span>
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder={t("inputs.notePlaceholder")}
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
                  {t("inputs.toggleAmount")}
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
                  {t("inputs.togglePercent")}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
              <h2 className="text-lg font-semibold text-slate-100">
                {t("results.section")}
              </h2>
              <div className="mt-4 grid gap-4">
                <ItemRow
                  label={t("results.direction")}
                  value={
                    calculation.direction
                      ? t(
                          calculation.direction === "Long"
                            ? "direction.long"
                            : "direction.short",
                        )
                      : "-"
                  }
                />
                <ItemRow
                  label={t("results.stopDistance")}
                  value={`${formatNumber(calculation.priceDelta)} USD (${formatNumber(calculation.priceDeltaPct)}%)`}
                />
                <ItemRow
                  label={t("results.theoretical")}
                  value={formatLeverage(calculation.theoreticalMaxLeverage)}
                  tooltip={t("results.theoreticalHint")}
                />
                <ItemRow
                  label={t("results.leverage")}
                  value={formatLeverage(calculation.maxLeverage)}
                />
                <ItemRow
                  label={t("results.allowedLoss")}
                  value={
                    calculation.allowedLoss !== undefined
                      ? `${formatNumber(calculation.allowedLoss)} USD`
                      : "-"
                  }
                />
                {exposureMode === "margin" ? (
                  <ItemRow
                    label={t("results.maxPosition")}
                    value={
                      calculation.maxPositionSize !== undefined
                        ? `${formatNumber(calculation.maxPositionSize)} USD`
                        : "-"
                    }
                  />
                ) : (
                  <ItemRow
                    label={t("results.lossAtStop")}
                    value={
                      calculation.lossAtStop !== undefined
                        ? `${formatNumber(calculation.lossAtStop)} USD`
                        : "-"
                    }
                  />
                )}
                <ItemRow
                  label={t("results.riskPercent")}
                  value={
                    calculation.riskPercentOfCapital !== undefined
                      ? `${formatNumber(calculation.riskPercentOfCapital, 2)}%`
                      : "-"
                  }
                />
                {calculation.riskRewardRatio !== undefined && (
                  <ItemRow
                    label={t("results.rr")}
                    value={formatNumber(calculation.riskRewardRatio, 2)}
                  />
                )}
                {calculation.expectedProfit !== undefined && (
                  <ItemRow
                    label={t("results.expectedProfit")}
                    value={`${formatNumber(calculation.expectedProfit)} USD`}
                  />
                )}
                {calculation.expectedReturnPct !== undefined && (
                  <ItemRow
                    label={t("results.expectedReturn")}
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
                    {saveState === "saving" ? t("results.saving") : t("results.save")}
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
              <h2 className="text-lg font-semibold text-slate-100">
                {t("results.sectionNotes")}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {calculation.warnings.length === 0 ? (
                  <li className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-slate-400">
                    {t("results.noWarnings")}
                  </li>
                ) : (
                  calculation.warnings.map((warning, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-slate-800 bg-red-500/10 px-3 py-2 text-red-200"
                    >
                      {t(warning)}
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
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
          <p>{t("footer.deployment")}</p>
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
