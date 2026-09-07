# Где применяется опасная функциональность

Требование OWASP ASVS 5.0 **V15.1.5**.

Файл собирается из дерева, а не пишется руками:
`node scripts/security/build-dangerous-functionality-inventory.mjs`.
Правка вручную бессмысленна — следующий прогон её сотрёт, а тест на устаревание
уронит сборку.

Source SHA: `1eb81f4dea95625ba79410af4046c457aa897c10`
Файлов просмотрено: 1283

## Сводка

| категория | файлов |
| --- | ---: |
| Прямое выполнение SQL | 95 |
| Исходящие сетевые вызовы | 120 |
| Разбор JSON | 60 |
| Обращение к файловой системе | 6 |
| Предподписанные ссылки объектного хранилища | 3 |
| Запуск процессов | 1 |
| Динамическое выполнение кода | 0 |

## Категории

### Прямое выполнение SQL

**Почему опасно.** Запрос, собранный строкой, обходит параметризацию ORM. Здесь используются теговые шаблоны Prisma, но охват — место, где такая ошибка вообще возможна.

**Граница проверки.** Считаются файлы с вызовом, а не сами вызовы; безопасность конкретного запроса отсюда не следует.

**Найдено файлов: 95.**

- `apps/api/src/auth-mail-worker.ts`
- `apps/api/src/common/outbox/outbox.service.ts`
- `apps/api/src/common/prisma/database-principal-inspection.ts`
- `apps/api/src/common/prisma/outbox-database-principal-inspection.ts`
- `apps/api/src/common/prisma/rls-transaction.service.ts`
- `apps/api/src/common/prisma/storage-prisma.service.ts`
- `apps/api/src/common/security/rate-limit.repository.ts`
- `apps/api/src/main.ts`
- `apps/api/src/marketing-outbox-worker.ts`
- `apps/api/src/modules/accounting/accounting-document-version.repository.ts`
- `apps/api/src/modules/accounting/accounting-period.repository.ts`
- `apps/api/src/modules/accounting/accounting-source-snapshot.repository.ts`
- `apps/api/src/modules/accounting/advance.repository.ts`
- `apps/api/src/modules/accounting/connection-attestation.repository.ts`
- `apps/api/src/modules/accounting/connection-center.repository.ts`
- `apps/api/src/modules/accounting/deal-service.repository.ts`
- `apps/api/src/modules/accounting/document-transmission.repository.ts`
- `apps/api/src/modules/accounting/payment.repository.ts`
- `apps/api/src/modules/accounting/period-window.ts`
- `apps/api/src/modules/accounting/reconciliation.repository.ts`
- `apps/api/src/modules/accounting/work-task.deriver.ts`
- `apps/api/src/modules/accounting/work-task.repository.ts`
- `apps/api/src/modules/auctions/auction-authority.service.ts`
- `apps/api/src/modules/auctions/auction-command.service.ts`
- `apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts`
- `apps/api/src/modules/auth/accounting-document-issuing.repository.ts`
- `apps/api/src/modules/auth/organization-invitation.service.ts`
- `apps/api/src/modules/auth/organization-team.service.ts`
- `apps/api/src/modules/auth/password-reset.repository.ts`
- `apps/api/src/modules/auth/persistent-auth.repository.ts`
- `apps/api/src/modules/auth/registration-application.service.ts`
- `apps/api/src/modules/auth/registration-cancellation.service.ts`
- `apps/api/src/modules/auth/registration-decision.service.ts`
- `apps/api/src/modules/commercial-rules/commercial-rules.repository.ts`
- `apps/api/src/modules/commodity-profiles/commodity-profile.repository.ts`
- `apps/api/src/modules/commodity-profiles/postgresql-commodity-profile-transaction.port.ts`
- `apps/api/src/modules/deals/canonical-test-deal.seed.ts`
- `apps/api/src/modules/deals/deal-command.service.ts`
- `apps/api/src/modules/deals/deal-registry-query.service.ts`
- `apps/api/src/modules/deals/industrial-deal-command.gateway.ts`
- `apps/api/src/modules/deals/postgresql-deal-command.service.ts`
- `apps/api/src/modules/deals/prisma-deal.repository.ts`
- `apps/api/src/modules/disputes/postgresql-dispute.repository.ts`
- `apps/api/src/modules/documents/prisma-document.repository.ts`
- `apps/api/src/modules/gekta/gekta-anonymous-admission.service.ts`
- `apps/api/src/modules/integration-events/durable-outbox.worker.ts`
- `apps/api/src/modules/integration-events/industrial-metrics.service.ts`
- `apps/api/src/modules/inventory/inventory.repository.ts`
- `apps/api/src/modules/labs/authorized-prisma-lab.repository.ts`
- `apps/api/src/modules/labs/lab-authority.service.ts`
- `apps/api/src/modules/labs/lab-evidence-upload.service.ts`
- `apps/api/src/modules/labs/prisma-lab.repository.ts`
- `apps/api/src/modules/ledger/ledger-v2.service.ts`
- `apps/api/src/modules/logistics/prisma-shipment.repository.ts`
- `apps/api/src/modules/marketing/marketing-durable-outbox.worker.ts`
- `apps/api/src/modules/organization-capabilities/organization-capability.repository.ts`
- `apps/api/src/modules/organization-intake/organization-intake.service.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-ack.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-correlation.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-receipt.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.audit.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-provider-attestation.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-quarantine-audit-principal.inspection.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts`
- `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.redrive.repository.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.repository.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-lifecycle.repository.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.inbox.repository.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.reconciliation.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-enforcement.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-fns-egrul-ingest.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-metrics.service.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-registry.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-source-health.service.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-worker.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility.repository.ts`
- `apps/api/src/modules/service-marketplace/service-marketplace.repository.ts`
- `apps/api/src/modules/service-providers/integration-binding.repository.ts`
- `apps/api/src/modules/service-providers/provider-registry.repository.ts`
- `apps/api/src/modules/settlement-engine/settlement-access.service.ts`
- `apps/api/src/modules/settlement-engine/settlement-postgresql.repository.ts`
- `apps/api/src/modules/staff-access/staff-access-request.service.ts`
- `apps/api/src/modules/staff-access/staff-access.repository.ts`
- `apps/api/src/modules/staff-access/staff-assignment.service.ts`
- `apps/api/src/modules/staff-access/staff-audit.service.ts`
- `apps/api/src/modules/staff-access/staff-authority-prisma.service.ts`
- `apps/api/src/modules/staff-access/staff-capabilities.service.ts`
- `apps/api/src/modules/staff-access/staff-emergency.service.ts`
- `apps/api/src/modules/staff-access/staff-projection.service.ts`
- `apps/api/src/modules/staff-access/staff-runtime-access.repository.ts`
- `apps/api/src/modules/staff-access/staff-support.service.ts`
- `apps/api/src/modules/staff-access/staff-workspace.service.ts`
- `apps/api/src/outbox-worker.ts`

### Исходящие сетевые вызовы

**Почему опасно.** Исходящий запрос уносит учётные данные и может быть уведён редиректом; см. V15.3.2.

**Граница проверки.** Только прямые вызовы fetch. Вызовы через клиентские библиотеки сюда не попадают.

**Найдено файлов: 120.**

- `apps/api/src/common/vault/vault-transit.service.ts`
- `apps/api/src/modules/ai-insights/ai-assistant.service.ts`
- `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts`
- `apps/api/src/modules/marketing/connectors/telegram.publisher.ts`
- `apps/api/src/modules/marketing/connectors/vk.publisher.ts`
- `apps/api/src/modules/ml-client/ml-client.service.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-security.ts`
- `apps/api/src/modules/storage/object-storage.adapter.ts`
- `apps/web/app/api/agro-chat/route.ts`
- `apps/web/app/api/auth/forgot-password/route.ts`
- `apps/web/app/api/auth/login/route.ts`
- `apps/web/app/api/auth/logout/route.ts`
- `apps/web/app/api/auth/me/route.ts`
- `apps/web/app/api/auth/membership-select/route.ts`
- `apps/web/app/api/auth/mfa-login/route.ts`
- `apps/web/app/api/auth/mfa-recovery/confirm/route.ts`
- `apps/web/app/api/auth/mfa-step-up/start/route.ts`
- `apps/web/app/api/auth/mfa-step-up/verify/route.ts`
- `apps/web/app/api/auth/organization-invitations/[invitationId]/resend/route.ts`
- `apps/web/app/api/auth/organization-invitations/accept/route.ts`
- `apps/web/app/api/auth/organization-invitations/route.ts`
- `apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts`
- `apps/web/app/api/auth/organization-memberships/[membershipId]/mfa-recovery/route.ts`
- `apps/web/app/api/auth/refresh/route.ts`
- `apps/web/app/api/auth/register/route.ts`
- `apps/web/app/api/auth/registration/additional-information/route.ts`
- `apps/web/app/api/auth/registration/resend/route.ts`
- `apps/web/app/api/auth/registration/status/route.ts`
- `apps/web/app/api/auth/registration/verify/route.ts`
- `apps/web/app/api/auth/reset-password/route.ts`
- `apps/web/app/api/business-reputation/export/route.ts`
- `apps/web/app/api/documents/[id]/access/route.ts`
- `apps/web/app/api/documents/[id]/content/route.ts`
- `apps/web/app/api/documents/[id]/route.ts`
- `apps/web/app/api/gekta/auth/email/verify/route.ts`
- `apps/web/app/api/gekta/auth/login/route.ts`
- `apps/web/app/api/gekta/auth/logout/route.ts`
- `apps/web/app/api/gekta/auth/mfa/route.ts`
- `apps/web/app/api/gekta/auth/refresh/route.ts`
- `apps/web/app/api/gekta/auth/register/resend/route.ts`
- `apps/web/app/api/gekta/auth/register/route.ts`
- `apps/web/app/api/platform-status/route.ts`
- `apps/web/app/api/platform-v7/accounting/[[...path]]/route.ts`
- `apps/web/app/api/platform-v7/commodity-profiles/[[...path]]/route.ts`
- `apps/web/app/api/platform-v7/inquiries/route.ts`
- `apps/web/app/api/platform-v7/integrations/[[...path]]/route.ts`
- `apps/web/app/api/platform-v7/leads/route.ts`
- `apps/web/app/api/platform-v7/organization-connect/route.ts`
- `apps/web/app/api/proxy/[...path]/route.ts`
- `apps/web/app/api/runtime-command/[commandId]/route.ts`
- `apps/web/app/api/runtime-command/route.ts`
- `apps/web/app/api/runtime-deal/[dealId]/operational-view/route.ts`
- `apps/web/app/api/runtime-feed/route.ts`
- `apps/web/app/api/runtime-history/route.ts`
- `apps/web/app/api/runtime-me-feed/route.ts`
- `apps/web/app/api/runtime-me-object/[type]/[id]/route.ts`
- `apps/web/app/api/runtime-me-role/route.ts`
- `apps/web/app/api/runtime-me-snapshot/route.ts`
- `apps/web/app/api/runtime-me-stream/route.ts`
- `apps/web/app/api/runtime-object/[type]/[id]/route.ts`
- `apps/web/app/api/runtime-outbox-dead/route.ts`
- `apps/web/app/api/runtime-outbox-retry/route.ts`
- `apps/web/app/api/runtime-outbox/process/route.ts`
- `apps/web/app/api/runtime-outbox/route.ts`
- `apps/web/app/api/runtime-reset/route.ts`
- `apps/web/app/api/runtime-role/[roleId]/route.ts`
- `apps/web/app/api/runtime-scenario/[id]/run/route.ts`
- `apps/web/app/api/runtime-simulate/route.ts`
- `apps/web/app/api/runtime-snapshot/route.ts`
- `apps/web/app/api/runtime-stream/route.ts`
- `apps/web/app/api/settlement-engine/deal/[dealId]/confirm/route.ts`
- `apps/web/app/api/settlement-engine/deal/[dealId]/release/route.ts`
- `apps/web/app/api/staff/[...path]/route.ts`
- `apps/web/app/api/staff/capabilities/me/route.ts`
- `apps/web/app/api/staff/commodity-profile-registry/[[...path]]/route.ts`
- `apps/web/app/api/staff/commodity-profiles/[profileId]/commands/[actionId]/route.ts`
- `apps/web/app/api/staff/integration-control-tower/[[...path]]/route.ts`
- `apps/web/app/api/staff/integrations/_command-proxy.ts`
- `apps/web/app/api/staff/registration/applications/[applicationId]/cancel/route.ts`
- `apps/web/app/api/staff/workspaces/[...path]/route.ts`
- `apps/web/app/platform-v7/staff/open-cabinet/route.ts`
- `apps/web/lib/api-client.ts`
- `apps/web/lib/api-server.ts`
- `apps/web/lib/api.ts`
- `apps/web/lib/auction-server.ts`
- `apps/web/lib/audit-server.ts`
- `apps/web/lib/auth-profile-server.ts`
- `apps/web/lib/auth-session.ts`
- `apps/web/lib/bank-release-server.ts`
- `apps/web/lib/business-reputation-server.ts`
- `apps/web/lib/commercial-api.ts`
- `apps/web/lib/deal-execution-server.ts`
- `apps/web/lib/deals-server.ts`
- `apps/web/lib/disputes-server.ts`
- `apps/web/lib/documents-server.ts`
- `apps/web/lib/driver-actions.ts`
- `apps/web/lib/evidence-server.ts`
- `apps/web/lib/first-customer-workspace-server.ts`
- `apps/web/lib/gekta/bridge-handler.ts`
- `apps/web/lib/gekta/server-workspace.ts`
- `apps/web/lib/integrations-server.ts`
- `apps/web/lib/labs-server.ts`
- `apps/web/lib/logistics-server.ts`
- `apps/web/lib/market-analytics-server.ts`
- `apps/web/lib/notifications-server.ts`
- `apps/web/lib/offline.ts`
- `apps/web/lib/organization-team-server.ts`
- `apps/web/lib/outbox-server.ts`
- `apps/web/lib/pilot-runtime-server.ts`
- `apps/web/lib/platform-v7/adapters/real-adapter-template.ts`
- `apps/web/lib/platform-v7/i18n/translation-runtime.ts`
- `apps/web/lib/platform-v7/owner-controlled-cabinet-server.ts`
- `apps/web/lib/platform-v7/tai-internal-stream.ts`
- `apps/web/lib/reporting-server.ts`
- `apps/web/lib/role-home-server.ts`
- `apps/web/lib/runtime-client.ts`
- `apps/web/lib/sber-server.ts`
- `apps/web/lib/server/transactional-mail.ts`
- `apps/web/lib/settlement-server.ts`
- `apps/web/lib/uat.ts`

### Разбор JSON

**Почему опасно.** Разбор недоверенного ввода — вход для подделанных структур и для ключей прототипа.

**Граница проверки.** СТАТИЧЕСКИЙ СКАН НЕ РАЗЛИЧАЕТ источник: сюда попадает и разбор тела запроса, и разбор собственной константы. Число завышено намеренно, потому что занизить его значило бы утверждать больше, чем измерено.

**Найдено файлов: 60.**

- `apps/api/src/common/kafka/kafka-consumer.service.ts`
- `apps/api/src/modules/accounting/accounting.controller.ts`
- `apps/api/src/modules/ai-insights/ai-assistant-admission.manifest.ts`
- `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts`
- `apps/api/src/modules/ai-insights/restricted-public-qwen.stream-gate.ts`
- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/modules/auth-mail/auth-mail-crypto.ts`
- `apps/api/src/modules/commodity-profiles/commodity-profile-version-history.repository.ts`
- `apps/api/src/modules/commodity-profiles/commodity-profile.repository.ts`
- `apps/api/src/modules/deals/deal-command.service.ts`
- `apps/api/src/modules/deals/deal-registry-query.service.ts`
- `apps/api/src/modules/labs/lab-evidence-upload.service.ts`
- `apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.repository.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-format-validation.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-policy.ts`
- `apps/api/src/modules/settlement-engine/bank-key-registry.service.ts`
- `apps/api/src/modules/staff-access/staff-audit.service.ts`
- `apps/api/src/modules/staff-access/staff-capabilities.service.ts`
- `apps/api/src/modules/storage/object-storage.adapter.ts`
- `apps/api/src/modules/tai-tools/tai-tool-assertion.ts`
- `apps/web/app/api/agro-chat/route.ts`
- `apps/web/app/api/lots/route.ts`
- `apps/web/app/api/marketing/telegram/webhook/route.ts`
- `apps/web/app/api/platform-v7/organization-connect/route.ts`
- `apps/web/app/api/proxy/[...path]/route.ts`
- `apps/web/app/api/public-platform-assistant/route.ts`
- `apps/web/app/api/realtime/route.ts`
- `apps/web/app/api/restricted-public-platform-assistant/route.ts`
- `apps/web/app/api/staff/[...path]/route.ts`
- `apps/web/app/api/staff/workspaces/[...path]/route.ts`
- `apps/web/app/platform-v7/actions/runtime-actions.ts`
- `apps/web/lib/auth-session.ts`
- `apps/web/lib/bank-release-server.ts`
- `apps/web/lib/commercial-workspace-repository.ts`
- `apps/web/lib/deal-execution-server.ts`
- `apps/web/lib/gekta/anonymous-session.ts`
- `apps/web/lib/gekta/server-workspace.ts`
- `apps/web/lib/logistics-server.ts`
- `apps/web/lib/offline.ts`
- `apps/web/lib/platform-v7/ai-gateway-stream.ts`
- `apps/web/lib/platform-v7/i18n/translation-runtime.ts`
- `apps/web/lib/platform-v7/install-public-assistant-fetch-resilience.ts`
- `apps/web/lib/platform-v7/offline-command-queue.ts`
- `apps/web/lib/platform-v7/recently-viewed.ts`
- `apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts`
- `apps/web/lib/platform-v7/runtime/persistence-driver.ts`
- `apps/web/lib/platform-v7/support-client-store.ts`
- `apps/web/lib/platform-v7/tai-internal-stream.ts`
- `apps/web/lib/platform-v7/verified-session.ts`
- `apps/web/lib/realtime.ts`
- `apps/web/lib/runtime-client.ts`
- `apps/web/lib/server-request-actor.ts`
- `apps/web/lib/server/gekta-auth-route.ts`
- `apps/web/lib/server/gekta-mfa-ticket.ts`
- `apps/web/lib/server/mfa-login-ticket.ts`
- `packages/domain-core/src/execution-simulation/action-engine.ts`
- `packages/domain-core/src/execution-simulation/fixtures.ts`
- `packages/domain-core/src/execution-simulation/store.ts`
- `packages/integration-sdk/src/live/auth.ts`
- `packages/integration-sdk/src/live/http-integration-client.ts`

### Обращение к файловой системе

**Почему опасно.** Путь, собранный из данных, выводит чтение за пределы предполагаемого каталога.

**Граница проверки.** Источник пути не определяется сканом.

**Найдено файлов: 6.**

- `apps/api/src/auth-mail-worker.ts`
- `apps/api/src/modules/ai-insights/ai-assistant-admission.manifest.ts`
- `apps/api/src/modules/auth-mail/auth-mail-crypto.ts`
- `apps/api/src/modules/auth-mail/auth-mail-smtp.ts`
- `apps/api/src/modules/role-eligibility/role-eligibility-policy.ts`
- `apps/api/src/modules/storage/object-storage.adapter.ts`

### Предподписанные ссылки объектного хранилища

**Почему опасно.** Выданная ссылка живёт до истечения срока и работает мимо приложения: ни одна проверка запроса на неё уже не влияет.

**Граница проверки.** Срок жизни ссылки и её содержимое отсюда не видны.

**Найдено файлов: 3.**

- `apps/api/src/modules/labs/lab-evidence-upload.service.ts`
- `apps/api/src/modules/storage/object-storage.adapter.ts`
- `apps/api/src/modules/storage/storage.service.ts`

### Запуск процессов

**Почему опасно.** Аргумент, собранный из данных, превращается в исполняемую команду.

**Граница проверки.** Привязано к импорту child_process. Скрипты сборки и инструменты вне перечисленных корней не сканируются.

**Найдено файлов: 1.**

- `apps/web/app/api/public-platform-assistant/attachments/route.ts`

### Динамическое выполнение кода

**Почему опасно.** Выполнение строки как кода снимает все остальные границы разом.

**Граница проверки.** Ноль здесь — измеренный ноль, а не пропущенная проверка.

**Найдено файлов: 0.**

Ни одного. Это измеренный ноль: категория проверялась и находок нет.

## Чего здесь нет

- Обращение с ключами шифрования ведётся отдельной описью:
  `docs/security/CRYPTOGRAPHIC_INVENTORY.md`. Дублировать её здесь значило бы
  завести второй источник правды, который разойдётся с первым.
- Наличие файла в списке не означает дефекта. Список отвечает на вопрос «где
  это применяется», а не «где это применено неправильно».
- Скан читает исходники перечисленных корней. Код вне их, сгенерированный код
  и зависимости в охват не входят.
