
import { client } from "./client";

export async function getAssetBalance(
  assetName: string,
): Promise<{ coinBalance: number; usdtBalance: number }> {
  try {
    await client.loadMarkets();

    // Получаем балансы через CCXT.
    const balance = await client.fetchBalance();

    // total — общий баланс, включая средства,
    // заблокированные в открытых ордерах.
    const coinBalance = Number(
      balance.total?.[assetName] ?? 0
    );

    const usdtBalance = Number(
      balance.total?.USDT ?? 0
    );

    return {
      coinBalance: Number.isFinite(coinBalance) ? coinBalance : 0,
      usdtBalance: Number.isFinite(usdtBalance) ? usdtBalance : 0,
    };

  } catch (e: any) {
    console.error(
      `Ошибка при получении баланса ${assetName}:`,
      e.message || e
    );

    return {
      coinBalance: 0,
      usdtBalance: 0,
    };
  }
}
