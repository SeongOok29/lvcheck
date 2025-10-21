export type ExposureMode = "margin" | "position";
export type RiskMode = "amount" | "percent";

export interface CalculationInputs {
  entryPrice?: number;
  stopPrice?: number;
  takeProfit?: number;
  exposureMode: ExposureMode;
  marginCapital?: number;
  positionSize?: number;
  riskMode: RiskMode;
  riskValue?: number;
}

export interface CalculationResult {
  ready: boolean;
  direction?: "Long" | "Short";
  priceDelta?: number;
  priceDeltaPct?: number;
  theoreticalMaxLeverage?: number;
  maxLeverage?: number;
  maxPositionSize?: number;
  requiredMargin?: number;
  allowedLoss?: number;
  riskPercentOfCapital?: number;
  lossAtStop?: number;
  riskRewardRatio?: number;
  expectedProfit?: number;
  expectedReturnPct?: number;
  warnings: string[];
}

const toRatio = (value: number | undefined, total: number | undefined) => {
  if (!value || !total || total === 0) return undefined;
  return (value / total) * 100;
};

const isFinitePositive = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function calculateMetrics(inputs: CalculationInputs): CalculationResult {
  const warnings: string[] = [];
  const {
    entryPrice,
    stopPrice,
    takeProfit,
    exposureMode,
    marginCapital,
    positionSize,
    riskMode,
    riskValue,
  } = inputs;

  if (!isFinitePositive(entryPrice) || !isFinitePositive(stopPrice)) {
    return { ready: false, warnings };
  }

  if (entryPrice === stopPrice) {
    warnings.push("손절가와 진입가는 달라야 합니다.");
    return { ready: false, warnings };
  }

  const entry = entryPrice!;
  const stop = stopPrice!;

  const direction: "Long" | "Short" = stop < entry ? "Long" : "Short";
  const priceDelta = Math.abs(entry - stop);
  const priceDeltaPct = (priceDelta / entry) * 100;

  if (priceDelta === 0) {
    warnings.push("손절가가 진입가와 동일합니다.");
    return { ready: false, warnings };
  }

  const theoreticalMaxLeverage = entry / priceDelta;

  let allowedLoss: number | undefined;

  if (riskMode === "amount") {
    if (isFinitePositive(riskValue)) {
      allowedLoss = riskValue;
    }
  } else {
    if (exposureMode === "margin") {
      if (isFinitePositive(marginCapital) && isFinitePositive(riskValue)) {
        allowedLoss = (marginCapital! * riskValue!) / 100;
      }
    } else {
      warnings.push("손실률(% of 증거금)은 증거금 모드에서만 사용 가능합니다.");
    }
  }

  const result: CalculationResult = {
    ready: false,
    direction,
    priceDelta,
    priceDeltaPct,
    theoreticalMaxLeverage,
    warnings,
  };

  const computeTakeProfitMetrics = (
    baseNotional: number | undefined,
    baseCapital: number | undefined,
  ) => {
    if (!isFinitePositive(baseNotional) || !takeProfit) {
      return;
    }

    const profitDeltaRaw =
      direction === "Long" ? takeProfit - entry : entry - takeProfit;

    if (!Number.isFinite(profitDeltaRaw) || profitDeltaRaw <= 0) {
      warnings.push("익절가는 진입가보다 유리한 방향으로 설정해야 합니다.");
      return;
    }

    const profitDeltaPct = profitDeltaRaw / entry;
    const expectedProfit = profitDeltaPct * baseNotional!;

    result.expectedProfit = expectedProfit;
    result.expectedReturnPct = toRatio(expectedProfit, baseCapital);
    result.riskRewardRatio = profitDeltaRaw / priceDelta;
  };

  if (exposureMode === "margin") {
    if (!isFinitePositive(marginCapital)) {
      if (!warnings.length) {
        warnings.push("유효한 증거금을 입력하세요.");
      }
      return result;
    }

    if (!isFinitePositive(allowedLoss)) {
      warnings.push("허용 손실 금액 또는 손실률을 입력하세요.");
      return result;
    }

    const maxLeverage = (allowedLoss! * entry) / (marginCapital! * priceDelta);
    const maxPositionSize = marginCapital! * maxLeverage;

    result.maxLeverage = maxLeverage;
    result.maxPositionSize = maxPositionSize;
    result.allowedLoss = allowedLoss;
    result.riskPercentOfCapital = toRatio(allowedLoss, marginCapital);
    result.lossAtStop = (priceDelta / entry) * maxPositionSize;
    result.requiredMargin = marginCapital;
    result.ready = Number.isFinite(maxLeverage) && maxLeverage > 0;

    computeTakeProfitMetrics(maxPositionSize, marginCapital);
    return result;
  }

  if (!isFinitePositive(positionSize)) {
    warnings.push("유효한 총 포지션 규모를 입력하세요.");
    return result;
  }

  if (!isFinitePositive(allowedLoss)) {
    warnings.push("허용 손실 금액을 입력하세요.");
    return result;
  }

  const lossAtStop = (priceDelta / entry) * positionSize!;
  result.lossAtStop = lossAtStop;

  if (allowedLoss! < lossAtStop) {
    warnings.push("현재 포지션과 손절 거리로는 허용 손실 금액을 초과합니다.");
  }

  const maxPositionSize = (allowedLoss! * entry) / priceDelta;
  const requiredMargin = lossAtStop;
  const maxLeverage = entry / priceDelta;

  result.maxLeverage = maxLeverage;
  result.allowedLoss = allowedLoss;
  result.requiredMargin = requiredMargin;
  result.maxPositionSize = maxPositionSize;
  result.riskPercentOfCapital = toRatio(allowedLoss, requiredMargin);
  result.ready = allowedLoss! >= lossAtStop && Number.isFinite(maxLeverage);

  computeTakeProfitMetrics(positionSize, requiredMargin);

  return result;
}
