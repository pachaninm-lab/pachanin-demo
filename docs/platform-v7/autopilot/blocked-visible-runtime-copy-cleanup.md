# Blocked visible runtime money copy cleanup

Status: blocked by ChatGPT GitHub tool-safety on direct full-file update.

Scope: platform-v7 only. Do not touch apps/landing.

## Remaining visible runtime files

1. `apps/web/components/v7r/DocumentsDropzone.tsx`
2. `apps/web/components/v7r/LiveDealInvestorRuntime.tsx`
3. `apps/web/components/v7r/ExecutionSimulationActionPanel.tsx`

## Required copy direction

Use bank-basis language only:

- bank basis
- bank review
- bank step
- external bank confirmation
- evidence package
- hold / dispute hold

Do not say or imply that the platform itself pays, releases money, guarantees payment, or has live bank/FGIS/EDO integration.

## Required replacements by file

### DocumentsDropzone

Visible copy must become:

- `Документы готовы к выпуску` -> `Основание готово для банка`
- `До выпуска` -> `До банка`
- `Блокирует банковская проверка выплаты` -> `Блокирует банковскую проверку основания`

### LiveDealInvestorRuntime

Visible copy must become:

- `К выпуску` -> `К банковскому шагу`
- `Запрос на банковскую проверку выплаты по сделке создан.` -> `Запрос на банковскую проверку основания по сделке создан.`
- `Передать основание банку денег` -> `Передать основание банку`
- `Банк подтвердил выплату по сделке.` -> `Банк подтвердил внешнее банковское событие по сделке.`

Also add a display normalizer for timeline / event messages so old domain event text is not rendered directly.

### ExecutionSimulationActionPanel

Visible copy must become:

- `К выпуску` -> `К банковскому шагу`
- `финальный банковская проверка выплаты` -> `финальная банковская проверка основания`
- Direct domain toast/message/status rendering must pass through a display normalizer.

## Guard expectations

Add or extend unit guard tests so these files do not render:

- platform guarantees payment
- money automatically moves
- platform pays or releases money
- old payment-release phrasing in the UI

Keep internal enum/status identifiers if changing them would break runtime logic. Prefer display-normalization over domain renaming.
