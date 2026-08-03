import { prisma } from "../../db/prisma";

type PartnerInput = {
  name?: string;
  tag?: string | null;
  logoEmoji?: string | null;
  logoImage?: string | null;
  description?: string | null;
  offerText?: string | null;
  website?: string | null;
  websiteLabel?: string | null;
  telegram?: string | null;
  area?: string | null;
  active?: boolean;
  showProviders?: boolean;
  sortOrder?: number;
};

export type PartnerAudience = "client" | "provider";

export const partnersService = {
  // Публичный список для конкретной аудитории — клиенты видят active,
  // мастера видят showProviders; это независимые переключатели в админке.
  listForAudience: (audience: PartnerAudience) =>
    prisma.partner.findMany({
      where: audience === "provider" ? { showProviders: true } : { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),

  getVisibleById: (id: number) =>
    prisma.partner.findFirst({ where: { id, OR: [{ active: true }, { showProviders: true }] } }),

  // Админский список — все, включая скрытые
  listAll: () => prisma.partner.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),

  create: (data: PartnerInput) => prisma.partner.create({ data: { name: data.name!, ...data } }),

  update: (id: number, data: PartnerInput) => prisma.partner.update({ where: { id }, data }),

  remove: (id: number) => prisma.partner.delete({ where: { id } }),

  incrementImpressions: (ids: number[]) =>
    prisma.partner.updateMany({ where: { id: { in: ids } }, data: { impressionCount: { increment: 1 } } }),

  incrementClick: (id: number) =>
    prisma.partner.update({ where: { id }, data: { clickCount: { increment: 1 } } }),
};
