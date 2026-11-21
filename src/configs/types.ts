export interface CoinConfig {
  SYMBOL: string;
  USDT_QUANTITY: number;
  STOP_LOSS_PCT: number;
  SELL_RANGE: number;
  BUY_RANGE: number;
  TRADE_INTERVAL_MS: number;
  INTERVAL_AFTER_STOPLOSS_MS: number;
  ORDER_TIMEOUT_MS: number;
  ANALIZE_INTERVAL_CANDLES: number;
  CANDLES_INTERVAL: string;
  LOOCAL_LOOKBACK: number;
  MIN_RANGE_PCT: number;
  MAX_RANGE_PCT: number;
  MAX_TREND_FACTOR: number;
}
