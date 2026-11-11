import * as dotenv from "dotenv";

dotenv.config();

// Выбор биржи. Сейчас используем Gate.io через CCXT.
export const EXCHANGE_ID = process.env.EXCHANGE_ID || "gateio";

// Ключи Gate.io.
// API_KEY и SECRET_KEY оставлены как общие имена,
// чтобы постепенно переводить остальные файлы без массовых изменений.
export const API_KEY = process.env.GATE_API_KEY || process.env.API_KEY || "";

export const SECRET_KEY =
  process.env.GATE_SECRET_KEY || process.env.SECRET_KEY || "";

if (!API_KEY || !SECRET_KEY) {
  console.error(
    "❌ Ошибка: Укажите GATE_API_KEY и GATE_SECRET_KEY в файле .env",
  );
  process.exit(1);
}

// Интерфейс для индивидуальных настроек каждой монеты
export interface CoinConfig {
  SYMBOL: string;
  USDT_QUANTITY: number;
  QTY_STEP: number;
  PRICE_STEP: number;
  STOP_LOSS_PCT: number;
  SELL_RANGE: number;
  BUY_RANGE: number;
  MIN_NOTIONAL: number;
  ASSET_NAME: string;
  TRADE_INTERVAL_MS: number;
  INTERVAL_AFTER_STOPLOSS_MS: number;
  ORDER_TIMEOUT_MS: number;

  ANALIZE_INTERVAL_CANDLES: number; // Необязательный параметр, если нужно изменить интервал анализа
  CANDLES_INTERVAL: string; // Необязательный параметр, если нужно изменить интервал свечей для анализа
  LOOCAL_LOOKBACK: number;
  MIN_RANGE_PCT: number; // Необязательный параметр для минимального диапазона в процентах
  MAX_RANGE_PCT: number; // Необязательный параметр для максимального диапазона в процентах
  MAX_TREND_FACTOR: number; // Необязательный параметр для максимального трендового фактора
}

export const COINS_CONFIG: CoinConfig[] = [
  {
    SYMBOL: "ALEUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.0001,
    STOP_LOSS_PCT: 3,
    SELL_RANGE: 0.9,
    BUY_RANGE: 0.15,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "ALE",
    TRADE_INTERVAL_MS: 10000,
    INTERVAL_AFTER_STOPLOSS_MS: 2 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 10 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 500,
    CANDLES_INTERVAL: "5m",
    LOOCAL_LOOKBACK: 500,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 4,
    MAX_TREND_FACTOR: 0.99,
  },
  {
    SYMBOL: "PORUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.00001,
    STOP_LOSS_PCT: 10,
    SELL_RANGE: 0.6,
    BUY_RANGE: 0.1,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "POR",
    TRADE_INTERVAL_MS: 50000,
    INTERVAL_AFTER_STOPLOSS_MS: 5 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 30 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 500,
    CANDLES_INTERVAL: "30m",
    LOOCAL_LOOKBACK: 500,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 100,
    MAX_TREND_FACTOR: 0.95,
  },

  {
    SYMBOL: "PAALUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.000001,
    STOP_LOSS_PCT: 30,
    SELL_RANGE: 0.6,
    BUY_RANGE: 0.1,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "PAAL",
    TRADE_INTERVAL_MS: 60000,
    INTERVAL_AFTER_STOPLOSS_MS: 5 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 30 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 500,
    CANDLES_INTERVAL: "5m",
    LOOCAL_LOOKBACK: 500,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 500,
    MAX_TREND_FACTOR: 0.99,
  },
  {
    SYMBOL: "FHEUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.00001,
    STOP_LOSS_PCT: 15,
    SELL_RANGE: 0.5,
    BUY_RANGE: 0.01,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "FHE",
    TRADE_INTERVAL_MS: 60000,
    INTERVAL_AFTER_STOPLOSS_MS: 5 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 30 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 300,
    CANDLES_INTERVAL: "30m",
    LOOCAL_LOOKBACK: 300,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 30,
    MAX_TREND_FACTOR: 0.99,
  },
   {
    SYMBOL: "GLMRUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.000001,
    STOP_LOSS_PCT: 20,
    SELL_RANGE: 0.5,
    BUY_RANGE: 0.05,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "GLMR",
    TRADE_INTERVAL_MS: 60000,
    INTERVAL_AFTER_STOPLOSS_MS: 5 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 30 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 300,
    CANDLES_INTERVAL: "30m",
    LOOCAL_LOOKBACK: 300,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 70,
    MAX_TREND_FACTOR: 0.99,
  },
    {
    SYMBOL: "XNLUSDT",
    USDT_QUANTITY: 10,
    QTY_STEP: 0.01,
    PRICE_STEP: 0.00000001,
    STOP_LOSS_PCT: 20,
    SELL_RANGE: 0.9,
    BUY_RANGE: 0.15,
    MIN_NOTIONAL: 3.1,
    ASSET_NAME: "XNL",
    TRADE_INTERVAL_MS: 60000,
    INTERVAL_AFTER_STOPLOSS_MS: 5 * 60 * 60 * 1000,
    ORDER_TIMEOUT_MS: 30 * 60 * 1000,

    ANALIZE_INTERVAL_CANDLES: 500,
    CANDLES_INTERVAL: "5m",
    LOOCAL_LOOKBACK: 500,
    MIN_RANGE_PCT: 0,
    MAX_RANGE_PCT: 100,
    MAX_TREND_FACTOR: 0.99,
  },
];
