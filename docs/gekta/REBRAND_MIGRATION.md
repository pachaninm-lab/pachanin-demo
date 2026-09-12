# Полный ребрендинг TAI → Гекта

Статус документа: канонический план миграции.

Связанный epic: #3824.

## 1. Решение

Продукт TAI получает новое имя **Гекта**.

Канонические формы:

| Контекст | Значение |
|---|---|
| Русское название | `Гекта` |
| Русский логотип | `ГЕКТА` |
| Латинское название | `Gekta` |
| Латинский логотип | `GEKTA` |
| Технический namespace | `gekta` |
| Переменные окружения | `GEKTA_*` |
| Основной CTA | `Спросить Гекту` |
| Дескриптор | `Аграрный интеллект для земли, урожая и решений` |

Не использовать `Гекто`, `Gekto`, `Hekta`, `Gecta`, `TAI Гекта` и другие промежуточные варианты.

## 2. Что именно переименовывается

Ребрендинг охватывает не только пользовательский текст. TAI является отдельным продуктовым и эксплуатационным контуром, поэтому миграция включает:

- публичный сайт и интерфейсы RU/EN/ZH;
- SEO, Open Graph, structured data и публичные изображения;
- web/API routes;
- Python application и package namespace;
- TypeScript packages, contracts и events;
- system prompts, tool descriptions, RAG/vector namespaces и model metadata;
- тесты, fixtures и snapshots;
- workflows, scripts, Dockerfiles, Compose, Caddy и OCI images;
- REG.RU production contour;
- Selectel/object-storage prefixes и release evidence;
- environment variables, secrets names и configuration contracts;
- database roles, schemas, grants и operational checks;
- monitoring, alerts, analytics, BI, CRM, support и commercial materials;
- пользовательскую, техническую, эксплуатационную и юридическую документацию.

## 3. Принцип миграции

Гекта становится новым первичным именем. TAI не удаляется одномоментно там, где старое обозначение является частью внешнего или долговечного контракта.

Каждое вхождение относится к одной категории:

1. **public** — пользователь видит старое имя; заменить в первую очередь;
2. **active-code** — активный namespace, route, package, event, workflow или service; мигрировать контролируемо;
3. **compatibility** — старый идентификатор временно поддерживает действующего потребителя;
4. **immutable-history** — достоверная история, которую нельзя переписывать;
5. **false-positive** — `tai` является частью несвязанного слова или внешнего идентификатора.

Слепая глобальная замена запрещена.

## 4. Порядок работ

### R0. Governance и инвентаризация

Цель: получить полный реестр и не потерять скрытые зависимости.

Результаты:

- machine-readable manifest;
- inventory script;
- legacy allowlist;
- карта зависимостей;
- список открытых PR и веток, пересекающихся с миграцией;
- отдельный scope для каждого следующего PR.

Gate выхода:

- все найденные вхождения классифицированы;
- каждому active/compatibility вхождению назначены фаза, владелец и критерий удаления;
- false-positive подтверждены вручную;
- immutable-history не смешана с активной документацией.

### R1. Публичный брендовый слой

Цель: пользователь видит только Гекту.

Изменить:

- `Спросить ИИ` → `Спросить Гекту`;
- `ИИ-помощник` → `Гекта` или контекстное описание функции;
- `ИИ для агробизнеса` → `Гекта`;
- подзаголовок → `Аграрный интеллект для земли, урожая и решений`;
- EN → `Gekta`, `Ask Gekta`;
- ZH-копирайт — сохранить имя `Gekta` латиницей и локализовать дескриптор;
- aria-label, title, tooltip, empty state, loading, errors, emails, push, PDF;
- публичные CTA на Deal Explorer и других страницах;
- SEO metadata, OG images, favicon/app icons после утверждения визуального знака.

Client-storage миграция:

1. читать новый ключ Гекты;
2. если его нет — однократно прочитать legacy key;
3. валидировать и записать данные в новый key;
4. удалить legacy key только после успешной записи;
5. не терять историю диалогов при ребрендинге.

Gate выхода:

- публичный rebrand guard не находит `TAI`, `Tai`, `Спросить ИИ` и запрещённые написания;
- RU/EN/ZH тесты проходят;
- mobile, accessibility и browser acceptance проходят;
- API/runtime behaviour не изменён.

### R2. API, SDK и контракты

Цель: новое имя становится первичным внешним техническим контрактом.

Добавить первичные адреса:

- `/gekta`;
- `/api/gekta`;
- `/api/gekta/v1`;
- документацию и SDK под именем Gekta.

Старые `/tai` сохранять только как aliases, если доказан внешний потребитель. Для aliases обязательны:

- deprecation marker;
- telemetry использования;
- единая реализация без fork бизнес-логики;
- тест эквивалентности ответа;
- владелец;
- дата review;
- критерий удаления.

Gate выхода:

- новые клиенты используют Gekta routes;
- старые routes не являются внутренней primary authority;
- нет расхождения поведения между primary route и alias.

### R3. Application и package namespace

Цель: активный код использует `gekta`.

Целевые изменения:

- `apps/tai` → `apps/gekta`;
- Python package `tai` → `gekta`;
- `packages/tai-*` → `packages/gekta-*`;
- `Tai*` → `Gekta*`;
- `tai_*` → `gekta_*`;
- tests/fixtures/snapshots/imports обновляются вместе с implementation.

Import shim допускается только временно:

- shim не содержит собственной бизнес-логики;
- выдаёт deprecation signal там, где это безопасно;
- имеет тест;
- включён в allowlist;
- имеет дату удаления.

Model identity и internal artifact identifiers меняются только после анализа совместимости. Нельзя переименовать уже выпущенный model bundle задним числом.

Gate выхода:

- новые imports и package names — только Gekta;
- compatibility imports измеряются;
- active-code inventory не содержит неразрешённых TAI-токенов.

### R4. Infrastructure и operations

Цель: эксплуатационный контур работает под именем Gekta без потери production authority.

Мигрировать:

- `.github/workflows/tai-*`;
- `scripts/tai-*`, `scripts/check-tai-*`, `scripts/pc-tai-*`;
- `infra/docker/Dockerfile.tai`;
- Docker/Compose service names;
- OCI image names и labels;
- REG.RU configuration;
- Selectel/object-storage active prefixes;
- monitoring, logs, traces, dashboards и alerts;
- cron jobs, queues, workers и status evidence.

Environment migration:

```text
GEKTA_* — primary
TAI_*   — temporary deprecated fallback
```

Правило чтения:

1. если задан `GEKTA_*`, использовать его;
2. если одновременно заданы новый и старый ключи с разными значениями — fail closed;
3. если задан только `TAI_*`, временно принять его и записать безопасную deprecation telemetry;
4. не печатать secret value;
5. удалить fallback только после подтверждённой миграции всех environments.

Database roles и grants:

- не выполнять rename in place без rehearsal;
- создавать новый principal forward-only migration;
- переносить минимальные grants;
- доказывать отсутствие лишних прав;
- переключать service credentials отдельно;
- сохранять rollback/recovery authority;
- удалять старую роль только после отсутствия sessions, memberships, ownership и dependencies.

Production gate:

- exact current main;
- exact OCI revision;
- controlled REG.RU rollout;
- Caddy/Compose health;
- RU/EN/ZH live smoke;
- API/DB/role/tenant/read-only acceptance;
- rollback evidence;
- никакого утверждения `live` до PASS всей цепочки.

### R5. Analytics, SEO, communications и legal

Аналитика:

- новые события: `gekta_*`;
- raw `tai_*` history не переписывается;
- semantic/reporting layer объединяет обе серии;
- дата ребрендинга отмечается, чтобы не создавать ложный рост или падение.

SEO:

- новые canonical URL;
- 301 redirects с сохранением query/UTM;
- обновление sitemap и внутренних ссылок;
- отсутствие redirect chains и duplicate pages;
- старые redirects сохраняются постоянно, если это безопасно.

Коммуникации:

- ограниченный переходный текст: `TAI теперь называется Гекта`;
- после завершения переходного окна публично остаётся только Гекта;
- обновить CRM, support macros, sales decks, КП, email/push/PDF и обучающие материалы.

Legal:

- проверить обозначение и сходство;
- проверить домены и usernames;
- подготовить регистрацию товарного знака;
- обновлять только новые версии договоров и шаблонов;
- ранее подписанные документы не переписывать.

### R6. Legacy removal

Legacy можно удалить только при одновременном выполнении условий:

- telemetry показывает отсутствие использования за утверждённый период;
- договорный срок поддержки завершён;
- external owners уведомлены;
- rollback больше не зависит от legacy identifier;
- production acceptance проходит без compatibility layer.

После R6 любое активное TAI-вхождение вне allowlist является дефектом.

## 5. Работа с открытыми PR

В момент создания epic в репозитории существуют открытые TAI/runtime/production PR. Массовый rename поверх них создаст ложные конфликты и может потерять уже проверенные исправления.

Перед каждым rebrand PR:

1. зафиксировать exact main;
2. получить перечень открытых PR, меняющих те же файлы;
3. не переименовывать файл во время незавершённого recovery/security fix;
4. сначала интегрировать критический fix или закрыть superseded PR;
5. затем переносить итоговый main-state в Gekta namespace;
6. не смешивать production incident remediation с брендовым изменением.

## 6. Неизменяемая история

Не переписывать:

- Git commits и tags;
- PR/issue history;
- audit logs;
- старые immutable migrations;
- подписанные документы и ранее выпущенные счета;
- user-generated content;
- хешированные или подписанные release evidence;
- уже выпущенные OCI/model/object-storage artifacts.

Такие упоминания учитываются в allowlist как history, а не считаются незавершённым ребрендингом.

## 7. Definition of Done

Полный ребрендинг завершён, когда:

1. пользователь нигде не видит TAI вне завершённого переходного уведомления;
2. active code использует `Gekta/gekta/GEKTA`;
3. Gekta routes, packages, events и services являются primary authority;
4. старые identifiers либо удалены, либо формально allowlisted как временная compatibility/history;
5. история диалогов, данные, analytics и evidence сохранены;
6. все rebrand, type, unit, integration, E2E, accessibility и production gates проходят;
7. REG.RU запускает exact intended revision и live acceptance PASS;
8. итоговый inventory не содержит неразрешённых TAI-вхождений.

## 8. Текущий статус

Этот документ и governance scope не изменяют runtime и не подтверждают production deployment.

Текущий статус: **R0 — начат; production rebrand — не выполнен**.
