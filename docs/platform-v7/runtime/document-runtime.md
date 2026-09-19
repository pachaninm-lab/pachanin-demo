# Document Runtime — platform-v7

Master-ТЗ 3+ §21–22 supporting doc. Документы (ЭДО/КЭП) и транспортные документы (ЭПД)
имеют lifecycle и влияют на сделку и деньги.

## Документы (§21)

Типы: договор, спецификация, УПД, акт приёмки, акт расхождения, протокол качества,
транспортный документ, реестр платежей, решение по спору.

Реализация: `lib/platform-v7/document-matrix.ts`, `document-money-decision-pack.ts`,
`document-access-control.ts`, `document-fingerprinting.ts`, server-gate
`server-document-gate.ts`. UI: `DocumentsMatrix`, `DocumentReadinessMiniMatrix`.

Статусы: Draft / Ready / Sent / Viewed / Signed / Rejected / Expired / Reissued / Archived.
Требования: signer role, required signatures, versioning, document blockers, archive record,
export package, **no fake signature**.

DoD: документный комплект влияет на readiness; release невозможен без обязательных
документов (`document-money-decision-pack.ts`); документ имеет audit и lifecycle.
Тесты: `document-matrix-completeness.test`, `platformV7DealWorkspaceDocuments.test`.

## ФГИС / СДИЗ blockers (§20)

`fgis-adapter-emulator.ts`, `fgis-lot-passport.ts`, `fgis-runtime-action.ts`.
Проверки: культура, партия, масса, продавец, покупатель, место отгрузки/приёмки, дата,
статус и срок СДИЗ, расхождение. Сценарии: отсутствует / совпадает / конфликтует /
просрочен / ФГИС недоступен / ручная проверка. При критическом СДИЗ — сделка не идёт к
release, причина в audit и UI. Тест: `sdiz-lifecycle.test`.

## ЭПД / Transport (§22)

`epd-adapter-emulator.ts`, `logistics-transport-documents-gate.ts`, `trip-service-contract.ts`,
`trip-state-model.ts`. TripDocumentLink, CarrierConfirmation, Loading/Unloading document,
EpdStatus, document error, reissue flow, transport blocker. Рейс не завершён без
транспортного основания; ошибка ЭПД блокирует этап. Тест: `epd-package.test`.
