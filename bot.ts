import "dotenv/config";

import { createExchange, initializeExchange } from "./src/exchanges";

import type { ExchangeId } from "./src/exchanges";

import { EXCHANGES_CONFIG } from "./src/configs/exchanges.config";
import { tradeLoop } from "./src/strategy";
import { sleep } from "./src/utils";

async function startBot(exchangeId: ExchangeId): Promise<void> {
  const botConfig = EXCHANGES_CONFIG[exchangeId];

  if (!botConfig) {
    throw new Error(`Неизвестная биржа: ${exchangeId}`);
  }

  if (!botConfig.exchange.apiKey || !botConfig.exchange.secret) {
    throw new Error(`Не указаны API-ключи для ${exchangeId}`);
  }

  if (botConfig.coins.length === 0) {
    throw new Error(`Не настроены торговые пары для ${exchangeId}`);
  }

  // Создаём отдельный клиент
  const exchange = createExchange(botConfig.exchange);

  // Загружаем рынки
  await initializeExchange(exchange);

  console.log(
    `[CCXT, ${exchangeId.toUpperCase()}] Запуск торговли на ${botConfig.coins.length} парах...`,
  );

  const tradingPromises = botConfig.coins.map(async (coinConfig, index) => {
    await sleep(index * 4444);

    return tradeLoop(exchange.client, coinConfig);
  });

  await Promise.all(tradingPromises);
}

// Получаем биржу из аргумента командной строки
const exchangeId = process.argv[2] as ExchangeId;

if (!exchangeId) {
  console.error("❌ Укажите биржу: gateio, bingx или bybit");
  process.exit(1);
}

startBot(exchangeId).catch((error) => {
  console.error("❌ Ошибка запуска бота:", error);
  process.exit(1);
});
