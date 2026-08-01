import { SupportTicket } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { notifyAdmin } from "../../bot/bot";

function formatTicketMessage(ticket: SupportTicket) {
  const roleLabel = ticket.role === "provider" ? "мастер" : "клиент";
  const contact = ticket.username ? `@${ticket.username}` : `telegram id ${ticket.telegramId}`;
  return [
    `🆘 Обращение в поддержку №${ticket.id}`,
    "",
    `От: ${ticket.name} (${contact}) — ${roleLabel}`,
    `Тема: ${ticket.subject || "—"}`,
    "",
    ticket.text,
  ].join("\n");
}

export const supportService = {
  create: async (data: {
    telegramId: string;
    name: string;
    username?: string;
    role: "client" | "provider";
    subject?: string;
    text: string;
  }) => {
    const ticket = await prisma.supportTicket.create({ data });
    // Не await — доставка в Telegram не должна блокировать ответ пользователю
    // и не должна ронять запрос, если бот недоступен (см. notifyAdmin).
    notifyAdmin(formatTicketMessage(ticket)).catch((e) =>
      console.error("Не удалось отправить обращение в поддержку админу:", e.message)
    );
    return ticket;
  },

  listForAdmin: () => prisma.supportTicket.findMany({ orderBy: { id: "desc" } }),
};
