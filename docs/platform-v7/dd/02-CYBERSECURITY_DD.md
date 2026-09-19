# Cybersecurity Due Diligence — platform-v7

Дата: 2026-06-15. Зрелость: controlled-pilot. Консолидирует
`../audit/SECURITY_READINESS.md` в формат DD. Severity — по состоянию «перед
go-live».

## Сводка

| ID | Область | Severity | Файл | Статус |
|----|---------|----------|------|--------|
| SEC-001 | AuthN/AuthZ binding | HIGH→CRITICAL@go-live | `app/api/platform-v7/actions/route.ts`, `server-action-route-body-reader.ts` | owner-side/api-PR |
| SEC-002 | Cabinet-RBAC enforcement | HIGH | `cabinet-access-policy.ts` | флаг (by-design pilot) |
| SEC-003 | Field-masking server-side | HIGH | `role-access.ts`, `DocumentPreviewGate.tsx` | open |
| SEC-004 | MFA | HIGH | — | owner-side (IdP) |
| SEC-005 | SSO (SAML/OIDC) | MEDIUM | `tenant-model.ts` (placeholder) | owner-side |
| SEC-006 | CSP unsafe-inline/eval | HIGH | `apps/web/vercel.json` | owner-side/hosting-PR |
| SEC-007 | Webhook signature (bank) | MEDIUM | `app/api/sim/bank-callback/route.ts` | owner-side (live) |
| SEC-008 | Build-gates off | MEDIUM | `next.config.mjs` | open |
| SCA-001 | Dependencies | MEDIUM | `apps/web/package.json` | monitored |

## Сильные стороны (подтверждено кодом)

- **Серверный auth-контур** (`middleware.ts`): constant-time `safeEqual`,
  whitelist ролей, session-cookie с проверкой роли/срока, security-headers,
  private-mode Basic Auth.
- **Нет secret-leakage:** `.env.example` только `NEXT_PUBLIC_*`; в
  `vercel.json`/`netlify.toml` секретов нет; `.env*` не закоммичены.
- **Нет `eval`/`new Function`.** `process.env` используется корректно.
- **Honesty-gate** `canClaimProviderLive` (8 условий) + `doesNotConfirmExternally:
  true` на всех внешних результатах — защита от fake-live.
- **CodeQL** и **dependency-review** (fail-on critical) — активные CI-гейты.

## Ключевая находка (проверена чтением кода)

**SEC-001** — `actions/route.ts` принимает `actorId`/`actorRole` из тела без
сверки с серверной сессией. Сейчас endpoint — контракт-эвалюатор на per-request
in-memory repo (`server-action-route-handler.ts:88`), живых денег/БД нет ⇒ не
эксплуатируем как «выпуск денег» в пилоте; **до go-live обязателен** server-side
binding актора к подписанной сессии/JWT. `app/api` — forbidden zone autopilot ⇒
owner-side/отдельный api-PR.

## DAST-readiness
Перед penetration-тестом закрыть SEC-001/002/003 (auth-границы), SEC-006 (CSP
nonce/`strict-dynamic`), включить enforced-RBAC серверно. Error-поверхность route
структурирована (`not_accepted`/400/403) без stack-leak. Полноценный DAST —
owner-side (нужен живой стенд).

## Уже исправлено в этой серии
UX-001/UX-002 (тема денежных/банковских экранов) — это UX/доступность, не
security, но снимает риск нечитаемых статусов на тёмной теме у банка-ревьюера.

## Вердикт (Cybersecurity)
Базовая гигиена сильная (нет секретов/eval, серверный auth, honesty-гейты, CodeQL).
Главный блокер go-live — SEC-001 (identity binding) + IdP/MFA + enforced RBAC +
CSP. Все — owner-side либо вне scope autopilot (app/api, hosting).
