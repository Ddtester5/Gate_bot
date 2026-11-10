
import { client } from "./client";

export async function getLastBuyPrice(
  symbol: string
): Promise<number | null> {
  try {
    await client.loadMarkets();

    // Преобразуем BTCUSDT в формат CCXT BTC/USDT.
    let ccxtSymbol = symbol;

    if (!symbol.includes("/")) {
      const normalized = symbol.replace(/[-_]/g, "").toUpperCase();

      const markets = Object.values(client.markets || {}) as any[];

      const market = markets.find((item) => {
        const marketSymbol = item.symbol
          ?.replace("/", "")
          .replace(":", "")
          .toUpperCase();

        const marketId = item.id
          ?.replace(/[-_]/g, "")
          .toUpperCase();

        return (
          marketSymbol === normalized ||
          marketId === normalized
        );
      });

      if (!market) {
        throw new Error(`Торговая пара ${symbol} не найдена`);
      }

      ccxtSymbol = market.symbol;
    }

    // Получаем последние сделки пользователя.
    const trades = await client.fetchMyTrades(
      ccxtSymbol,
      undefined,
      50
    );

    if (!trades || trades.length === 0) {
      return null;
    }

    // Оставляем только покупки.
    const buyTrades = trades.filter(
      (trade: any) => trade.side === "buy"
    );

    if (buyTrades.length === 0) {
      return null;
    }

    // Сортируем от новых сделок к старым.
    buyTrades.sort(
      (a: any, b: any) =>
        Number(b.timestamp || 0) - Number(a.timestamp || 0)
    );

    const lastBuy = buyTrades[0];

    if (!lastBuy || !lastBuy.price) {
      return null;
    }

    return Number(lastBuy.price);

  } catch (e: any) {
    console.error(
      `Ошибка получения последней покупки ${symbol}:`,
      e.message || e
    );

    return null;
  }
}
