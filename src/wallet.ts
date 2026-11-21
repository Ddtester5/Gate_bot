import type { Exchange } from "ccxt";

interface AssetBalance {
  free: number;
  used: number;
  total: number;
}

interface WalletBalance {
  coinBalance: number;
  usdtBalance: number;
  coinTotal: number;
  usdtTotal: number;
}

export async function getAssetBalance(
  client: Exchange,
  assetName: string,
): Promise<WalletBalance> {
  try {
    const balance = await client.fetchBalance();

    // CCXT Balance имеет фиксированную типизацию,
    // поэтому приводим валютные коллекции к индексируемому типу.
    const freeBalances = balance.free as unknown as Record<
      string,
      number | undefined
    >;
    const usedBalances = balance.used as unknown as Record<
      string,
      number | undefined
    >;
    const totalBalances = balance.total as unknown as Record<
      string,
      number | undefined
    >;

    const getAsset = (asset: string): AssetBalance => {
      const free = Number(freeBalances?.[asset] ?? 0);
      const used = Number(usedBalances?.[asset] ?? 0);
      const total = Number(totalBalances?.[asset] ?? free + used);

      return {
        free: Number.isFinite(free) ? free : 0,
        used: Number.isFinite(used) ? used : 0,
        total: Number.isFinite(total) ? total : 0,
      };
    };

    const coin = getAsset(assetName);
    const usdt = getAsset("USDT");

    return {
      coinBalance: coin.free,
      usdtBalance: usdt.free,
      coinTotal: coin.total,
      usdtTotal: usdt.total,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    console.error(`Ошибка при получении баланса ${assetName}:`, message);

    return {
      coinBalance: 0,
      usdtBalance: 0,
      coinTotal: 0,
      usdtTotal: 0,
    };
  }
}
