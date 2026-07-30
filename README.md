# Tbilisi Services — Backend

Модульный backend для маркетплейса локальных услуг (Node.js + TypeScript + Express + Prisma + PostgreSQL).

## Структура (модульно — по одному разделу в папке)

```
src/modules/
  categories/   — категории услуг
  services/     — конкретные услуги внутри категорий
  providers/    — мастера/исполнители
  requests/     — заявки клиентов + алгоритм подбора мастеров
  offers/       — отклики мастеров на заявки
  reviews/      — отзывы после заказа
  auth/         — проверка подлинности Telegram initData
  admin/        — аналитика для админ-панели
```

Каждый модуль — это `router.ts` (маршруты) + `service.ts` (логика и запросы к БД).
Чтобы убрать модуль целиком — закомментируйте соответствующую строку в `src/app.ts`.
Чтобы добавить новый раздел — скопируйте структуру любого существующего модуля.

## Локальный запуск

```bash
npm install
cp .env.example .env        # заполните DATABASE_URL и остальные переменные
npx prisma migrate dev       # создаст таблицы в БД
npm run seed                 # добавит стартовые категории/услуги (Ремонт/Уборка/Перевозки)
npm run dev                  # http://localhost:3000
```

Админка: `http://localhost:3000/admin` — логин/пароль из `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

## Деплой на ваш сервер через Coolify

1. В Coolify создайте **+ New Resource → Database → PostgreSQL** — отдельным ресурсом.
   Скопируйте выданный им **Connection String** — это будущий `DATABASE_URL`.
2. Создайте **+ New Resource → Public Repository**, укажите репозиторий backend'а, ветка `main`.
3. **Build Pack**: `Dockerfile` (в проекте уже есть готовый `Dockerfile`).
4. В **Environment Variables** добавьте: `DATABASE_URL`, `PORT=3000`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `CORS_ORIGIN` (адрес фронтенда, например `https://goservices.lol`).
5. **Domains**: например `https://api.goservices.lol` (нужна ещё одна DNS A-запись на Porkbun с `Host: api`, как мы делали для основного домена).
6. **Deploy**. При старте контейнер сам выполнит `prisma migrate deploy` — создаст таблицы.
7. Один раз зайдите в контейнер и выполните сид (или запустите `npm run seed` локально, указав в `.env` продовый `DATABASE_URL`):
   ```bash
   docker exec -it <container_id> node -e "require('child_process').execSync('npx prisma db seed', {stdio:'inherit'})"
   ```

## Публичные эндпоинты (для фронтенда)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/categories` | список категорий |
| GET | `/api/services?categoryId=1` | услуги внутри категории |
| GET | `/api/providers` | список мастеров |
| GET | `/api/providers/:id` | профиль мастера |
| GET | `/api/providers/by-telegram/:telegramId` | зарегистрирован ли этот telegramId как мастер |
| POST | `/api/providers/register` | самостоятельная регистрация мастера из Mini App |
| POST | `/api/requests` | создать заявку |
| GET | `/api/requests/open?serviceId=1,2` | лента открытых заявок под услуги мастера |
| GET | `/api/requests/mine?telegramId=` | заявки клиента + отклики по ним |
| GET | `/api/requests/:id/candidates` | подобрать мастеров под заявку (алгоритм) |
| POST | `/api/offers` | мастер отправляет отклик |
| GET | `/api/offers/request/:requestId` | отклики по заявке |
| PUT | `/api/offers/:id/respond` | принять/отклонить отклик |
| POST | `/api/reviews` | оставить отзыв |
| POST | `/api/auth/telegram` | проверить initData Telegram |

## Админ-эндпоинты (Basic Auth)

`/api/admin/categories`, `/api/admin/services`, `/api/admin/providers`, `/api/admin/users`, `/api/admin/requests`, `/api/admin/reviews`, `/api/admin/stats` — CRUD + аналитика. UI: `/admin`.

`/api/admin/providers/:id` и `/api/admin/users/:id` (GET) отдают полную карточку —
профиль + история (отклики/отзывы у мастера, заявки/отзывы у клиента) — админка
использует их для детального просмотра на вкладке «Аналитика». PUT позволяет
редактировать (у мастера — включая набор услуг и районов), DELETE удаляет
мастера/клиента каскадом (услуги, районы, отклики, отзывы, заявки — см. schema.prisma).
