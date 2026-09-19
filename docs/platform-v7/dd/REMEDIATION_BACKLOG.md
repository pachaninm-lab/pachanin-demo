# Remediation Backlog & Go-Live Runbook — platform-v7 / «Прозрачная Цена»

Дата: 2026-06-15. Назначение: превратить аудит + 12 DD в исполнимый план до
go-live. Зрелость: controlled-pilot / pre-integration. Источники находок —
`../audit/AUDIT_REPORT.md` и `./*`.

Колонка **Owner**: `in-scope` (закрывается autopilot-PR), `api-PR`
(нужен `apps/web/app/api/**` — вне autopilot-scope), `hosting-PR`
(`vercel.json`/`netlify.toml`/`next.config`/`.github/workflows` вне allowed-scope),
`owner-side` (договоры/credentials/инфраструктура/юр.).

## 0. Уже закрыто в этой серии (код, в main)

| ID | Что | PR |
|----|-----|-----|
| UX-001 | Токенизация цветов money/bank экранов (тёмная тема) | #1811 |
| UX-002 | Alpha бордера на тёмной теме | #1812 |
| SEC-003 (utility) | Серверная утилита field-masking + тесты (готова к wiring) | #1814 |
| — | 8 audit-deliverables + 12 DD-документов | #1810, #1813 |
| — | SOT-синк, live-QA evidence | #1808, #1809 |

## 1. Реестр находок → действие → владелец

| ID | Severity | Действие (fix) | Owner | Зависит от |
|----|----------|----------------|-------|-----------|
| SEC-001 | HIGH→CRIT | Извлекать актора из подписанной сессии/JWT на API-границе; reject если body-актор ≠ session | api-PR + owner-side (IdP) | IdP |
| SEC-002 | HIGH | `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced` + серверный cabinet-guard в middleware | owner-side (флаг) + api-PR (middleware) | — |
| SEC-003 | HIGH | Подключить `platformV7MaskRecordForRole` на API-ответах (утилита готова, #1814) | api-PR | #1814 ✅ |
| SEC-004 | HIGH | MFA (TOTP/WebAuthn) | owner-side (IdP) | IdP |
| SEC-005 | MED | SAML/OIDC (ЕСИА/СберБизнес ID), маппинг claims→`role-canonical` | owner-side | договор IdP |
| SEC-006 | HIGH | CSP: nonce/`strict-dynamic`, убрать `unsafe-eval` | hosting-PR | — |
| SEC-007 | MED | HMAC/подпись + rate-limit на bank-callback | api-PR + owner-side | договор банка |
| SEC-008 | MED | Снять/сузить `ignoreBuildErrors`/`ignoreDuringBuilds` (tsc уже зелёный) | hosting-PR | — |
| SCA-001 | MED | Прогон Dependabot/`pnpm audit`, обновить транзитивы (socket.io) | owner-side (deps-PR/lockfile) | — |
| OSS-001 | MED | CI license-scan (allowlist), fail на copyleft в runtime | hosting-PR (workflow) | — |
| OSS-002 | LOW | Генерация SBOM (CycloneDX/SPDX) на релиз | hosting-PR (workflow) | — |
| CMP-001 | HIGH | Consent-модель (согласие/цель/дата) + UI | in-scope (модель) + owner-side (юр.) | — |
| CMP-002 | MED | Экспорт/удаление ПД по субъекту | in-scope (функция) + api-PR | БД |
| CMP-003 | LOW | Заметка о локализации хранения ПД (152-ФЗ ст.18) | owner-side (doc/инфра) | БД-регион |
| CMP-004 | HIGH | Full AML — только с банком (НЕ клеймить) | owner-side (банк) | договор банка |
| AUD-001 / SOC2-001 | MED | Durable WORM audit-sink (реализация `P7PersistenceDriver` на БД) | owner-side (БД) | реальная БД |
| SOC2-003 | LOW | before/after контент-хеш в audit-event | in-scope (аккуратный PR) | — |
| TECH-001/SEC-008 | MED | См. SEC-008 | hosting-PR | — |
| TECH-002 / CFG-001 | MED | Один канонический `next.config`; rewrites в `next.config` (паритет хостов) | hosting-PR | — |
| TECH-004 | MED | Реальная БД + миграции (Prisma в apps/api как основа) | owner-side | — |
| UX-003 | MED | Единый паттерн «один primary CTA» по кокпитам | in-scope (design-PR) | — |
| MOB-001 | MED | Визуальный прогон 390px на сетках/таблицах | owner-side (живой стенд) | — |
| INT-001/002/003 | MED | HMAC callback / реализация партнёрских API / hosting-parity | api-PR + owner-side | договоры |
| IP-001/002/003 | MED | Товарный знак, отчуждение прав, владение аккаунтами | owner-side (юр.) | — |
| LEG-001/002 | MED | Выверить privacy/terms; статус оператора 115-ФЗ | owner-side (юр.) | — |

## 2. Что ещё можно закрыть кодом (in-scope, без расширения scope)

Кандидаты на следующие узкие PR (не требуют owner-side доступов):
1. **CMP-001 (модель consent):** типы/функции согласия в `lib/platform-v7`
   (`consentGiven/Purpose/Date`) + тесты — готовые к подключению на онбординге.
2. **CMP-002 (экспорт/удаление по субъекту):** чистые функции выборки/редакции
   ПД по лицу поверх существующих моделей + тесты.
3. **SOC2-003:** before/after контент-хеш в audit-event (аккуратно, с тестом).
4. **UX-003:** единый CTA-паттерн (design-PR, согласовать визуально).
5. **Регрессионные guard-тесты:** расширить honesty/no-raw-hex проверки на
   остальные money/bank/document компоненты.

## 3. Go-Live Runbook (последовательность)

**Фаза A — Controlled pilot (GO по коду уже сейчас):**
1. `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced`; ограниченный круг участников.
2. Хостинг: Netlify активен (или разблокировать Vercel); план отката + health.
3. Без реальных платежей/боевых ПД (или с явным согласием + минимизацией).

**Фаза B — Pre-integration onboarding:**
4. Договоры/credentials по системам (банк/ФГИС/ЭДО/ЭПД/лаб/GPS); ENV в секреты.
5. Sandbox-стенды партнёров; реализация партнёрских API в shells (INT-002).
6. HMAC на bank-callback (SEC-007/INT-001).

**Фаза C — Go-live предусловия (обязательны):**
7. IdP (ЕСИА/СберБизнес ID) + MFA; **server-side binding актора** (SEC-001) +
   подключить `platformV7MaskRecordForRole` (SEC-003) + enforced серверный RBAC
   (SEC-002).
8. Реальная БД + миграции + durable WORM audit-sink (TECH-004/AUD-001).
9. 152-ФЗ (consent/локализация/права субъекта) + 115-ФЗ (с банком) +
   security/legal review; CSP nonce (SEC-006); SCA/SBOM/license-scan.
10. Номинальный счёт; переключение `ENVIRONMENT=production` только после
    подтверждения партнёрами; первая controlled-pilot сделка.

## 4. Definition of go-live ready
Все строки реестра §1 со статусом HIGH закрыты; БД+IdP+MFA+enforced RBAC живые;
договоры/credentials оформлены; security/legal review пройден; honesty-гейты и
аудит работают на durable-бэкенде. До этого момента статус остаётся
**controlled-pilot / pre-integration** — без claim'ов live/connected.
