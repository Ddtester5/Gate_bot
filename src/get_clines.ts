
import { client } from "./client";

// Преобразуем старый формат BTCUSDT в формат CCXT BTC/USDT.
function normalizeSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    return symbol;
  }

  const normalized = symbol.replace(/[-_]/g, "").toUpperCase();

  const markets = Object.values(client.markets || {}) as any[];

  const market = markets.find((item) => {
    const marketSymbol = item.symbol?.replace("/", "").replace(":", "").toUpperCase();
    const marketId = item.id?.replace(/[-_]/g, "").toUpperCase();

    return (
      marketSymbol === normalized ||
      marketId === normalized
    );
  });

  if (!market) {
    throw new Error(
      `Не удалось найти торговую пару ${symbol} на бирже ${client.id}`,
    );
  }

  return market.symbol;
}

// Преобразуем старые интервалы Bybit ("1", "5", "15")
// в формат CCXT ("1m", "5m", "15m").
function normalizeTimeframe(interval: string): string {
  if (/^\d+$/.test(interval)) {
    return `${interval}m`;
  }

  return interval;
}

export async function getKlines(
  symbol: string,
  interval = "1",
  limit = 15,
) {
  try {
    // Убеждаемся, что рынки загружены.
    await client.loadMarkets();

    const ccxtSymbol = normalizeSymbol(symbol);
    const timeframe = normalizeTimeframe(interval);

    // Проверяем поддержку таймфрейма биржей.
    if (
      client.timeframes &&
      !client.timeframes[timeframe]
    ) {
      throw new Error(
        `Таймфрейм ${timeframe} не поддерживается биржей ${client.id}`,
      );
    }

    const candles = await client.fetchOHLCV(
      ccxtSymbol,
      timeframe,
      undefined,
      limit,
    );

    if (!candles || candles.length === 0) {
      throw new Error(
        `Биржа не вернула свечи для ${ccxtSymbol}`,
      );
    }

    // CCXT уже возвращает свечи от старых к новым.
    // Формат: [timestamp, open, high, low, close, volume].
    return candles;

  } catch (e: any) {
    console.error(
      `Ошибка при получении свечей для ${symbol}:`,
      e.message || e,
    );

    throw e;
  }
}
