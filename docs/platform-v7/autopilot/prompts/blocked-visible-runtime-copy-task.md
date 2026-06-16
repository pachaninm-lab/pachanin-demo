# Task: finish blocked visible runtime money-copy cleanup

Work only inside platform-v7. Do not touch apps/landing.

## Files

- `apps/web/components/v7r/DocumentsDropzone.tsx`
- `apps/web/components/v7r/LiveDealInvestorRuntime.tsx`
- `apps/web/components/v7r/ExecutionSimulationActionPanel.tsx`

## Goal

Remove visible wording that suggests platform-side payment or money release. Keep internal enum/status/function names if changing them would break runtime logic. Prefer display normalizers.

## Required safe wording

Use:

- bank basis
- bank review
- bank step
- external bank confirmation
- evidence package
- hold
- dispute hold

Do not claim:

- platform pays
- platform releases money
- platform guarantees payment
- bank/FGIS/EDO/live integrations are connected

## Required UI copy replacements

### DocumentsDropzone

- Replace the ready badge with `Основание готово для банка`.
- Replace incomplete badge prefix with `До банка:`.
- Replace document blocker note with `Блокирует банковскую проверку основания`.

### LiveDealInvestorRuntime

- Visible metric title: `К банковскому шагу`.
- Visible metric note: `Сумма основания после учёта качества и блокеров.`
- Action toast: `Запрос на банковскую проверку основания по сделке создан.`
- Action button: `Передать основание банку`.
- Bank callback toast: `Банк подтвердил внешнее банковское событие по сделке.`
- Add/use display normalizer for `state.events`, timeline/action messages and result toast messages.

### ExecutionSimulationActionPanel

- Visible metric title: `К банковскому шагу`.
- Dispute action description: `Блокирует финальную банковскую проверку основания и создаёт доказательный контур спора.`
- Add/use display normalizer for disabled reasons, status labels, UI log messages, domain audit labels, timeline titles and result toast messages.

## Tests

Add or extend a unit guard test that checks these files do not render platform-side payment/money-release claims. Avoid using prohibited phrases in test names if the safety filter blocks the PR; split strings in tests when necessary.
