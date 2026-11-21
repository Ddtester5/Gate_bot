import type { ExchangeConfig, ExchangeId } from "../exchanges";
import type { CoinConfig } from "./types";

import { GATE_COINS_CONFIG } from "./gate_config";
import { BYBIT_COINS_CONFIG } from "./bybit_config";

interface BotExchangeConfig {
  exchange: ExchangeConfig;
  coins: CoinConfig[];
}

export const EXCHANGES_CONFIG: Record<ExchangeId, BotExchangeConfig> = {
  gateio: {
    exchange: {
      id: "gateio",
      apiKey: process.env.GATE_API_KEY || "",
      secret: process.env.GATE_SECRET_KEY || "",
      defaultType: "spot",
      enableRateLimit: true,
      timeout: 60000,
    },
    coins: GATE_COINS_CONFIG,
  },

  bingx: {
    exchange: {
      id: "bingx",
      apiKey: process.env.BINGX_API_KEY || "",
      secret: process.env.BINGX_SECRET_KEY || "",
      defaultType: "spot",
      enableRateLimit: true,
      timeout: 60000,
    },
    coins: [],
  },

  bybit: {
    exchange: {
      id: "bybit",
      apiKey: process.env.BYBIT_API_KEY || "",
      secret: process.env.BYBIT_SECRET_KEY || "",
      defaultType: "spot",
      enableRateLimit: true,
      timeout: 60000,
    },
    coins: BYBIT_COINS_CONFIG,
  },
};
