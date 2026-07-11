# Staff Access Control Plane — production runbook

## Статус документа

Этот runbook описывает целевую production-процедуру. Наличие кода и миграций в репозитории не означает, что они уже применены в production. Активация допускается только через отдельное change window с PostgreSQL backup/PITR, migration evidence, rollback приложения и security approval.

## 1. Граница полномочий

Бизнес-роли участников сделки и внутренние роли платформы разделены.

- Бизнес-роль определяет действия организации в сделке.
- Staff assignment определяет внутренние полномочия сотрудника платформы.
- Staff assignment не является активной привилегированной сессией.
- Любой control-plane, view-as, assisted, operations или JIT доступ выполняется только через ограниченный по времени grant и opaque staff session.
- Actual actor никогда не заменяется effective customer subject.

## 2. Обязательные production prerequisites

Перед миграцией должны быть подтверждены:

1. Отдельные `DATABASE_URL` и `AUTH_DATABASE_URL`.
2. Deal principal: `NOSUPERUSER`, `NOBYPASSRLS`, не владелец защищённых таблиц.
3. Auth principal: отдельный principal, без `SELECT` к `public.deals` и другим business tables; разрешены только auth tables и утверждённые SECURITY DEFINER projections.
4. TLS к PostgreSQL, secret manager, rotation и audit доступа к секретам.
5. Рабочие backup/PITR и проверенный restore вне production.
6. `JWT_SECRET`, `AUTH_TOKEN_PEPPER`, `MFA_ENCRYPTION_KEY` и MFA ticket secret независимы и secret-scoped.
7. Central logs, alerts, correlation IDs, clock synchronization.
8. Два независимых сотрудника, способных одобрить JIT/critical request.

## 3. Применение миграций

Миграции применяются только forward-only:

- `20260711100000_staff_access_control_plane`;
- `20260711101000_staff_assignment_mfa_enforcement`;
- `20260711102000_staff_deal_scope_resolution`;
- `20260711103000_staff_audit_chain_enforcement`.

Порядок:

1. Создать backup/PITR checkpoint.
2. Проверить checksum артефакта и exact commit.
3. Выполнить `prisma migrate deploy` через migration principal.
4. Проверить таблицы, ограничения, append-only triggers и SECURITY DEFINER functions.
5. Выдать auth runtime principal только минимальные `SELECT/INSERT/UPDATE`, `SELECT/INSERT` для append-only audit и `EXECUTE` на утверждённые функции.
6. Подтвердить, что auth principal не читает `public.deals` напрямую.
7. Запустить PostgreSQL exploitation suite.
8. Не продолжать rollout при любом несовпадении.

Database migration не откатывается destructive SQL. При дефекте откатывается приложение; восстановление БД выполняется только через утверждённый PITR/restore procedure.

## 4. Создание первого PLATFORM_OWNER

Первый owner создаётся один раз после появления реального пользователя и завершения password/MFA enrollment.

Используется только:

```bash
AUTH_DATABASE_URL='postgresql://<isolated-auth-principal>' \
DATABASE_URL='postgresql://<isolated-deal-principal>' \
BOOTSTRAP_PLATFORM_OWNER_EMAIL='owner@example.com' \
BOOTSTRAP_PLATFORM_OWNER_REASON='Approved initial production platform owner bootstrap' \
BOOTSTRAP_PLATFORM_OWNER_CONFIRM='CREATE_PLATFORM_OWNER:owner@example.com' \
node scripts/bootstrap-platform-owner-auth.mjs
```

Скрипт fail-closed проверяет:

- `AUTH_DATABASE_URL` задан;
- `AUTH_DATABASE_URL != DATABASE_URL`;
- principal не superuser;
- principal является isolated auth principal;
- principal не имеет `SELECT` к `public.deals`;
- активного PLATFORM_OWNER ещё нет;
- целевой пользователь существует и ACTIVE;
- создаётся hash-chained audit event;
- staff assignment включает обязательное MFA.

Секреты и URL запрещено передавать в issue, PR, лог или чат.

## 5. Обычный доступ владельца

1. Вход по password + MFA.
2. Запрос `CONTROL_PLANE` grant.
3. Owner read-only control-plane grant может auto-approve только после свежего MFA.
4. Grant активируется в opaque staff session.
5. Все privileged endpoints требуют `X-Staff-Access-Session`.
6. Session содержит actual actor, mode, permissions, target scope, reason, ticket и expiration.

## 6. VIEW_AS

VIEW_AS предназначен только для просмотра реального кабинета.

Обязательные свойства:

- точный tenant и organization;
- при необходимости точный user, role и deal;
- read-only permission set;
- постоянный визуальный баннер;
- actual actor отображается и журналируется;
- срок сессии виден пользователю;
- явный выход из режима;
- никаких подписаний, лабораторных финализаций, приёмки, банковых подтверждений, release или arbitration decision.

## 7. Support

### L1

Разрешается:

- support cases;
- статус аккаунта;
- безопасная навигационная помощь;
- отправка приглашений и recovery flow;
- технические статусы без document content.

Запрещается:

- customer cabinet VIEW_AS;
- договоры и банковые данные;
- изменение сделки;
- MFA secrets и пароли.

### L2

Дополнительно через ticket, approval и time-bound session:

- read-only VIEW_AS;
- ограниченный document content;
- session revocation;
- diagnostic bundle;
- идемпотентный повтор безопасной операции.

## 8. Operations

Operations работают только через state machine и операционные команды:

- queue/control tower;
- SLA и blockers;
- запрос документов;
- manual review;
- route/escalation;
- безопасный retry.

Operations не заменяют банк, лабораторию, элеватор, подписанта или арбитра.

## 9. Developer и SRE

Постоянно доступны только обезличенные diagnostics, metrics, traces, health, deployment history и synthetic results.

Customer context или production write:

- только JIT;
- ticket и reason;
- свежий MFA;
- минимум два независимых approver для JIT privileged;
- срок 15–60 минут;
- read-only по умолчанию;
- точный tenant/resource scope;
- полный audit.

## 10. Break-glass

Break-glass используется только для аварийного восстановления доступности.

- максимум 15 минут;
- отдельный assignment;
- свежий MFA;
- причина не менее 20 символов;
- incident ticket;
- немедленное уведомление owner/security;
- запрет payment authority;
- автоматическое истечение;
- обязательный post-incident review.

Break-glass не используется для обычной поддержки и не заменяет JIT approval.

## 11. Критические действия

Staff никогда не получает право выполнять за authoritative actor:

- `payment:release`;
- `payment:reserve`;
- `bank-callback:confirm`;
- `document:sign`;
- `lab:finalize`;
- `acceptance:sign`;
- `arbitration:decide`.

Другие чувствительные staff actions требуют:

- exact payload hash;
- два независимых approver;
- запрет self-approval;
- ограниченный TTL;
- одноразовое consumption;
- optimistic concurrency;
- audit event.

## 12. Отзыв и offboarding

При изменении или отзыве staff assignment PostgreSQL автоматически отзывает активные grants и sessions.

Offboarding включает:

1. revoke assignment;
2. revoke business memberships при необходимости;
3. revoke refresh/session family;
4. disable account;
5. rotate shared emergency secrets, если были затронуты;
6. проверить активные grants/sessions;
7. сохранить audit evidence.

## 13. Наблюдаемость и alerts

Обязательные alerts:

- break-glass activated/expired;
- JIT request/approval;
- self-approval attempt;
- cross-tenant deny;
- expired/revoked token reuse;
- critical payload mismatch;
- audit chain continuity violation;
- repeated authorization failures;
- staff assignment create/revoke;
- access outside normal geography/device pattern.

## 14. Production acceptance

Контур считается подтверждённым только после:

- exact migrations applied;
- isolated principals verified;
- owner bootstrap evidence;
- real password → MFA → session;
- owner CONTROL_PLANE and VIEW_AS E2E;
- support/operator/developer/SRE permission ceiling E2E;
- JIT two-person approval E2E;
- break-glass expiry and notification E2E;
- assignment revocation immediately kills grants/sessions;
- audit chain verify;
- load/concurrency tests;
- incident and rollback rehearsal.

До выполнения этих пунктов допустимая формулировка: **архитектура и isolated PostgreSQL exploitation gate реализованы; production activation не подтверждена**.
