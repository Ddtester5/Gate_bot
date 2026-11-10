
import { COINS_CONFIG } from "./src/config";
import { tradeLoop } from "./src/strategy";
import { initializeExchange } from "./src/client";
import { sleep } from "./src/utils";

async function startMultiBot() {
  try {
    // Сначала подключаемся к бирже и загружаем список рынков
    await initializeExchange();

    console.log(
      `[CCXT] Запуск торговли на ${COINS_CONFIG.length} парах...`,
    );

    // Запуск независимого цикла для каждой монеты параллельно
    // Задержка в 4.4 секунды между парами снижает нагрузку на API
    const tradingPromises = COINS_CONFIG.map(async (coinConfig, index) => {
      await sleep(index * 4444);
      return tradeLoop(coinConfig);
    });

    await Promise.all(tradingPromises);
  } catch (error) {
    console.error("❌ Ошибка запуска бота:", error);
    process.exit(1);
  }
}

startMultiBot();
