import "dotenv/config";
import { createApp } from "./app";
import { startBot } from "./bot/bot";

const app = createApp();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`Backend запущен на порту ${port}`);
});

startBot();
