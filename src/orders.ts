
import { client } from "./client";

// Преобразуем BTCUSDT в формат CCXT BTC/USDT.
function normalizeSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    return symbol;
  }

  const normalized = symbol.replace(/[-_]/g, "").toUpperCase();

  const markets = Object.values(client.markets || {}) as any[];

  const market = markets.find((item) => {
    const marketSymbol = item.symbol?.replace("/", "").replace(":", "").toUpperCase();
    const marketId = item.id?.replace(/[-_]/g, "").toUpperCase();

    return marketSymbol === normalized || marketId === normalized;
  });

  if (!market) {
    throw new Error(`Торговая пара ${symbol} не найдена на ${client.id}`);
  }

  return market.symbol;
}

// Приводим ответ CCXT к формату, который ожидает strategy.ts.
function normalizeOrder(order: any) {
  const timestamp =
    order.timestamp ??
    (order.datetime ? Date.parse(order.datetime) : 0);

  return {
    ...order,
    orderId: order.id,
    side: order.side === "buy" ? "Buy" : "Sell",
    qty: order.amount,
    price: order.price,
    createdTime: String(timestamp),
  };
}

// Лимитный ордер GTC.
export async function placeLimitOrder(
  side: "BUY" | "SELL",
  price: number,
  quantity: string,
  symbol: string,
  priceStep: number,
) {
  try {
    await client.loadMarkets();

    const ccxtSymbol = normalizeSymbol(symbol);
    const ccxtSide = side.toLowerCase();

    // Используем точность и ограничения самой биржи через CCXT.
    const formattedPrice = client.priceToPrecision(
      ccxtSymbol,
      price,
    );

    const formattedQuantity = client.amountToPrecision(
      ccxtSymbol,
      quantity,
    );

    if (
      Number(formattedPrice) <= 0 ||
      Number(formattedQuantity) <= 0
    ) {
      console.error("❌ Некорректная цена или количество после округления");
      return null;
    }

    console.log(
      `[Ордер] ${side} ${formattedPrice} ${formattedQuantity} ${ccxtSymbol}`,
    );

    const order = await client.createOrder(
      ccxtSymbol,
      "limit",
      ccxtSide,
      Number(formattedQuantity),
      Number(formattedPrice),
      {
        timeInForce: "GTC",
      },
    );

    return {
      ...order,
      orderId: order.id,
    };
  } catch (e: any) {
    console.error(
      `Ошибка лимитного ордера ${side}:`,
      e.message || e,
    );
    return null;
  }
}

// Рыночная продажа.
export async function placeMarketSell(
  quantity: number,
  symbol: string,
) {
  try {
    await client.loadMarkets();

    const ccxtSymbol = normalizeSymbol(symbol);

    const formattedQuantity = client.amountToPrecision(
      ccxtSymbol,
      quantity,
    );

    if (Number(formattedQuantity) <= 0) {
      console.error("❌ Некорректное количество для рыночной продажи");
      return null;
    }

    console.log(
      `[ОРДЕР] MARKET SELL ${formattedQuantity} ${ccxtSymbol}`,
    );

    const order = await client.createOrder(
      ccxtSymbol,
      "market",
      "sell",
      Number(formattedQuantity),
    );

    return {
      ...order,
      orderId: order.id,
    };
  } catch (e: any) {
    console.error(
      "Ошибка маркет ордера SELL:",
      e.message || e,
    );
    return null;
  }
}

// Отмена ордера.
export async function cancelOrder(
  orderId: string,
  symbol: string,
) {
  try {
    const ccxtSymbol = normalizeSymbol(symbol);

    await client.cancelOrder(orderId, ccxtSymbol);

    console.log(`Ордер ${orderId} отменен`);
  } catch (e: any) {
    console.error(
      `Не удалось отменить ордер ${orderId}:`,
      e.message || e,
    );
  }
}

// Получение открытых ордеров.
export async function getOpenOrders(symbol: string) {
  try {
    await client.loadMarkets();

    const ccxtSymbol = normalizeSymbol(symbol);

    const orders = await client.fetchOpenOrders(ccxtSymbol);

    const openOrders = orders.map(normalizeOrder);

    const currentBuyOrder = openOrders.filter(
      (order: any) => order.side === "Buy",
    );

    const currentSellOrder = openOrders.filter(
      (order: any) => order.side === "Sell",
    );

    return {
      currentBuyOrder,
      currentSellOrder,
    };
  } catch (e: any) {
    console.error(
      "Ошибка получения открытых ордеров:",
      e.message || e,
    );

    return {
      currentBuyOrder: null,
      currentSellOrder: null,
    };
  }
}
