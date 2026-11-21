import type { Exchange } from "ccxt";
import dayjs from "dayjs";
import type { CoinConfig } from "../configs/types";

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
type NormalizedTrade = {
  id?: string;
  timestamp: number;
  price: number;
  amount: number;
  side: "Buy" | "Sell";
  execTime: string;
  execPrice: string;
  execQty: string;
};

const INTERVALS_CONFIG = [
  { label: "6 часов", hours: 6 },
  { label: "24 часа", hours: 24 },
  { label: "3 дня", hours: 72 },
  { label: "7 дней", hours: 168 },
  { label: "14 дней", hours: 336 },
  { label: "21 день", hours: 504 },
  { label: "30 дней", hours: 720 },
];
const HISTORY_DAYS = 30;
const FEE_RATE = 0.001; // Исходная комиссия 0.1%, оставлена без изменения.
const LIMIT = 1000;
const MAX_PAGES_PER_CHUNK = 50;
const CHUNK_MS = 7 * 24 * 60 * 60 * 1000;

export function getActiveSymbols(coinsConfig: CoinConfig[]): string[] {
  return coinsConfig.map((coin) => coin.SYMBOL);
}
export function getUsdtQtyToSymbol(
  symbol: string,
  coinsConfig: CoinConfig[],
): number {
  return coinsConfig.find((coin) => coin.SYMBOL === symbol)?.USDT_QUANTITY ?? 0;
}
export function getUsdtToTrades(coinsConfig: CoinConfig[]): number {
  return coinsConfig.reduce((total, coin) => total + coin.USDT_QUANTITY, 0);
}

function normalizeSymbol(client: Exchange, input: string): string {
  const normalized = input.replace(/[/:_-]/g, "").toUpperCase();
  const markets = Object.values(client.markets ?? {});
  const defaultType =
    (client.options as Record<string, unknown> | undefined)?.defaultType ??
    "spot";
  const preferred = markets.filter((market) => market.type === defaultType);
  const pool = preferred.length ? preferred : markets;

  const found = pool.find((market) => {
    const marketSymbol = market.symbol?.replace(/[/:_-]/g, "").toUpperCase();
    const marketId = market.id?.replace(/[/:_-]/g, "").toUpperCase();
    return (
      market.symbol === input ||
      marketSymbol === normalized ||
      marketId === normalized
    );
  });
  if (!found)
    throw new Error(`Торговая пара ${input} не найдена на ${client.id}`);
  return found.symbol;
}

function normalizeTrade(trade: any): NormalizedTrade {
  return {
    ...(trade.id ? { id: String(trade.id) } : {}),
    timestamp: Number(trade.timestamp ?? 0),
    price: Number(trade.price ?? 0),
    amount: Number(trade.amount ?? 0),
    execTime: String(trade.timestamp ?? 0),
    execPrice: String(trade.price ?? 0),
    execQty: String(trade.amount ?? 0),
    side: trade.side === "buy" ? "Buy" : "Sell",
  };
}

async function getBalancesMap(
  client: Exchange,
): Promise<Record<string, number>> {
  const balance = await client.fetchBalance();
  const result: Record<string, number> = {};
  for (const [asset, amount] of Object.entries(balance.total ?? {})) {
    const total = Number(amount);
    if (Number.isFinite(total) && total > 0) result[asset] = total;
  }
  return result;
}

async function getPriceMap(
  client: Exchange,
  symbols: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const original of symbols) {
    try {
      const ticker = await client.fetchTicker(
        normalizeSymbol(client, original),
      );
      const price = Number(ticker.last);
      if (Number.isFinite(price) && price > 0) result[original] = price;
    } catch (error: unknown) {
      console.error(
        `Ошибка получения цены ${original}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return result;
}

/**
 * Gate.io требует короткие окна from/until — оставляем чанки по 7 дней.
 * Параметр until передаётся только Gate.io; для BingX/Bybit используем since/limit.
 */
async function getTradesLastDays(
  client: Exchange,
  originalSymbol: string,
  daysWindow = HISTORY_DAYS,
): Promise<NormalizedTrade[]> {
  const result: NormalizedTrade[] = [];
  const symbol = normalizeSymbol(client, originalSymbol);
  const now = Date.now();
  const startTime = now - daysWindow * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  let chunkStart = startTime;

  while (chunkStart < now) {
    const chunkEnd = Math.min(chunkStart + CHUNK_MS, now);
    let since = chunkStart;

    for (let page = 0; page < MAX_PAGES_PER_CHUNK; page++) {
      let trades: any[];
      try {
        const params =
          client.id === "gateio" ? ({ until: chunkEnd } as any) : {};
        trades = await client.fetchMyTrades(symbol, since, LIMIT, params);
      } catch (error: unknown) {
        console.error(
          `[${client.id}:${originalSymbol}] fetchMyTrades:`,
          error instanceof Error ? error.message : String(error),
        );
        break;
      }
      if (!trades?.length) break;

      let latest = since;
      for (const trade of trades) {
        const timestamp = Number(trade.timestamp ?? 0);
        if (!timestamp || timestamp < startTime || timestamp > now) continue;
        const key = trade.id
          ? String(trade.id)
          : [timestamp, trade.side, trade.price, trade.amount].join("_");
        if (!seen.has(key)) {
          seen.add(key);
          result.push(normalizeTrade(trade));
        }
        if (timestamp > latest) latest = timestamp;
      }
      if (latest <= since || trades.length < LIMIT) break;
      since = latest + 1;
    }

    if (chunkEnd >= now) break;
    chunkStart = chunkEnd + 1;
  }
  return result.sort((a, b) => a.timestamp - b.timestamp);
}

function calculateStatsForPeriod(
  symbol: string,
  trades: NormalizedTrade[],
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
  if (!trades.length) return stats;

  const firstTrade = trades[0];

  if (!firstTrade) {
    return stats;
  }

  const earliestPrice = firstTrade.price;
  let rollingBuyQtyWithFee = 0;
  let rollingBuyVol = 0;

  for (const trade of trades) {
    const rawValue = trade.price * trade.amount;
    if (trade.side === "Buy") {
      stats.buyVolume += rawValue;
      const netQty = trade.amount * (1 - FEE_RATE);
      stats.buyQty += netQty;
      rollingBuyQtyWithFee += netQty;
      rollingBuyVol += rawValue;
    } else {
      stats.sellVolume += rawValue * (1 - FEE_RATE);
      stats.sellQty += trade.amount;
      stats.actualSells += 1;
      const avgBuyPrice = rollingBuyVol / (rollingBuyQtyWithFee || 1);
      if (trade.price > avgBuyPrice) stats.winTrades += 1;
    }
  }

  const walletValue = realWalletBalance * currentPrice;
  const totalSellVolume = stats.sellVolume + walletValue;
  const totalSellQty = stats.sellQty + realWalletBalance;
  const qtyDelta = stats.buyQty - totalSellQty;
  let historyAdjustment = 0;
  if (qtyDelta > 0) historyAdjustment = qtyDelta * earliestPrice;
  else if (qtyDelta < 0)
    historyAdjustment = -Math.abs(qtyDelta) * earliestPrice;

  stats.pnl = totalSellVolume - stats.buyVolume + historyAdjustment;
  stats.simulatedVolume = walletValue + historyAdjustment;
  return stats;
}

export async function calculateMultiPeriodPnl(
  client: Exchange,
  coinsConfig: CoinConfig[],
): Promise<void> {
  if (!client.markets || Object.keys(client.markets).length === 0) {
    throw new Error(
      `Рынки ${client.id} не загружены. Сначала вызовите initializeExchange().`,
    );
  }

  console.log(`Биржа: ${client.id}`);
  console.log("Количество торговых пар:", coinsConfig.length);
  console.log("Общий объём торговли:", getUsdtToTrades(coinsConfig));

  const symbols = getActiveSymbols(coinsConfig);
  const prices = await getPriceMap(client, symbols);
  const balances = await getBalancesMap(client);
  const now = Date.now();
  const periodResults: Record<number, Record<string, SymbolStats>> = {};
  for (const config of INTERVALS_CONFIG) periodResults[config.hours] = {};

  for (const symbol of symbols) {
    let trades: NormalizedTrade[] = [];
    try {
      trades = await getTradesLastDays(client, symbol, HISTORY_DAYS);
    } catch (error: unknown) {
      console.error(
        `Не удалось загрузить историю ${symbol}:`,
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }
    if (!trades.length) {
      console.log(`Нет сделок за последние ${HISTORY_DAYS} дней: ${symbol}`);
      continue;
    }

    const currentPrice = prices[symbol] ?? 0;
    const market = client.market(normalizeSymbol(client, symbol));
    const walletBalance = balances[market.base] ?? 0;

    for (const config of INTERVALS_CONFIG) {
      const cutoff = now - config.hours * 60 * 60 * 1000;
      const filtered = trades.filter((trade) => trade.timestamp >= cutoff);
      if (filtered.length) {
        (periodResults[config.hours] ??= {})[symbol] = calculateStatsForPeriod(
          symbol,
          filtered,
          currentPrice,
          walletBalance,
        );
      }
    }
  }

  console.log(
    "\\n================================================================",
  );
  console.log(
    ` МУЛЬТИПЕРИОДНЫЙ ОТЧЕТ (${dayjs().format("YYYY-MM-DD HH:mm:ss")})`,
  );
  console.log(
    "================================================================\\n",
  );

  for (const config of INTERVALS_CONFIG) {
    const statsMap = periodResults[config.hours] ?? {};
    let totalPnl = 0;
    let totalTrades = 0;
    const rows = Object.values(statsMap).map((stats) => {
      totalPnl += stats.pnl;
      totalTrades += stats.tradesCount;
      return {
        Монета: stats.symbol,
        "PnL (USDT)": stats.pnl.toFixed(2),
        Сделки: stats.tradesCount,
        "Объем круга (USDT)": getUsdtQtyToSymbol(stats.symbol, coinsConfig),
      };
    });

    if (!rows.length) {
      console.log(`⏱️ ПЕРИОД: ${config.label} — Нет сделок за этот период.`);
      console.log(
        "----------------------------------------------------------------\\n",
      );
      continue;
    }
    console.log(`⏱️ ПЕРИОД: ${config.label}`);
    console.table(rows);
    console.log(
      `ИТОГ ЗА ${config.label}: ${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USDT  |  сделок: ${totalTrades}`,
    );
    console.log(
      "----------------------------------------------------------------\\n",
    );
  }
}
