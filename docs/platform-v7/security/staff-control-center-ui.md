# Staff Control Center UI

## Статус

Этот документ описывает реализованный web-контур для внутреннего Staff Access Control Plane. Он не означает production activation: интерфейс становится рабочим только после развёртывания auth API, PostgreSQL migrations, secret-scoped keys, создания PLATFORM_OWNER и прохождения production E2E.

## Маршруты

- `/platform-v7/staff` — внутренний control center.
- `/platform-v7/staff/view-as` — временный read-only VIEW_AS контекст.
- `/api/staff/control/*` — same-origin BFF для control-plane session.
- `/api/staff/delegated/*` — same-origin BFF для delegated VIEW_AS/ASSISTED/OPERATIONS session.

## Session boundary

Access JWT и opaque staff session не доступны клиентскому JavaScript.

BFF использует два разных HttpOnly cookie:

- `pc_staff_control_session` — CONTROL_PLANE/JIT_PRIVILEGED;
- `pc_staff_delegated_session` — VIEW_AS/ASSISTED/OPERATIONS/BREAK_GLASS.

Это предотвращает замену owner control session при переходе в кабинет клиента.

Для mutation BFF требует same-origin `Origin`, ограничивает тело 64 KiB, отклоняет path traversal, не следует redirect, использует timeout и `no-store`. Opaque token удаляется из activation response до ответа браузеру.

## Control Center

После обычного password + MFA пользователь получает только список своих staff assignments. Standing assignment не открывает privileged workspace.

Для работы пользователь:

1. выбирает staff assignment;
2. указывает reason и ticket;
3. запрашивает CONTROL_PLANE grant;
4. при необходимости ждёт независимое approval;
5. активирует ограниченную по времени opaque session.

Доступные разделы формируются по фактическим ответам API:

- обзор;
- организации и пользователи;
- staff assignments;
- access requests и approvals;
- active sessions и revoke;
- append-only audit и chain verification;
- break-glass activations.

Fake counters и демонстрационные организации запрещены.

## VIEW_AS

VIEW_AS создаётся отдельным запросом с точными:

- tenant;
- organization;
- projected business role;
- reason;
- ticket;
- TTL.

Страница VIEW_AS постоянно показывает:

- режим `READ_ONLY_VIEW_AS`;
- actual actor;
- actual staff role;
- effective organization и role;
- countdown до expiration;
- явную кнопку завершения.

UI не создаёт бизнес-сессию и не меняет business role пользователя. Query parameters используются только для выбора route; backend повторно проверяет opaque delegated session и exact scope.

Запрещённые authoritative actions отображаются как guardrails и остаются запрещёнными сервером:

- payment release/reserve;
- bank callback confirmation;
- document signing;
- laboratory finalization;
- acceptance signing;
- arbitration decision.

## Роли внутренних сотрудников

- PLATFORM_OWNER — глобальный control center и read-only VIEW_AS, но не подмена authoritative actor.
- PLATFORM_ADMIN — пользователи, assignments, requests, sessions и configuration в пределах permission ceiling.
- SUPPORT_L1 — обращения и безопасная помощь без customer content.
- SUPPORT_L2 — time-bound support access и ограниченный VIEW_AS.
- OPERATIONS_AGENT/SUPERVISOR — очереди, blockers, SLA и state-machine operations.
- FINANCE_OPS — reconciliation и review без произвольного движения денег.
- COMPLIANCE_STAFF — checks, restrictions и investigations.
- DEVELOPER — diagnostics без постоянного customer access.
- SRE_ONCALL — JIT или break-glass для incident response.
- SECURITY_AUDITOR — immutable audit и privileged-session review.
- BREAK_GLASS_ADMIN — аварийный контур максимум 15 минут.

## Mobile first и доступность

Контур проектируется сначала для телефона:

- фиксированная нижняя навигация;
- safe-area;
- touch targets не менее 44 px;
- отсутствие горизонтального overflow;
- semantic forms, labels, live status и alert;
- reduced-motion;
- forced-colors;
- RU/EN/ZH без client-side DOM translator.

## Production acceptance

До production activation обязательны:

1. API_URL на реальный auth API по HTTPS.
2. Отдельные deal/auth PostgreSQL principals.
3. Production migrations и доказанный rollback/PITR.
4. PLATFORM_OWNER bootstrap через isolated auth principal.
5. Password → MFA → control session E2E.
6. Owner org directory и VIEW_AS E2E.
7. Support/operator/developer/SRE permission ceiling E2E.
8. JIT two-person approval.
9. Session revoke и assignment revoke cascade.
10. Break-glass notification/expiry/post-incident review.
11. Audit chain verification.
12. Browser, WebKit, mobile, Axe, Lighthouse, load и concurrency acceptance.

До этого корректная формулировка: **Staff Control Center UI и BFF реализованы архитектурно; production staff access не активирован**.
