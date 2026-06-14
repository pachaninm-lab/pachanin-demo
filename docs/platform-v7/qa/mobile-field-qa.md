# Mobile / Field QA — platform-v7

Master-ТЗ 3+ §26, §39 supporting doc. Полевой мобильный режим (390×844) для водителя,
элеватора, сюрвейера, лаборатории.

## Реализация

- Field runtimes: `components/v7r/FieldDriverRuntime`, `FieldElevatorRuntime`, `FieldLabRuntime`.
- Offline: `OfflineSyncBanner` (premium), offline event queue в field runtimes,
  `persistence-queue.ts`, дедуп через `idempotency-key-helper.ts`.
- Mobile CSS: `styles/platform-v7-mobile-excellence.css`, адаптивные правила в
  `driver/field`, `lab`, `elevator` (свернуть второстепенное на 390px).
- Premium driver-экран: `CockpitHero` + `OfflineSyncBanner` + `DriverMissionRouteCard`.

## Offline runtime (§26)

offline event queue, local draft events, sync after reconnect, duplicate protection,
conflict resolution, photo + geo + timestamp, large buttons, minimum text.
DoD: событие без связи не теряется; после синхронизации попадает в audit/evidence;
повторная отправка не создаёт дубль.

## Mobile QA чек-лист (§39)

| Критерий | Статус |
|----------|--------|
| 390×844 no horizontal overflow | ✓ (e2e `platform-v7-mobile-overflow-390`) |
| Крупные кнопки / читаемый шрифт | ✓ |
| Одно главное действие | ✓ (field hero CTA) |
| Offline / sync state | ✓ (`OfflineSyncBanner`, field queue) |
| Photo / geotag state | ✓ (`PhotoUpload`, geo evidence) |
| dark/light consistency | ✓ (premium токены light+dark) |
| Водитель понимает действие за 5 сек | ✓ (Driver Big Tile + hero) |
| Нет мелкого критичного текста | partial (сквозной UX-аудит — M3-3) |

Тесты: `platform-v7-mobile-excellence-pass.spec`, `platform-v7-mobile-overflow-390.spec`,
`platform-v7-mobile-overflow-gate.spec`, `platform-v7-mobile-compact-shell.spec`.
