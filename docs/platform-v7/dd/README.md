# Due Diligence pack — platform-v7 / «Прозрачная Цена»

Дата: 2026-06-15. Зрелость: **controlled-pilot / pre-integration / adapter-ready**
(НЕ live, НЕ bank/FGIS/EDO-connected). Пакет DD «как перед продажей/передачей
банку или стратегическому покупателю». Основан на инвентаризации кода; бизнес-
логика не менялась.

## Документы
1. `01-TECHNICAL_DD.md` — архитектура, стек, качество, тесты/CI, БД, эксплуатация.
2. `02-CYBERSECURITY_DD.md` — SAST/secrets/auth/CSP, SEC-001…008, CodeQL.
3. `03-IP_AUDIT.md` — права на код/бренд/домены, авторство.
4. `04-OSS_LICENSE_AUDIT.md` — лицензии зависимостей, SBOM, Dependabot.
5. `05-SSO_IAM_READINESS.md` — SSO/OIDC/MFA, роли, tenant, сессия.
6. `06-AUDIT_TRAIL_REVIEW.md` — actor/role/object/action/before-after/denied/export.
7. `07-INTEGRATION_READINESS.md` — adapter seam, bank callback/reconciliation, honesty-gate.
8. `08-PRODUCT_DD.md` — продукт, роли/кабинеты, UX, зрелость.
9. `09-COMMERCIAL_DD.md` — сегмент, монетизация (owner-side), traction.
10. `10-LEGAL_DD.md` — правовой каркас в коде, страницы privacy/terms, регуляторика.
11. `11-DATA_PROTECTION_152FZ.md` — перс.данные, consent, локализация, права субъекта.
12. `12-PILOT_READINESS_REVIEW.md` — Go/No-Go для controlled pilot.

Доменные технические отчёты-первоисточники — в `../audit/`.

## Сквозной вердикт
- **Code-ready для controlled pilot:** да.
- **Pre-integration partner onboarding:** да (адаптеры за ENV/credentials).
- **Остаётся только owner-side:** договоры, credentials, live API, server-side
  identity/сессия+MFA, реальная БД/миграции, security/legal review, номинальный
  счёт, первая pilot-сделка.

## Severity-реестр (сводно)
Полный реестр — `../audit/AUDIT_REPORT.md`. Главный блокер go-live — **SEC-001**
(binding актора к серверной сессии). В этой серии закрыты UX-001/UX-002
(читаемость денежных/банковских экранов на тёмной теме).
