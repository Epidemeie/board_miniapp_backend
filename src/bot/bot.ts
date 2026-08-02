import { Telegraf, Markup } from "telegraf";

// Бот — только канал уведомлений (заявки/отклики/заказы/отзывы), без
// переписки. Поэтому все ответы короткие и всегда ведут в Mini App, а не
// пытаются поддержать диалог. Не модуль в общем смысле (router.ts/service.ts)
// — это фоновый процесс поверх Express, а не HTTP-роут.

const MINI_APP_URL = process.env.MINI_APP_URL || "https://goservices.lol";
const SUPPORT_ADMIN_CHAT_ID = process.env.SUPPORT_ADMIN_CHAT_ID;

// Инстанс бота хранится здесь же, чтобы другие модули (сейчас — support)
// могли слать через него уведомления админу в личку, не запуская второй
// бот и не тащя Telegraf-специфику наружу из src/bot.
let botInstance: ReturnType<typeof createBot> | null = null;

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
  botInstance = bot;
  bot.launch().catch((e) => console.error("Не удалось запустить Telegram-бота:", e.message));
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  return bot;
}

// Уведомление админу в личку — сейчас только новые обращения в поддержку
// (см. supportService.create). Не бросает исключение наружу: сбой отправки
// не должен ронять запрос, который создал обращение — оно уже записано в
// БД независимо от того, дошло ли уведомление.
export async function notifyAdmin(text: string) {
  if (!botInstance) {
    console.warn("Бот не запущен — уведомление админу не отправлено");
    return;
  }
  if (!SUPPORT_ADMIN_CHAT_ID) {
    console.warn("SUPPORT_ADMIN_CHAT_ID не задан — уведомление админу не отправлено");
    return;
  }
  await botInstance.telegram.sendMessage(SUPPORT_ADMIN_CHAT_ID, text);
}

// Уведомление конкретному пользователю (клиенту или мастеру) в личку —
// новые заявки/отклики/заказы/отзывы, см. вызовы в requests/offers/reviews/
// clientReviews service. Как и notifyAdmin, не бросает исключение наружу:
// сбой доставки (бот не запущен, пользователь ни разу не нажал /start,
// заблокировал бота) не должен ронять запрос, который уже успешно записал
// данные в БД — вызывающая сторона сама решает, await'ить или отправить
// «в фоне» и залогировать ошибку через .catch, см. notifyAdmin выше.
export async function notifyUser(telegramId: string, text: string) {
  if (!botInstance) {
    console.warn("Бот не запущен — уведомление пользователю не отправлено");
    return;
  }
  await botInstance.telegram.sendMessage(telegramId, text, openAppKeyboard());
}
