
import type { CoinConfig } from "./config";
import { analyzeMarket } from "./analize_market";
import {
  cancelOrder,
  getOpenOrders,
  placeLimitOrder,
  placeMarketSell,
} from "./orders";
import { sleep } from "./utils";
import { getAssetBalance } from "./wallet";
import { getLastBuyPrice } from "./trades";

export async function tradeLoop(config: CoinConfig) {
  const {
    SYMBOL,
    USDT_QUANTITY,
    QTY_STEP,
    PRICE_STEP,
    STOP_LOSS_PCT,
    MIN_NOTIONAL,
    ASSET_NAME,
    INTERVAL_AFTER_STOPLOSS_MS,
    ORDER_TIMEOUT_MS,
    TRADE_INTERVAL_MS,
    ANALIZE_INTERVAL_CANDLES,
    CANDLES_INTERVAL,
    MAX_RANGE_PCT,
    MAX_TREND_FACTOR,
    MIN_RANGE_PCT,
    BUY_RANGE,
    SELL_RANGE,
    LOOCAL_LOOKBACK,
  } = config;

  console.log(
    `🚀 Робот запущен для пары ${SYMBOL} через CCXT.`,
  );

  while (true) {
    try {
      // ==========================================
      // 1. СБОР СВЕЖИХ ДАННЫХ С БИРЖИ
      // ==========================================

      const market = await analyzeMarket(
        SYMBOL,
        ANALIZE_INTERVAL_CANDLES,
        LOOCAL_LOOKBACK,
        MIN_RANGE_PCT,
        MAX_RANGE_PCT,
        MAX_TREND_FACTOR,
        CANDLES_INTERVAL,
      );

      if (!market) {
        await sleep(TRADE_INTERVAL_MS);
        continue;
      }

      const {
        currentBuyOrder,
        currentSellOrder,
      } = await getOpenOrders(SYMBOL);

      const {
        coinBalance,
        usdtBalance,
      } = await getAssetBalance(ASSET_NAME);

      if (
        coinBalance === null ||
        usdtBalance === null ||
        currentBuyOrder === null ||
        currentSellOrder === null
      ) {
        console.log(
          `⚠️ [${SYMBOL}] Не удалось собрать все данные с биржи. Пропускаем тик...`,
        );

        await sleep(TRADE_INTERVAL_MS);
        continue;
      }

      const safeCoinBalance = coinBalance || 0;
      const currentPrice = market.currentPrice;

      const coinValueInUsdt =
        safeCoinBalance * currentPrice;

      // Рассчитываем объём средств в открытых ордерах.
      const usdtToBuyOrders = currentBuyOrder.reduce(
        (sum: number, order: any) =>
          sum + Number(order.qty) * Number(order.price),
        0,
      );

      const usdtToSellOrders = currentSellOrder.reduce(
        (sum: number, order: any) =>
          sum + Number(order.qty) * Number(order.price),
        0,
      );

      // ==========================================
      // 2. СТОП-ЛОСС
      // ==========================================

      if (coinValueInUsdt >= MIN_NOTIONAL) {
        const buyPrice = await getLastBuyPrice(SYMBOL);

        // Если история сделок недоступна, не рассчитываем
        // стоп-лосс от нулевой цены.
        if (buyPrice !== null && buyPrice > 0) {
          const stopPrice =
            buyPrice * (1 - STOP_LOSS_PCT / 100);

          if (currentPrice <= stopPrice) {
            console.log(
              `🚨 [${SYMBOL}] СТОП-ЛОСС! Цена ${currentPrice} <= ${stopPrice}. Экстренный выход по рынку.`,
            );

            for (const order of currentBuyOrder) {
              await cancelOrder(order.orderId, SYMBOL);
            }

            for (const order of currentSellOrder) {
              await cancelOrder(order.orderId, SYMBOL);
            }

            // Количество дополнительно округляется
            // по точности рынка внутри CCXT.
            const qtyStepNum = Number(QTY_STEP);

            const decimalsQty =
              qtyStepNum < 1 && qtyStepNum > 0
                ? Math.round(-Math.log10(qtyStepNum))
                : 0;

            const formattedStopQty =
              safeCoinBalance.toFixed(decimalsQty);

            if (Number(formattedStopQty) > 0) {
              await placeMarketSell(
                Number(formattedStopQty),
                SYMBOL,
              );
            }

            console.log(
              `😴 [${SYMBOL}] Пауза после стоп-лосса.`,
            );

            await sleep(INTERVAL_AFTER_STOPLOSS_MS);
            continue;
          }
        } else {
          console.log(
            `⚠️ [${SYMBOL}] Не удалось получить последнюю цену покупки. Стоп-лосс не рассчитываем.`,
          );
        }
      }

      // ==========================================
      // 3. КОНТРОЛЬ ВРЕМЕНИ ОТКРЫТЫХ ОРДЕРОВ
      // ==========================================

      if (currentBuyOrder.length > 0) {
        for (const order of currentBuyOrder) {
          const buyAge = Date.now() - Number(order.createdTime);

          if (buyAge >= ORDER_TIMEOUT_MS) {
            console.log(
              `⏰ [${SYMBOL}] Ордер BUY просрочен. Отменяем.`,
            );

            await cancelOrder(order.orderId, SYMBOL);
          }
        }
      }

      if (currentSellOrder.length > 0) {
        for (const order of currentSellOrder) {
          const sellAge =
            Date.now() - Number(order.createdTime);

          if (sellAge >= ORDER_TIMEOUT_MS) {
            console.log(
              `⏰ [${SYMBOL}] Ордер SELL просрочен. Отменяем.`,
            );

            await cancelOrder(order.orderId, SYMBOL);
          }
        }
      }

      // ==========================================
      // 4. ВЫСТАВЛЕНИЕ ТЕЙК-ПРОФИТА
      // ==========================================

      if (
        coinValueInUsdt >= MIN_NOTIONAL &&
        currentSellOrder.length === 0
      ) {
        let targetSellPrice =
          market.localMinPrice +
          market.localRange * SELL_RANGE;

        const minAllowedSellPrice =
          market.currentPrice + PRICE_STEP;

        if (targetSellPrice < minAllowedSellPrice) {
          targetSellPrice = minAllowedSellPrice;
        }

        const qtyStepNum = Number(QTY_STEP);

        const decimalsQty =
          qtyStepNum < 1 && qtyStepNum > 0
            ? Math.round(-Math.log10(qtyStepNum))
            : 0;

        const factor = Math.pow(10, decimalsQty);

        const formattedSellQty = (
          Math.floor(safeCoinBalance * factor) / factor
        ).toFixed(decimalsQty);

        if (Number(formattedSellQty) <= 0) {
          console.log(
            `⚠️ [${SYMBOL}] Недостаточный баланс для продажи.`,
          );

          await sleep(TRADE_INTERVAL_MS);
          continue;
        }

        const sellOrder = await placeLimitOrder(
          "SELL",
          targetSellPrice,
          formattedSellQty,
          SYMBOL,
          PRICE_STEP,
        );

        if (sellOrder?.orderId) {
          console.log(
            `💰 [${SYMBOL}] Выставлен Take-Profit: ${formattedSellQty} ${ASSET_NAME} по цене ${targetSellPrice}`,
          );
        }
      }

      // ==========================================
      // 5. ВЫСТАВЛЕНИЕ ОРДЕРА НА ПОКУПКУ
      // ==========================================

      if (
        usdtBalance >= MIN_NOTIONAL &&
        market.isSideways &&
        currentBuyOrder.length === 0
      ) {
        const usdtToTrade =
          Math.min(usdtBalance, USDT_QUANTITY) -
          usdtToBuyOrders -
          usdtToSellOrders -
          coinValueInUsdt;

        if (usdtToTrade < MIN_NOTIONAL) {
          await sleep(TRADE_INTERVAL_MS);
          continue;
        }

        const coinQty =
          (usdtToTrade * 0.99) / market.currentPrice;

        const decimalsQty =
          QTY_STEP.toString().split(".")[1]?.length || 0;

        const formattedQty =
          coinQty.toFixed(decimalsQty);

        let targetBuyPrice =
          market.localMinPrice +
          market.localRange * BUY_RANGE;

        const maxAllowedBuyPrice =
          market.currentPrice - PRICE_STEP;

        if (targetBuyPrice > maxAllowedBuyPrice) {
          targetBuyPrice = maxAllowedBuyPrice;
        }

        console.log(
          `📈 [${SYMBOL}] Выставляем BUY: ${formattedQty} ${ASSET_NAME} по цене ${targetBuyPrice}`,
        );

        const order = await placeLimitOrder(
          "BUY",
          targetBuyPrice,
          formattedQty,
          SYMBOL,
          PRICE_STEP,
        );

        if (order?.orderId) {
          console.log(
            `🛒 [${SYMBOL}] Новый ордер BUY выставлен по цене ${targetBuyPrice}`,
          );
        }
      }

    } catch (error: any) {
      console.error(
        `💥 Ошибка торгового цикла ${SYMBOL}:`,
        error.message || error,
      );
    }

    await sleep(TRADE_INTERVAL_MS);
  }
}
