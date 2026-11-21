import { initializeExchange } from "./src/client";
import { GATE_COINS_CONFIG } from "./src/configs/gate_config";
import { tradeLoop } from "./src/strategy";
import { sleep } from "./src/utils";

async function startMultiBot() {
  try {
    await initializeExchange();

    console.log(
      `[CCXT , GATE] Запуск торговли на ${GATE_COINS_CONFIG.length} парах ...`,
    );

    const tradingPromises = GATE_COINS_CONFIG.map(async (coinConfig, index) => {
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
