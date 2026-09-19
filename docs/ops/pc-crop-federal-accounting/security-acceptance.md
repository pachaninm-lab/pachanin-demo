# Security Acceptance Matrix — PC-CROP Federal Accounting

§O контракта: security — release-blocking. §32: контроль не считается выполненным по наличию
текста или конфига; нужен исполнимый тест или evidence.

Статус на live main `9b07e3190ab48476cba46082a99c01d5fba1bedc`.
Новый код в рамках этой программы не написан ⇒ новых security-находок не внесено.

| Статус | Значение |
|---|---|
| `BASELINE` | Контроль существует в платформе и покрыт тестом |
| `PARTIAL` | Существует, но без доказательства уровня §32 |
| `REQUIRED` | Требуется контрактом, в коде отсутствует |
| `BLOCKED` | Невозможно проверить в этом окружении |

---

## Identity (§34, NIST SP 800-63-4)

| Контроль | Статус | Доказательство / пробел |
|---|---|---|
| Современный хеш пароля, без plaintext | BASELINE | `User.passwordHash`, PR #2276 |
| MFA + одноразовые backup-коды | BASELINE | PR #2280 «One-time MFA backup-code consumption» |
| Ротация и отзыв сессий | BASELINE | PR #2276 «session rotation, revocation» |
| Инвентарь собственных сессий пользователю (§63 `/security/sessions`) | REQUIRED | API отсутствует |
| Step-up для смены реквизитов/подписи/интеграций | REQUIRED | не найдено |
| Passkeys/WebAuthn для owner/admin/signers | REQUIRED | не найдено |
| Recovery не обходит MFA | PARTIAL | требуется явный negative-тест |

## Изоляция арендаторов (§35)

| Контроль | Статус | Доказательство |
|---|---|---|
| `ENABLE`+`FORCE ROW LEVEL SECURITY` | BASELINE | 42 файла (EV-008) |
| Runtime-принципал без `BYPASSRLS` | BASELINE | `infra/kind/production-like/postgresql-principals-bootstrap.sql`, PR #2287 |
| Negative-тест A→B | BASELINE | `apps/api/test/tenant-leakage.e2e-spec.ts` |
| Проверки RLS в SQL | BASELINE | `scripts/sql/identity-rls-{tenant,staff,no-inert-policies}-checks.sql` |
| Изоляция по `organization_id` внутри тенанта для нового бух-контура | REQUIRED | сущности ещё не созданы |

## API (§36) / Web (§37)

| Контроль | Статус |
|---|---|
| Идемпотентность мутаций | PARTIAL — `WebhookIdempotency` только для банковского callback-слайса |
| Общий durable integration inbox | REQUIRED — IR-21, заблокирован (GOV-5) |
| Оптимистичный concurrency `version` | BASELINE — `Deal`, `Organization`, `UserOrg` |
| Advisory-локи против двойного финансового эффекта | BASELINE — PR #2404 |
| Запрет юр. документов/токенов в localStorage | REQUIRED — §37; в Wave 2 требуется аудит `apps/web` |

## Коннекторы (§38) / OAuth и webhooks (§39)

Все контроли — `REQUIRED`: `ConnectorInstallation`, `OrganizationBinding`, machine identity,
typed command allowlist, подписанные пакеты обновления, PKCE/state/nonce, привязка callback
к connection_intent. В коде отсутствуют (EV-010).

## Документы (§40)

| Контроль | Статус |
|---|---|
| Неизменяемость подписанной версии + `payload_hash` | REQUIRED |
| `UkepCertificate` как основа signing authority | PARTIAL — нет МЧД, лимитов суммы, типов документов |
| Correction workflow | PARTIAL — `packages/domain-core/src/document-correction-workflow.ts` |

## Anti-fraud (§41) / Insider (§42) / Персонал (§43)

| Контроль | Статус |
|---|---|
| Модуль `anti-fraud` | PARTIAL — есть модуль, нет persisted `fraud_*` |
| KYC/AML/санкции | BASELINE — `KycTask`, `Organization.kycStatus/amlStatus/sanctionHit` |
| Смена банковских реквизитов → step-up + независимое уведомление + hold | REQUIRED |
| Two-person rule | REQUIRED |
| Staff JIT / break-glass | PARTIAL — модуль `staff-access` есть, TTL/reason/post-use review не доказаны |

## AI / ГЕКТА (§44, OWASP GenAI)

| Контроль | Статус |
|---|---|
| Изоляция личного аккаунта ГЕКТА | BASELINE — миграции `gekta_product_session_scope`, `gekta_registration_identity` |
| Аудит операторских действий | PARTIAL — `GektaOperatorAudit` |
| Organization-scoped контекст, выводимый только сервером | REQUIRED |
| Защита от prompt injection (документ = недоверенные данные) | REQUIRED |
| Запрет прямой мутации из вывода модели | REQUIRED — явного enforcement не найдено |

## Supply chain / CI-CD (§45)

| Контроль | Статус |
|---|---|
| Secret scanning | BASELINE — `.gitleaksignore` присутствует |
| CodeQL / SAST | BASELINE — каталог `codeql/`, `security-quality-gate.yml` |
| Защита ветки, запрет прямого push в main | BASELINE — `progress.json: noDirectPushToMain` |
| Exact-SHA production | BASELINE — `scripts/production-full-stack-exact-sha.sh` |
| SBOM | REQUIRED |
| **Зелёный проход quality gate** | BLOCKED — 0 успешных прогонов из последних 30 (EV-020) |

## Backup / DR (§50)

| Контроль | Статус |
|---|---|
| Forward-only backup + изолированная DR-репетиция | PARTIAL — PR #2291 |
| `RESTORE_PROVEN` | BLOCKED — `autopilot-state.json`: «provider PITR/restore … unproven» |
| Ransomware drill | REQUIRED |

---

## Вывод

Release-blocking находок, внесённых этой программой: **0** (код не менялся).
Контролей уровня `REQUIRED`, обязательных по контракту до Wave 12: **не менее 24**.
Ни один из них не может быть реализован до снятия `GOV-1..GOV-3`.
