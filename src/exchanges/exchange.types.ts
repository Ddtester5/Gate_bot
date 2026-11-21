import type { Exchange } from "ccxt";

export type ExchangeId = "gateio" | "bingx" | "bybit";

export interface ExchangeConfig {
  id: ExchangeId;
  apiKey: string;
  secret: string;
  password?: string;
  defaultType?: "spot" | "swap" | "future";
  timeout?: number;
  enableRateLimit?: boolean;
}

export interface ExchangeInstance {
  id: ExchangeId;
  client: Exchange;
}
