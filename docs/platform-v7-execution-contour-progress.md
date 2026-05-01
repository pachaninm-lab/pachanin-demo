# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | runtime layer + rollback state + gates + green Vercel preview |
| P1 backlog | 49% | 51% | начат UX/RBAC/mobile/a11y/visual/runtime/error-state/persistence-design/repository-contract/pixel-baseline слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 95% | 5% | unit/mobile/visual/DOM role/runtime/API/cross-screen/screenshot/console/repository-contract/pixel-baseline gates |
| Полное ТЗ | 73% | 27% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `078d98cd524f4368862b1f0e83800019317357dd` стал green по всем 4 Vercel preview.
2. Добавлен `platform-v7-pixel-baseline-smoke.spec.ts`.
3. Pixel baseline smoke покрывает driver, trip deep-link, bank dark и bids tablet.
4. Gate использует `toHaveScreenshot` с `maxDiffPixelRatio: 0.035`.
5. Включён reduced motion и отключены animation/transition для стабильности.
6. Каждый case проверяет render, отсутствие horizontal overflow и screenshot baseline.

## Ограничения

1. Runtime stores пока server-side in-memory.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Persistence ADR/schema/repository contract — proposed, not implemented.
4. Детальная страница рейса закрыта rewrite-обходом.
5. Pixel baseline smoke покрывает 4 стабильных сценария, не все экраны.
6. Полный visual regression baseline на все routes не закрыт.
7. Локальный полный Playwright-run из этого интерфейса не выполнялся.
8. Local `typecheck/test/build` из этого интерфейса не выполнялся.
9. PR остаётся draft.

## Следующий проход

1. Обновить PR body под актуальный head и статусы.
2. Подготовить PR к update branch перед merge.
3. После выбора реального хранилища сделать adapter implementation.
