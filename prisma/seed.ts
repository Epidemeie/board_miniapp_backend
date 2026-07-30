import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Ремонт", icon: "🔧", services: ["Сантехника", "Электрика", "Ремонт техники"] },
  { name: "Уборка", icon: "🧹", services: ["Уборка квартиры", "Уборка после ремонта", "Регулярная уборка"] },
  { name: "Перевозки", icon: "🚚", services: ["Перевозка мебели", "Квартирный переезд", "Мелкий переезд / доставка"] },
];

async function main() {
  for (const cat of CATEGORIES) {
    let category = await prisma.category.findFirst({ where: { name: cat.name } });
    if (!category) {
      category = await prisma.category.create({ data: { name: cat.name, icon: cat.icon } });
      console.log(`Создана категория: ${cat.name}`);
    }
    for (const serviceName of cat.services) {
      const exists = await prisma.service.findFirst({
        where: { name: serviceName, categoryId: category.id },
      });
      if (!exists) {
        await prisma.service.create({ data: { name: serviceName, categoryId: category.id } });
        console.log(`  + услуга: ${serviceName}`);
      }
    }
  }
  console.log("Сид выполнен: категории и услуги на месте.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
