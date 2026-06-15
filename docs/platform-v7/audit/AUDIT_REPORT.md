# platform-v7 / «Прозрачная Цена» — Pre-Sale Audit Report

Дата: 2026-06-15. Режим: аудит + точечная доработка, без переписывания платформы.
Зрелость: **controlled-pilot / pre-integration / adapter-ready** (НЕ live, НЕ
bank-connected, НЕ FGIS/EDO/EPD-connected).

Этот отчёт — результат инвентаризации кода (`apps/web/**/platform-v7/**`,
`apps/web/**/v7r/**`, `packages/domain-core/src/execution-simulation/**`,
`apps/web/middleware.ts`, `apps/web/app/api/**`, корневые манифесты и
hosting-конфиги) по 16 доменам due diligence. Бизнес-логика в этом PR не
менялась — это inventory/audit слой.

Отдельные доменные отчёты:
`SECURITY_READINESS.md`, `SSO_IAM_READINESS.md`, `SOC2_READINESS.md`,
`SBOM_READINESS.md`, `VISUAL_UX_AUDIT.md`, `MOBILE_QA_REPORT.md`,
`BANK_BUYER_DD_CHECKLIST.md`.

## Итоговый вердикт

- **Code-ready для controlled pilot:** внутренний runtime сделки (state-machine,
  деньги, документы, споры) работает на симуляции/моках поверх портов; RBAC на 27
  ролей с deny-by-default и аудитом отказов; append-only audit trail с экспортом
  по сделке; честные интеграционные seam'ы (mock↔real за ENV+credentials);
  observability/health-экраны; премиум-UX по ролям; тёмная/светлая темы.
- **Ready для pre-integration partner onboarding:** адаптеры банка/ФГИС/ЭДО/ЭПД/
  GPS/лаб/1С имеют production-shaped shells, включаются только при
  `NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT=production` И наличии credentials; bank
  callback + reconciliation с anti-double-release; honesty-gate против fake-live.
- **Остаётся только owner-side:** договоры (банк/ФГИС/ЭДО/ЭПД), API-доступы и
  credentials, номинальный счёт, провайдер identity (ЕСИА/СберБизнес ID, MFA),
  реальная БД + миграции, security/legal review (152-ФЗ/115-ФЗ), и **до
  production обязателен** server-side binding актора к сессии (см. SEC-001).

## Сводный реестр находок (severity по состоянию «перед go-live»)

| ID | Домен | Severity | Файл | Статус |
|----|-------|----------|------|--------|
| SEC-001 | AuthN/AuthZ | HIGH (→CRITICAL at go-live) | `apps/web/app/api/platform-v7/actions/route.ts`, `lib/platform-v7/server-action-route-body-reader.ts` | open (owner-side / app/api вне scope autopilot) |
| SEC-002 | RBAC enforcement | HIGH | `lib/platform-v7/cabinet-access-policy.ts`, `components/platform-v7/RbacCabinetGuard.tsx` | by-design (flag), задокументировано |
| SEC-003 | Field masking | HIGH | `lib/platform-v7/role-access.ts`, `components/platform-v7/DocumentPreviewGate.tsx` | open (server-side фильтрация при API/БД) |
| SEC-004 | MFA | HIGH | — (отсутствует) | owner-side (IdP) |
| SEC-005 | SSO/SAML/OIDC | MEDIUM | `lib/platform-v7/tenant-model.ts` (placeholder) | owner-side (IdP) |
| SEC-006 | CSP | HIGH | `apps/web/vercel.json` | open (nonce/strict-dynamic) |
| SEC-007 | Webhook auth | MEDIUM | `apps/web/app/api/sim/bank-callback/route.ts` | owner-side (HMAC при live) |
| SEC-008 | Build gates | MEDIUM | `apps/web/next.config.mjs` (`ignoreBuildErrors`/`ignoreDuringBuilds`) | open (сузить) |
| SCA-001 | Dependencies | MEDIUM | `apps/web/package.json` (Dependabot ~70 истор., critical Next.js пропатчен 14.2.35) | monitored (dependency-review gate) |
| CMP-001 | 152-ФЗ consent | HIGH | `lib/platform-v7/contact-vault.ts`, deal models | owner-side + future-PR |
| CMP-002 | 152-ФЗ export/delete по субъекту | MEDIUM | `lib/platform-v7/audit-evidence-export.ts` (по сделке, не по лицу) | future-PR |
| CMP-003 | Storage locality note | LOW | — | doc/owner-side |
| CMP-004 | 115-ФЗ full AML | HIGH | `lib/platform-v7/bank-compliance-pilot.ts` (флаги, не движок) | owner-side (банк) — НЕ клеймить |
| AUD-001 | Durable audit sink | MEDIUM | `lib/platform-v7/runtime/db-persistence-adapter.ts` (порт есть, БД нет) | owner-side (реальная БД) |
| UX-001 | Hardcoded hex (тема) | HIGH | `components/platform-v7/MoneyGateCard.tsx`, `P7BankPaymentBasisRuntimePanel.tsx` | fixable-in-scope |
| UX-002 | Border alpha на тёмной | MEDIUM | `apps/web/styles/theme.css` | fixable-in-scope |
| UX-003 | Multi-CTA на кокпите | MEDIUM | per-role pages | follow-up |
| MOB-001 | 390px overflow проверка | MEDIUM | mobile breakpoints | QA-task |
| CFG-001 | Дубль next.config + rewrites parity | MEDIUM | `next.config.js`/`.mjs`, `vercel.json` vs `netlify.toml` | owner-side (hosting-scope) |

Severity-нота: платформа в pilot/demo-режиме без реальной БД, денег и внешних
вызовов — поэтому ряд «critical-на-проде» пунктов сейчас не эксплуатируем, но
**обязателен к закрытию до go-live**. Каждый отдельный отчёт даёт risk/fix/test.

## Что безопасно исправить маленьким PR (без расширения scope)

В scope autopilot-guard (`apps/web/**/platform-v7/**`, `styles/**`, `tests/**`,
`docs/**`) безопасно и без изменения бизнес-логики:
- **UX-001 / UX-002:** вынести hardcoded hex в токены `--pc-*` с light/dark и
  поднять alpha бордера тёмной темы (визуальный слой, под тест на токены).
- **SEC-003 (частично):** добавить серверную утилиту фильтрации полей по роли
  (чистая функция + тест), готовую к подключению на API-границе.

Вне scope (forbidden zones autopilot: `apps/landing`, `apps/web/app/api`,
lockfiles): SEC-001/SEC-006/SEC-007/SEC-008/CFG-001 — это owner-side либо
отдельный явно-расширенный hosting/api PR.

## Метод и ограничения

- Аудит статический (чтение кода) + проверка живого smoke через CI (Netlify
  активен, Vercel заблокирован на уровне аккаунта — HTTP 402, см.
  `dual-hosting-operating-rules.md`).
- DAST/penetration и реальный SCA-скан с CVE — owner-side (нужен живой стенд и
  dependency graph); здесь — readiness-чеклисты, не сертификация.
- Ни одно утверждение в этих документах не заявляет live/bank-connected/
  FGIS-connected/EDO-connected. Любой «боевой» статус провайдера защищён
  honesty-gate `canClaimProviderLive` (8 условий, см. `SECURITY_READINESS.md`).
