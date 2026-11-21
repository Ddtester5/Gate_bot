import type { Exchange } from "ccxt";

export async function getAssetBalance(
  client: Exchange,
  assetName: string,
): Promise<{ coinBalance: number; usdtBalance: number }> {
  try {
    const balance = await client.fetchBalance();

    const getTotal = (asset: string): number => {
      const value = balance.total?.[asset as keyof typeof balance.total];

      const result = Number(value ?? 0);

      return Number.isFinite(result) ? result : 0;
    };

    return {
      coinBalance: getTotal(assetName),
      usdtBalance: getTotal("USDT"),
    };

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    console.error(
      `Ошибка при получении баланса ${assetName}:`,
      message,
    );

    return {
      coinBalance: 0,
      usdtBalance: 0,
    };
  }
}
