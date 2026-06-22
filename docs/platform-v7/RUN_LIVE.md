# Боевой режим (live) — как поднять реальное ядро, не демо

Платформа уже production-shaped: реальный NestJS API, Prisma-БД, JWT-аутентификация, RBAC и
state-machine сделки. «Демо-ощущение» создаёт только режим запуска. Этот документ фиксирует
**проверенную** процедуру запуска реального ядра и реального сквозного пути сделки.

## Переключатели режима

| Переменная | Демо | Боевое ядро |
|---|---|---|
| `RUNTIME_PERSISTENCE_MODE` | `file` | `db` (или `hybrid`/`db-strict`) |
| `PLATFORM_V7_DEAL_REPOSITORY` | — (runtime/in-memory) | `prisma` (БД-репозиторий сделок) |
| `PLATFORM_V7_USER_REPOSITORY` | — (runtime/in-memory) | `prisma` (БД-репозиторий identity) |
| `DATABASE_URL` | — | `file:./dev.db` (SQLite) или Postgres URL |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | — | обязательны |

## Поднять API на реальной БД

```bash
cd apps/api
export DATABASE_URL="file:./dev.db"
pnpm exec prisma generate
pnpm exec prisma db push            # создаёт схему БД (13 моделей)

# boot реального API в боевом режиме данных
DATABASE_URL="file:./dev.db" \
RUNTIME_PERSISTENCE_MODE=db \
PLATFORM_V7_DEAL_REPOSITORY=prisma \
ACCESS_TOKEN_SECRET=<secret> \
REFRESH_TOKEN_SECRET=<secret> \
PORT=4000 \
pnpm dev      # nest start --watch → http://localhost:4000/api
```

При старте `DatabaseSeedService` засевает реальные строки (сделки, рейсы, документы, пробы) —
данные приходят из БД, а не из фикстур.

## Проверенный сквозной путь (вертикальный срез)

Эти шаги воспроизведены и подтверждены на реальном API + SQLite:

```bash
# 1) Реальный вход → реальный JWT + refresh
curl -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"farmer@demo.ru","password":"demo1234"}'
# → { "accessToken": "<JWT>", "refreshToken": "..." }

# 2) Реальные сделки из БД (RBAC по роли/оргу)
curl localhost:4000/api/deals -H "Authorization: Bearer <JWT>"
# → [{ "id":"DEAL-003", "totalRub":3300000, "culture":"barley", ... }]

# 3) Реальная запись: создание сделки (роль BUYER/FARMER/ADMIN)
curl -X POST localhost:4000/api/deals -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' \
  -d '{"lotId":"LOT-LIVE","winnerBidId":"BID-LIVE"}'
# → { "id":"DEAL-004", "status":"DRAFT", ... }   (персистится в БД)

# 4) Реальный жизненный цикл со state-machine (роль ADMIN/ACCOUNTING)
curl -X PATCH localhost:4000/api/deals/DEAL-004/transition -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' -d '{"nextState":"AWAITING_SIGN"}'   # 200, статус сменился
curl -X PATCH localhost:4000/api/deals/DEAL-004/transition -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' -d '{"nextState":"CLOSED"}'          # 400: переход не разрешён
```

Негативные кейсы тоже проверены и работают как положено:
- неверный пароль → `400`; запрос без токена → `401`;
- `SUPPORT_MANAGER` (оператор) на `deal.create` → `403` (политика действий);
- невалидный `nextState` → `400` (валидация DTO).

## Что осталось до «тысяч пользователей» (следующие этапы)

Реальное ядро запускается и пишет в БД. Дальше по приоритету:

1. ~~**Идентичность в БД.**~~ ✅ Сделано: модели `User`/`Organization`/`RefreshToken` в Prisma,
   `PrismaUserRepository` за флагом `PLATFORM_V7_USER_REPOSITORY=prisma`, сид орг/пользователей,
   refresh-токены в БД. Проверено: вход seed-пользователя, регистрация с повторным входом, refresh.
2. **Веб на живой API.** Экраны platform-v7 (`/deals`, workspace, close) читают фикстуры
   (`lib/v7r/data.ts`, `deal360-source-of-truth.ts`) — перевести на `getDealsCanonical()` и
   API-эндпоинты с маппингом форм.
3. **DB-backed `workspace`/`passport`.** Сейчас их обслуживает runtime-view-model адаптер; собрать
   на Prisma из `Deal`+`DealDocument`+`Payment`+`AuditEvent`.
4. **Postgres вместо SQLite** для конкурентного доступа (план: `audit/SR2_POSTGRES_MIGRATION_PLAN.md`).
5. **Масштаб под тысячи**: Redis rate-limit/WebSocket (SR5), очереди (SR7), observability (SR3),
   нагрузочное + SLO (SR8), outbox/idempotency (SR4 — модель `OutboxEntry` уже есть).

## Внешние боевые подключения (вне инженерного контроля)

Живые ФГИС «Зерно», Сбер-банк, ЕСИА, ЭДО/ЭТрН, КЭП требуют подписанных договоров и выданных
кредов (в `.env` поля `*_CLIENT_ID/SECRET` пустые, режим `sandbox`). До их получения интеграции
работают за реальными интерфейсами на sandbox-адаптерах. Это сознательная честная граница, а не
заглушка ради вида.
