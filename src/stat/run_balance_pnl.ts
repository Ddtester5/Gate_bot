import "dotenv/config";
import { calculateMultiPeriodPnl } from "./balance_pnl";
import {
  createExchange,
  initializeExchange,
  type ExchangeId,
} from "../exchanges";
import { EXCHANGES_CONFIG } from "../configs/exchanges.config";

async function main(): Promise<void> {
  const exchangeId = process.argv[2] as ExchangeId | undefined;
  if (!exchangeId) throw new Error("Укажите биржу: gateio, bingx или bybit");

  const botConfig = EXCHANGES_CONFIG[exchangeId];
  if (!botConfig) throw new Error(`Неизвестная биржа: ${exchangeId}`);
  if (!botConfig.exchange.apiKey || !botConfig.exchange.secret) {
    throw new Error(`Не указаны API-ключи для ${exchangeId}`);
  }
  if (!botConfig.coins.length) {
    throw new Error(`Не настроены торговые пары для ${exchangeId}`);
  }

  const exchange = createExchange(botConfig.exchange);
  await initializeExchange(exchange);
  await calculateMultiPeriodPnl(exchange.client, botConfig.coins);
}

main().catch((error: unknown) => {
  console.error(
    "❌ Ошибка формирования отчёта PnL:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
