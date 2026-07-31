import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Список синхронизирован с продакшн-базой (то, что реально видят пользователи
// в приложении) — при добавлении категории/услуги через админку в проде
// дублировать изменение и здесь, иначе локальная среда разработки разъедется
// с реальным приложением. Переводы для фронтенда — в RU_TO_EN в App.jsx.
const CATEGORIES = [
  { name: "Дом и быт", icon: "🏠", services: ["Муж на час", "Сборка мебели", "Установка техники", "Мелкий ремонт"] },
  { name: "Ремонт", icon: "🔧", services: ["Сантехник", "Электрик", "Ремонт техники", "Ремонт мебели", "Кондиционеры", "Замки"] },
  { name: "Уборка", icon: "🧹", services: ["Генеральная уборка", "Уборка после ремонта", "Мойка окон", "Химчистка мебели"] },
  { name: "Перевозки", icon: "🚚", services: ["Грузчики", "Переезды", "Курьеры", "Эвакуатор"] },
  { name: "Сад и участок", icon: "🌿", services: ["Покос травы", "Спил деревьев", "Полив", "Уборка участка"] },
  { name: "IT и техника", icon: "💻", services: ["Настройка ПК", "Wi-Fi", "Видеонаблюдение", "Установка ПО", "Ремонт ноутбуков"] },
  { name: "Цифровые услуги", icon: "📱", services: ["Дизайн", "Сайты", "Монтаж видео", "Копирайтинг", "Перевод", "Настройка рекламы"] },
  { name: "Обучение", icon: "📚", services: ["Репетиторы", "Языки", "Музыка", "Спорт", "Подготовка к экзаменам"] },
  { name: "Здоровье", icon: "🩺", services: ["Массаж", "Сиделки", "Медсестры на дом"] },
  { name: "Красота", icon: "💇", services: ["Парикмахер", "Барбер", "Маникюр", "Визажист", "Косметолог"] },
  { name: "Животные", icon: "🐶", services: ["Выгул собак", "Груминг", "Передержка", "Ветеринар"] },
  { name: "Фото и видео", icon: "📸", services: ["Фотограф", "Видеограф", "Дрон", "Обработка фото"] },
  { name: "Мероприятия", icon: "🎉", services: ["Ведущий", "DJ", "Аниматор", "Декоратор", "Кейтеринг"] },
  { name: "Бизнес", icon: "⚖️", services: ["Юрист", "Бухгалтер", "Налоговый консультант", "Регистрация компаний"] },
  { name: "Авто", icon: "🚗", services: ["Автоэлектрик", "Диагностика", "Шиномонтаж", "Мойка", "Детейлинг", "Эвакуатор"] },
  { name: "Недвижимость", icon: "🏡", services: ["Риелтор", "Оценка", "Приёмка квартиры", "Хоумстейджинг"] },
  { name: "Дети", icon: "👶", services: ["Няня", "Детский аниматор", "Логопед", "Психолог"] },
  { name: "Помощь пожилым", icon: "👴", services: ["Сиделка", "Сопровождение", "Доставка продуктов"] },
  { name: "Путешествия", icon: "✈️", services: ["Гид", "Трансфер", "Переводчик", "Помощь туристам"] },
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
