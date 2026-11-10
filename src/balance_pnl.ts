
import dayjs from "dayjs";
import { client } from "./client";
import { COINS_CONFIG } from "./config";

type SymbolStats = {
  symbol: string;
  buyVolume: number;
  sellVolume: number;
  buyQty: number;
  sellQty: number;
  tradesCount: number;
  currentPrice: number;
  simulatedVolume: number;
  actualSells: number;
  winTrades: number;
  pnl: number;
};

// Периоды отчёта.
const INTERVALS_CONFIG = [
  { label: "1 час", hours: 1 },
  { label: "2 часа", hours: 2 },
  { label: "6 часов", hours: 6 },
  { label: "12 часов", hours: 12 },
  { label: "1 день", hours: 24 },
  { label: "2 дня", hours: 48 },
  { label: "3 дня", hours: 72 },
  { label: "7 дней", hours: 168 },
  { label: "2 недели", hours: 336 },
  { label: "3 недели", hours: 504 },
  { label: "4 недели", hours: 672 },
];

export function getActiveSymbols(): string[] {
  return COINS_CONFIG.map((c) => c.SYMBOL);
}

export function getUsdtQtyToSymbol(symbol: string): number {
  const config = COINS_CONFIG.find((c) => c.SYMBOL === symbol);
  return config?.USDT_QUANTITY || 0;
}

export function getUsdtToTrades(): number {
  return COINS_CONFIG.reduce(
    (ac, cu) => (ac += cu.USDT_QUANTITY),
    0,
  );
}

// Преобразуем BTCUSDT в BTC/USDT.
function normalizeSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    return symbol;
  }

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
    throw new Error(
      `Торговая пара ${symbol} не найдена на ${client.id}`,
    );
  }

  return market.symbol;
}

// Преобразуем CCXT-сделку в прежний внутренний формат.
function normalizeTrade(trade: any) {
  return {
    ...trade,
    execTime: String(trade.timestamp || 0),
    execPrice: String(trade.price || 0),
    execQty: String(trade.amount || 0),
    side: trade.side === "buy" ? "Buy" : "Sell",
  };
}

// 1. Получение балансов через CCXT.
async function getBalancesMap(): Promise<Record<string, number>> {
  const balance = await client.fetchBalance();

  const map: Record<string, number> = {};

  for (const [coin, amount] of Object.entries(balance.total || {})) {
    const total = Number(amount);

    if (total > 0) {
      map[coin] = total;
    }
  }

  return map;
}

// 2. Получение текущих цен через CCXT.
async function getPriceMap(
  symbols: string[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};

  for (const originalSymbol of symbols) {
    try {
      const symbol = normalizeSymbol(originalSymbol);
      const ticker = await client.fetchTicker(symbol);

      const price = Number(ticker.last);

      if (price > 0) {
        map[originalSymbol] = price;
      }
    } catch (error: any) {
      console.error(
        `Ошибка получения цены ${originalSymbol}:`,
        error.message || error,
      );
    }
  }

  return map;
}

// 3. Получение истории сделок за указанный период.
// Используем пагинацию CCXT через since и limit.
async function getTradesLastDays(
  originalSymbol: string,
  daysWindow = 30,
): Promise<any[]> {
  const allTrades: any[] = [];

  const symbol = normalizeSymbol(originalSymbol);

  const now = Date.now();
  const targetStartTime =
    now - daysWindow * 24 * 60 * 60 * 1000;

  const LIMIT = 100;
  const MAX_PAGES = 500;

  let since = targetStartTime;

  const seenTrades = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const trades = await client.fetchMyTrades(
        symbol,
        since,
        LIMIT,
      );

      if (!trades || trades.length === 0) {
        break;
      }

      let latestTimestamp = since;

      for (const trade of trades) {
        if (!trade.timestamp) {
          continue;
        }

        if (trade.timestamp < targetStartTime) {
          continue;
        }

        if (trade.timestamp > now) {
          continue;
        }

        const uniqueKey = trade.id
          ? String(trade.id)
          : [
              trade.timestamp,
              trade.side,
              trade.price,
              trade.amount,
            ].join("_");

        if (!seenTrades.has(uniqueKey)) {
          seenTrades.add(uniqueKey);
          allTrades.push(normalizeTrade(trade));
        }

        if (trade.timestamp > latestTimestamp) {
          latestTimestamp = trade.timestamp;
        }
      }

      // Защита от бесконечной пагинации,
      // если биржа повторяет одну и ту же страницу.
      if (latestTimestamp < since) {
        break;
      }

      if (latestTimestamp === since) {
        break;
      }

      // Если получено меньше лимита, следующие страницы
      // обычно уже не нужны.
      if (trades.length < LIMIT) {
        break;
      }

      // Следующий запрос начинаем после последней сделки.
      since = latestTimestamp + 1;

    } catch (error: any) {
      console.error(
        `Ошибка загрузки истории сделок ${originalSymbol}:`,
        error.message || error,
      );

      break;
    }
  }

  // Сортируем от старых сделок к новым.
  return allTrades.sort(
    (a, b) => Number(a.execTime) - Number(b.execTime),
  );
}

// 4. Расчёт статистики периода.
// Комиссия 0.1% оставлена как оценка, как в исходной версии.
// Это не обязательно совпадает с фактической комиссией Gate.io.
function calculateStatsForPeriod(
  symbol: string,
  trades: any[],
  currentPrice: number,
  realWalletBalance: number,
): SymbolStats {
  const stats: SymbolStats = {
    symbol,
    buyVolume: 0,
    sellVolume: 0,
    buyQty: 0,
    sellQty: 0,
    tradesCount: trades.length,
    currentPrice,
    simulatedVolume: 0,
    actualSells: 0,
    winTrades: 0,
    pnl: 0,
  };

  if (trades.length === 0) {
    return stats;
  }

  const FEE_RATE = 0.001;

  const earliestPrice = Number(trades[0].execPrice);

  let rollingBuyQtyWithFee = 0;
  let rollingBuyVol = 0;

  for (const trade of trades) {
    const price = Number(trade.execPrice);
    const quantity = Number(trade.execQty);

    const rawValue = price * quantity;

    if (trade.side === "Buy") {
      stats.buyVolume += rawValue;

      const netQty = quantity * (1 - FEE_RATE);

      stats.buyQty += netQty;
      rollingBuyQtyWithFee += netQty;
      rollingBuyVol += rawValue;

    } else {
      const netValue = rawValue * (1 - FEE_RATE);

      stats.sellVolume += netValue;
      stats.sellQty += quantity;
      stats.actualSells += 1;

      const currentAvgBuyPrice =
        rollingBuyVol / (rollingBuyQtyWithFee || 1);

      if (price > currentAvgBuyPrice) {
        stats.winTrades += 1;
      }
    }
  }

  const walletValue = realWalletBalance * currentPrice;

  const totalSellVolumeWithWallet =
    stats.sellVolume + walletValue;

  const totalSellQtyWithWallet =
    stats.sellQty + realWalletBalance;

  const qtyDelta =
    stats.buyQty - totalSellQtyWithWallet;

  let historyAdjustment = 0;

  if (qtyDelta > 0) {
    historyAdjustment = qtyDelta * earliestPrice;
  } else if (qtyDelta < 0) {
    historyAdjustment = -Math.abs(qtyDelta) * earliestPrice;
  }

  stats.pnl =
    totalSellVolumeWithWallet -
    stats.buyVolume +
    historyAdjustment;

  stats.simulatedVolume =
    walletValue + historyAdjustment;

  return stats;
}

// 5. Главная функция мультипериодного отчёта.
async function calculateMultiPeriodPnl() {
  try {
    await client.loadMarkets();

    console.log("Количество торговых пар:", COINS_CONFIG.length);
    console.log("Общий объём торговли:", getUsdtToTrades());

    const symbols = getActiveSymbols();

    const prices = await getPriceMap(symbols);
    const balances = await getBalancesMap();

    const now = Date.now();

    const periodResults: Record<
      number,
      Record<string, SymbolStats>
    > = {};

    INTERVALS_CONFIG.forEach((config) => {
      periodResults[config.hours] = {};
    });

    for (const symbol of symbols) {
      console.log(`Загрузка истории сделок: ${symbol}`);

      // Загружаем историю за 30 дней.
      const allTrades30d = await getTradesLastDays(symbol, 30);

      if (allTrades30d.length === 0) {
        console.log(`Нет сделок за последние 30 дней: ${symbol}`);
        continue;
      }

      const currentPrice = prices[symbol] || 0;

      const baseAsset = symbol
        .replace("/", "")
        .replace(/(USDT|USD|BUSD)$/, "");

      const realWalletBalance = balances[baseAsset] || 0;

      for (const config of INTERVALS_CONFIG) {
        const cutoffTime =
          now - config.hours * 60 * 60 * 1000;

        const filteredTrades = allTrades30d.filter(
          (trade) =>
            Number(trade.execTime) >= cutoffTime,
        );

        if (filteredTrades.length > 0) {
          periodResults[config.hours][symbol] =
            calculateStatsForPeriod(
              symbol,
              filteredTrades,
              currentPrice,
              realWalletBalance,
            );
        }
      }
    }

    // Вывод отчёта.
    console.clear();

    console.log(
      "================================================================",
    );

    console.log(
      ` МУЛЬТИПЕРИОДНЫЙ ОТЧЕТ (Текущее время: ${dayjs().format("HH:mm:ss")})`,
    );

    console.log(
      "================================================================\n",
    );

    for (const config of INTERVALS_CONFIG) {
      const statsMap = periodResults[config.hours] || {};

      let totalSessionPnl = 0;

      const rows = Object.values(statsMap).map((stats) => {
        totalSessionPnl += stats.pnl;

        return {
          Монета: stats.symbol,
          "PnL (USDT)": stats.pnl.toFixed(2),
          Сделки: stats.tradesCount,
          "Обьем круга (USDT)": getUsdtQtyToSymbol(
            stats.symbol,
          ),
        };
      });

      if (rows.length === 0) {
        console.log(
          `⏱️ ПЕРИОД: ${config.label} — Нет сделок за этот период.`,
        );

        console.log(
          "----------------------------------------------------------------\n",
        );

        continue;
      }

      console.log(`⏱️ ПЕРИОД: ${config.label}`);

      console.table(rows);

      console.log(
        `ИТОГ ЗА ${config.label}: ${
          totalSessionPnl >= 0 ? "+" : ""
        }${totalSessionPnl.toFixed(2)} USDT`,
      );

      console.log(
        "----------------------------------------------------------------\n",
      );
    }

  } catch (error: any) {
    console.error(
      "Ошибка формирования отчёта PnL:",
      error.message || error,
    );
  }
}

calculateMultiPeriodPnl();
