import { prisma } from "../../db/prisma";

export const servicesService = {
  listByCategory: (categoryId: number) =>
    prisma.service.findMany({ where: { categoryId }, orderBy: { id: "asc" } }),

  list: () => prisma.service.findMany({ orderBy: { id: "asc" }, include: { category: true } }),

  create: (data: { name: string; categoryId: number }) => prisma.service.create({ data }),

  update: (id: number, data: { name?: string; categoryId?: number }) =>
    prisma.service.update({ where: { id }, data }),

  remove: (id: number) => prisma.service.delete({ where: { id } }),
};
