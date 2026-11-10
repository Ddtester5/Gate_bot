
import { getKlines } from "./get_clines";

export interface MarketRegime {
  anchor: number;
  range: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  rangePct: number;
  driftPct: number;
  trendFactor: number;
  isSideways: boolean;
  // Локальные уровни за указанное количество свечей
  localMinPrice: number;
  localMaxPrice: number;
  localRange: number;
}

export async function analyzeMarket(
  symbol: string,
  lookbackCandles: number,
  localLookback: number,
  minRangePct: number,
  maxRangePct: number,
  maxTrendFactor: number,
  candlesInterval: string = "1",
): Promise<MarketRegime | null> {
  try {
    // Получаем свечи через CCXT.
    const klines = await getKlines(
      symbol,
      candlesInterval,
      lookbackCandles,
    );

    if (!klines || klines.length === 0) return null;

    let minPrice = Infinity;
    let maxPrice = 0;

    // Формат CCXT OHLCV:
    // [timestamp, open, high, low, close, volume]
    for (const k of klines) {
      const high = Number(k[2]);
      const low = Number(k[3]);

      if (isNaN(low) || isNaN(high)) continue;

      if (low < minPrice) minPrice = low;
      if (high > maxPrice) maxPrice = high;
    }

    if (minPrice === Infinity || maxPrice === 0) return null;

    const anchor = (minPrice + maxPrice) / 2;
    const range = maxPrice - minPrice;

    // Текущая цена — close последней полученной свечи.
    const lastCandle = klines[klines.length - 1];

    if (!lastCandle) return null;

    const currentPrice = Number(lastCandle[4]);

    if (isNaN(currentPrice)) return null;

    // Расчёт локальных уровней.
    const safeLocalLookback = Math.min(
      localLookback,
      klines.length,
    );

    const localKlines = klines.slice(-safeLocalLookback);

    let localMinPrice = Infinity;
    let localMaxPrice = -Infinity;

    for (const k of localKlines) {
      const high = Number(k[2]);
      const low = Number(k[3]);

      if (isNaN(low) || isNaN(high)) continue;

      if (low < localMinPrice) localMinPrice = low;
      if (high > localMaxPrice) localMaxPrice = high;
    }

    if (
      localMinPrice === Infinity ||
      localMaxPrice === -Infinity
    ) {
      localMinPrice = currentPrice;
      localMaxPrice = currentPrice;
    }

    const localRange = localMaxPrice - localMinPrice;

    // Метрики рыночного диапазона.
    const rangePct =
      anchor > 0
        ? ((maxPrice - minPrice) / anchor) * 100
        : 0;

    const driftPct =
      anchor > 0
        ? (Math.abs(currentPrice - anchor) / anchor) * 100
        : 0;

    const trendFactor =
      rangePct > 0 ? driftPct / rangePct : 0;

    const isSideways =
      rangePct > minRangePct &&
      rangePct < maxRangePct &&
      trendFactor < maxTrendFactor;

    return {
      anchor,
      range,
      minPrice,
      maxPrice,
      currentPrice,
      rangePct,
      driftPct,
      trendFactor,
      isSideways,
      localMinPrice,
      localMaxPrice,
      localRange,
    };

  } catch (e: any) {
    console.error(
      symbol,
      "analyzeMarket error:",
      e.message || e,
    );

    return null;
  }
}
