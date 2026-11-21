import ccxt from "ccxt";
import { GATE_API_KEY, GATE_EXCHANGE_ID, GATE_SECRET_KEY } from "./configs/const";

const ExchangeClass = (ccxt as any)[GATE_EXCHANGE_ID];

if (!ExchangeClass) {
  throw new Error(`❌ CCXT не поддерживает биржу: ${GATE_EXCHANGE_ID}`);
}

const client = new ExchangeClass({
  apiKey: GATE_API_KEY,
  secret: GATE_SECRET_KEY,
  enableRateLimit: true,
  timeout: 60000,
  options: {
    defaultType: "spot",
  },
});

export async function initializeExchange(): Promise<void> {
  await client.loadMarkets();
  console.log(`✅ Подключено к бирже: ${GATE_EXCHANGE_ID}`);
}

export default client;
export { client };
