import ccxt from "ccxt";
import type { Exchange } from "ccxt";
import type {
  ExchangeConfig,
  ExchangeId,
  ExchangeInstance,
} from "./exchange.types";

const exchangeConstructors: Record<ExchangeId, new (config: any) => Exchange> =
  {
    gateio: ccxt.gateio,
    bingx: ccxt.bingx,
    bybit: ccxt.bybit,
  };

export function createExchange(config: ExchangeConfig): ExchangeInstance {
  const ExchangeClass = exchangeConstructors[config.id];

  if (!ExchangeClass) {
    throw new Error(`❌ CCXT не поддерживает биржу: ${config.id}`);
  }

  const client = new ExchangeClass({
    apiKey: config.apiKey,
    secret: config.secret,
    password: config.password,
    enableRateLimit: config.enableRateLimit ?? true,
    timeout: config.timeout ?? 60000,
    options: {
      defaultType: config.defaultType ?? "spot",
    },
  });

  return {
    id: config.id,
    client,
  };
}

export async function initializeExchange(
  exchange: ExchangeInstance,
): Promise<void> {
  await exchange.client.loadMarkets();

  console.log(`✅ Подключено к бирже: ${exchange.id}`);
}
