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
| `DATABASE_URL` | — | Postgres URL (`postgresql://…`) |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | — | обязательны |

> Бэкенд работает на **Postgres** (`datasource.provider = "postgresql"`) — это
> конкурентный писатель для тысяч одновременных пользователей. SQLite больше не
> используется как datasource.

## Поднять API на реальной БД (Postgres)

```bash
# 1) Postgres: либо bundled-кластер, либо docker
pg_ctlcluster 16 main start     # Debian/Ubuntu: уже установлен кластер
# или: docker compose -f infra/postgres/docker-compose.yml up -d
createdb pachanin 2>/dev/null   # роль/БД pachanin (см. infra/postgres)

cd apps/api
export DATABASE_URL="postgresql://pachanin:pachanin@localhost:5432/pachanin?schema=public"
pnpm exec prisma generate
pnpm exec prisma migrate deploy   # применяет PG-миграции (init + deal_seq)

# boot реального API в боевом режиме данных
DATABASE_URL="postgresql://pachanin:pachanin@localhost:5432/pachanin?schema=public" \
RUNTIME_PERSISTENCE_MODE=db \
PLATFORM_V7_DEAL_REPOSITORY=prisma \
PLATFORM_V7_USER_REPOSITORY=prisma \
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
2. **Веб на живой API.**
   - ✅ **Вход (auth) — боевой.** Экран `/platform-v7/login` теперь форма с email+паролем и
     один-клик-доступы по seed-аккаунтам; всё уходит в `/api/auth/login`, который проверяет
     учётку на бэкенде (bcrypt+JWT) и ставит реальную cookie-сессию. Демо-режим остаётся только
     офлайн-фоллбэком, когда бэкенд недоступен. Для боевого входа задать `NEXT_PUBLIC_API_URL`
     (напр. `http://localhost:4000/api`) — иначе фронт уходит в офлайн-демо.
   - ✅ **Реестр сделок на живых данных.** `/platform-v7/deals` тянет `getDealsCanonical()` и
     показывает реальные строки из БД («Живые данные · API») с переходом в карточку; при
     недоступном бэкенде — фоллбэк на сценарную витрину.
   - ✅ **Карточка сделки на живом workspace.** `/deals/[id]/clean` сначала тянет
     `/api/deals/:id/workspace` и рендерит реальные данные (статус, деньги, документы, рейсы,
     блокеры, журнал); для фикстурных `DL-*` id и при недоступном бэкенде — фоллбэк на сценарий.
     Это чинит и переход из живого реестра (DB-сделки `DEAL-*` теперь открываются, а не «не найдена»).
3. ✅ **DB-backed `workspace`/`passport`.** `PrismaDealRepository.workspace/passport` собирают
   реальный агрегат из `Deal`+`DealDocument`+`Shipment`+`LabSample`+`Payment`+`AuditEvent` с
   производными money/completeness/blockers. Проверено: `/api/deals/:id/workspace` → `source: db`.
4. ✅ **Postgres — боевой конкурентный бэкенд** (для тысяч одновременных пользователей).
   `datasource.provider = "postgresql"`, PG-миграции (`init` + `add_deal_seq`). Id сделок
   выдаёт **атомарная последовательность** `nextval('deal_seq')` — без гонок под параллельной
   нагрузкой (заменила `max()+1`, который ломался). Проверено вживую на Postgres 16:
   - **60 одновременных создания → 60×201, 60 уникальных id, 0 дублей, 0 ошибок.**
   - **30 одновременных переходов одной сделки → ровно 1×200**, остальные безопасно отклонены
     (`400` state-machine / `409` compare-and-set), статус консистентен, без потери обновлений.
5. **Масштаб под тысячи (дальше)**: Redis rate-limit/WebSocket (SR5), durable-очереди (SR7),
   observability (SR3), нагрузочное + SLO (SR8), outbox/idempotency (SR4 — модель `OutboxEntry`
   уже есть). Пул соединений Postgres — через `connection_limit` в `DATABASE_URL` + pgbouncer.

## Нагрузочная проверка конкурентности (как воспроизвести)

Postgres-миграции (`init` + `add_deal_seq`) уже в репозитории и применяются
`prisma migrate deploy`. Конкурентность проверяется так:

```bash
# 60 параллельных создания — атомарная последовательность, без гонок id
seq 1 60 | xargs -P 60 -I{} curl -s -X POST localhost:4000/api/deals \
  -H "Authorization: Bearer <JWT>" -H 'Content-Type: application/json' \
  -d '{"lotId":"L{}","winnerBidId":"B{}"}' -w '%{http_code}\n'
# ожидание: 60×201, 60 уникальных id, 0 дублей

# 30 параллельных переходов одной сделки — compare-and-set, без потери обновлений
seq 1 30 | xargs -P 30 -I{} curl -s -o /dev/null -X PATCH \
  localhost:4000/api/deals/<ID>/transition -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' -d '{"nextState":"AWAITING_SIGN"}' -w '%{http_code}\n'
# ожидание: ровно 1×200, остальные 400/409; финальный статус консистентен
```

## Внешние боевые подключения (вне инженерного контроля)

Живые ФГИС «Зерно», Сбер-банк, ЕСИА, ЭДО/ЭТрН, КЭП требуют подписанных договоров и выданных
кредов (в `.env` поля `*_CLIENT_ID/SECRET` пустые, режим `sandbox`). До их получения интеграции
работают за реальными интерфейсами на sandbox-адаптерах. Это сознательная честная граница, а не
заглушка ради вида.
