# Compliance & Fraud Runtime — platform-v7

Master-ТЗ 3+ §29–30 supporting doc. Pre-bank контур (без заявления о live 115-ФЗ).

## Fraud / Anti-Bypass (§29)

`lib/platform-v7/anti-bypass.ts`, `bypass-risk-score.ts`, `contact-vault.ts`,
`deal-fingerprint.ts`, `attachment-risk-scanner.ts`. UI: `app/platform-v7/control-tower/bypass-risk`,
`anti-bypass`.

Сигналы: повторные пары продавец-покупатель, отмена после обмена контактами, совпадение
телефонов/ИНН/адресов, аномальная цена/объём, фиктивная партия, частые споры, смена
реквизитов, подставной перевозчик, обход после первой сделки.

Сущности: RiskSignal, FraudScore, Watchlist, Blacklist, ManualReview, BypassRisk.

DoD: риск можно отправить на ручную проверку; anti-bypass event → audit; рейтинг участника
учитывает нарушения (`reliability-rating.ts`). Тест: `platformV7AntiBypass.test`,
`riskKpiMigrationSafety.test`.

## KYC / AML / Compliance (§30)

`lib/platform-v7/onboarding-kyc.ts`, `bank-compliance-pilot.ts`,
`onboarding-compliance-queue.ts`, `onboarding-risk-score.ts`, `onboarding-access-gate.ts`.

Проверки: participant profile, ИНН/ОГРН, роль, документы, бенефициары, KYC status,
AML risk, suspicious operation, manual review, compliance blocker.

Статусы: NotStarted / Pending / Verified / NeedsReview / Rejected / Blocked / Expired.

DoD: критическая сделка невозможна без verification status; compliance blocker влияет на
деньги; каждое решение логируется; **нет утверждения о полноценном банковском 115-ФЗ без
банка**. Тесты: `bank-compliance-115-pdn.test`,
`platformV7ComplianceOperatorActionBoundary.test`, `platformV7OnboardingComplianceQueue.test`.

## Audit (§31)

`audit-trail.ts`, `audit-events.ts`, `audit-event-helper.ts`, `server-audit-boundary.ts`.
AuditEvent: eventId, actorId, actorRole, objectType, objectId, action, before, after,
result, deniedReason, timestamp, source, correlationId. Audit на успешные и отказанные
действия, adapter calls, money events, dispute actions; экспорт by deal. Критические данные
нельзя тихо изменить. Тест: `platformV7ServerAuditBoundary.test`, `platformV7AuditEventHelper.test`.
