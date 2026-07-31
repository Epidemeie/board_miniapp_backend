import { Telegraf, Markup } from "telegraf";

// Бот — только канал уведомлений (заявки/отклики/заказы), без переписки.
// Поэтому все ответы короткие и всегда ведут в Mini App, а не пытаются
// поддержать диалог. Не модуль в общем смысле (router.ts/service.ts) —
// это фоновый процесс поверх Express, а не HTTP-роут.

const MINI_APP_URL = process.env.MINI_APP_URL || "https://goservices.lol";

const WELCOME_TEXT =
  "👋 Привет! Это бот Tbilisi Services.\n\n" +
  "Здесь будут приходить уведомления о ваших заявках, откликах и заказах. " +
  "Всё управление — в мини-приложении, бот не ведёт переписку.";

const HELP_TEXT =
  "Бот присылает уведомления о заявках, откликах и заказах и не отвечает на сообщения.\n\n" +
  "Вопрос, жалоба или предложение — раздел «Поддержка» в приложении.";

const FALLBACK_TEXT = "Бот не ведёт переписку — все действия и вопросы через приложение 👇";

function openAppKeyboard() {
  return Markup.inlineKeyboard([Markup.button.webApp("Открыть приложение", MINI_APP_URL)]);
}

export function createBot(token: string) {
  const bot = new Telegraf(token);

  bot.start((ctx) => ctx.reply(WELCOME_TEXT, openAppKeyboard()));
  bot.help((ctx) => ctx.reply(HELP_TEXT, openAppKeyboard()));
  bot.on("text", (ctx) => ctx.reply(FALLBACK_TEXT, openAppKeyboard()));

  return bot;
}

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN не задан — бот уведомлений не запущен");
    return null;
  }

  const bot = createBot(token);
  bot.launch().catch((e) => console.error("Не удалось запустить Telegram-бота:", e.message));
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  return bot;
}
