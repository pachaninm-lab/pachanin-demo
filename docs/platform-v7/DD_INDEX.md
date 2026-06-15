# DD_INDEX — platform-v7 / «Прозрачная Цена»

Единый навигатор по пакету Due Diligence для покупателя/банка. Дата: 2026-06-15.
Зрелость: **controlled-pilot / pre-integration / adapter-ready** (НЕ live, НЕ
bank/FGIS/EDO-connected).

## 1. Базовые audit-отчёты (`docs/platform-v7/audit/`)
- `AUDIT_REPORT.md` — мастер + сводный реестр находок.
- `SECURITY_READINESS.md` — SAST/secrets/auth/CSP, SEC-001…008.
- `SSO_IAM_READINESS.md` — SSO/OIDC/MFA, роли, tenant, сессия.
- `SOC2_READINESS.md` — access/change-mgmt/audit/incident/monitoring/evidence.
- `SBOM_READINESS.md` — зависимости/SCA/SBOM-чеклист.
- `VISUAL_UX_AUDIT.md` — визуал/UX/dark-light/bank-view.
- `MOBILE_QA_REPORT.md` — 390×844/overflow/touch/font/field-mode.
- `BANK_BUYER_DD_CHECKLIST.md` — чеклист для банка-покупателя.
- `UX_CTA_CONVENTION.md` — конвенция иерархии CTA (UX-003).

## 2. Пакет Due Diligence 1–12 (`docs/platform-v7/dd/`)
1. `01-TECHNICAL_DD.md` · 2. `02-CYBERSECURITY_DD.md` · 3. `03-IP_AUDIT.md`
· 4. `04-OSS_LICENSE_AUDIT.md` · 5. `05-SSO_IAM_READINESS.md`
· 6. `06-AUDIT_TRAIL_REVIEW.md` · 7. `07-INTEGRATION_READINESS.md`
· 8. `08-PRODUCT_DD.md` · 9. `09-COMMERCIAL_DD.md` · 10. `10-LEGAL_DD.md`
· 11. `11-DATA_PROTECTION_152FZ.md` · 12. `12-PILOT_READINESS_REVIEW.md`.
- `REMEDIATION_BACKLOG.md` — реестр находок → владелец → PR + go-live runbook.

## 3. Закрыто кодом в ходе аудита (in-scope, в main)
- UX-001 (#1811), UX-002 (#1812) — читаемость money/bank экранов на тёмной теме.
- SEC-003 (#1814) — `lib/platform-v7/server-field-masking.ts` (серверное
  маскирование полей по роли + тесты).
- CMP-001/CMP-002 (#1816) — `lib/platform-v7/data-subject-rights.ts` (consent,
  минимизация, экспорт/удаление по субъекту + тесты).
- SOC2-003 — `lib/platform-v7/audit-content-hash.ts` (before/after отпечаток).
- Постоянный guard «no fake-live claims» (тест по всему platform-v7).

Все эти утилиты — каркас, готовый к подключению; активируются owner-side при
реальной БД/API/IdP.

## 4. Сквозной вердикт (item 20)
- **Code-ready для controlled pilot:** да.
- **Pre-integration partner onboarding:** да (адаптеры за ENV+credentials,
  honesty-gate `canClaimProviderLive`).
- **Только owner-side:** договоры, credentials, live API, server-side
  identity/сессия+MFA (SEC-001), enforced серверный RBAC, реальная БД/миграции +
  durable WORM-аудит, security/legal review (152-ФЗ/115-ФЗ), номинальный счёт,
  первая controlled-pilot сделка. Порядок — в `dd/REMEDIATION_BACKLOG.md`.

## 5. Дисклеймер
Документы — DD/readiness-аудиты на основе инвентаризации кода, не сторонние
сертификаты. Penetration Test, подписанный SBOM/license-scan, юридические
документы и коммерческие финансы — owner-side (внешние исполнители/договоры).
