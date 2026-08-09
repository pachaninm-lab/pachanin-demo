# Production P0: приёмка первой регистрации

Этот контур доказывает только путь первой регистрации на каноническом REG.RU VPS для точного текущего `main`. Он не меняет production, не создаёт staff-аккаунт, не подменяет PostgreSQL-события и не является общей аттестацией всей платформы.

## Запуск

Единственная разрешённая команда владельца в issue `#3072`:

```text
/production accept-p0-registration current-main
```

`workflow_dispatch` отсутствует. Workflow до любого внешнего действия подтверждает владельца комментария, `github.actor`, `github.triggering_actor`, чистый checkout и точный SHA текущего `main`. После проверки он повторно доказывает, что `main` не изменился.

Сначала должен завершиться точный production-релиз этого SHA. Публичный `/api/health/ready` и OCI labels API, Web и migration image обязаны совпасть с ним.

## Защищённые prerequisites

В GitHub Actions должны быть настроены существующие pinned-SSH secrets production-контура и следующие acceptance secrets:

- `PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE` — уникальный адрес с обязательными `{run}` и `{slot}`;
- `PC_PROD_P0_MAILBOX_IMAP_HOST`, `PC_PROD_P0_MAILBOX_IMAP_PORT`, `PC_PROD_P0_MAILBOX_IMAP_USER`, `PC_PROD_P0_MAILBOX_IMAP_PASSWORD`;
- `PC_PROD_P0_STAFF_EMAIL`, `PC_PROD_P0_STAFF_PASSWORD`, `PC_PROD_P0_STAFF_TOTP_SECRET` существующего `PLATFORM_OWNER`.

Workflow не создаёт и не повышает staff-пользователя. При отсутствии assignment, свежего MFA, `STAFF_REQUEST_APPROVE`, защищённой staff session или mailbox acknowledgement он завершается ошибкой.

## Что именно доказывается

1. Через публичный Web BFF создаются две уникальные run-scoped заявки продавцов с разными организациями.
2. Ответ регистрации не раскрывает `applicationId`, status token или verification token.
3. Транспорт сообщает delivery, IMAP подтверждает фактическое получение, одноразовая ссылка проверяется через BFF, а повторное использование token получает `REGISTRATION_EMAIL_TOKEN_INVALID`.
4. Существующий `PLATFORM_OWNER` входит с TOTP, активирует ограниченную `CONTROL_PLANE` session с `staff-request:read` и `staff-request:approve` и одобряет обе заявки только через Web BFF.
5. Для каждого решения обязательны `idempotency-key`, отдельный correlation ID, статус `ACTIVATED` и подтверждённое письмо о решении. Exact replay одного решения с тем же ключом обязан вернуть `replayed=true` без `notificationDelivered`, то есть не запускать повторную отправку.
6. Оба клиента входят, завершают MFA enrollment, получают server-resolved cabinet `seller` и оказываются в разных tenant/organization.
7. Клиент A выполняет разрешённое действие `auction.lot.register`; A читает созданный workspace, а клиент B получает точный `AUCTION_LOT_NOT_ACCESSIBLE` на известный существующий lot.
8. Оба клиента выходят, `/api/auth/me` возвращает 401, затем выполняют свежий password+TOTP login.
9. В read-only транзакциях под реальным runtime principal PostgreSQL возвращает lot для tenant A и ноль строк для tenant B; роль обязана быть `NOSUPERUSER`, `NOBYPASSRLS`, а `auction.lots` — `ENABLE` + `FORCE RLS`.
10. Prisma-клиент exact-SHA API image подключается с защищённым `DATABASE_URL` подтверждённого exact-SHA migration service только на время read-only транзакции, переключается на membership-free `pc_registration_receipt_authority` и читает ровно две причинные записи `auth.registration.lifecycle.receipt`. Для каждой совпадают application version, approval/activation events, immutable audit hash, decision correlation и ключ `registration-lifecycle:<applicationId>:<version>`.

Если точный SHA не содержит или не произвёл этот outbox producer, результат всегда `MISSING_P0_CAUSAL_OUTBOX_PRODUCER`. Workflow не вставляет запасное событие и не принимает несвязанную outbox-запись.

## Артефакт

Успех создаёт `artifacts/production-p0-first-customer-acceptance/acceptance.json` с точным SHA, PASS-маркерами, non-secret IDs audit/outbox и хешами адресов.

Артефакт не содержит адреса пользователей, passwords, bearer/cookie values, raw verification/status tokens, TOTP secrets/codes, mailbox credentials, private keys или защищённые пути сервера. Временные локальные и VPS-файлы удаляются независимо от результата.

Ключевые итоговые маркеры:

```text
P0_TWO_REGISTRATIONS=PASS
P0_TRANSACTIONAL_MAIL=PASS
P0_DECISION_REPLAY_NOTIFICATION=PASS
P0_STAFF_MFA_AND_PROTECTED_SESSION=PASS
P0_CABINET_ACTION_LOGOUT_RELOGIN=PASS
P0_TENANT_RLS=PASS
P0_CAUSAL_AUDIT_OUTBOX=PASS
P0_FIRST_CUSTOMER_ACCEPTANCE=PASS
```
