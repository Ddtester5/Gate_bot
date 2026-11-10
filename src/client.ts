import ccxt from "ccxt";
import { API_KEY, SECRET_KEY, EXCHANGE_ID } from "./config";

// Создаём клиент выбранной биржи через CCXT.
const ExchangeClass = (ccxt as any)[EXCHANGE_ID];

if (!ExchangeClass) {
  throw new Error(`❌ CCXT не поддерживает биржу: ${EXCHANGE_ID}`);
}

const client = new ExchangeClass({
  apiKey: API_KEY,
  secret: SECRET_KEY,
  enableRateLimit: true,
  timeout: 30000,
  options: {
    defaultType: "spot",
  },
});

// Загружаем рынки перед началом работы бота.
export async function initializeExchange(): Promise<void> {
  await client.loadMarkets();
  console.log(`✅ Подключено к бирже: ${EXCHANGE_ID}`);
}

export default client;
export { client };
