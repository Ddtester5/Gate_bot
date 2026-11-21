import * as dotenv from "dotenv";

dotenv.config();

const GATE_EXCHANGE_ID = process.env.EXCHANGE_ID || "";
const GATE_API_KEY = process.env.GATE_API_KEY || "";
const GATE_SECRET_KEY = process.env.GATE_SECRET_KEY || "";

if (!GATE_API_KEY || !GATE_SECRET_KEY || !GATE_EXCHANGE_ID) {
  console.error(
    "❌ Ошибка: Укажите GATE_API_KEY, GATE_SECRET_KEY и GATE_EXCHANGE_ID в файле .env",
  );
  process.exit(1);
}
export { GATE_API_KEY, GATE_EXCHANGE_ID, GATE_SECRET_KEY };
