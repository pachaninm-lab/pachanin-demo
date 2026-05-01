# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | runtime layer + rollback state + gates + green Vercel preview |
| P1 backlog | 50% | 50% | начат UX/RBAC/mobile/a11y/visual/runtime/error-state/persistence-design/repository-contract/pixel-baseline/CI слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 96% | 4% | unit/mobile/visual/DOM role/runtime/API/cross-screen/screenshot/console/repository-contract/pixel-baseline/CI gates |
| Полное ТЗ | 74% | 26% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `7c983da01f983e2e2a347db50d94ee1e49e6262b` стал green по всем 4 Vercel preview.
2. Добавлен `.github/workflows/platform-v7-pr-gates.yml`.
3. Workflow запускается на PR в `main` и вручную.
4. Workflow проверяет web typecheck.
5. Workflow проверяет platform-v7 unit/runtime contract tests.
6. Workflow запускает critical Playwright e2e gates.
7. Workflow запускает mobile, screenshot и pixel baseline smoke gates.
8. Playwright report сохраняется artifact на failure.

## Ограничения

1. Runtime stores пока server-side in-memory.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Persistence ADR/schema/repository contract — proposed, not implemented.
4. Детальная страница рейса закрыта rewrite-обходом.
5. Pixel baseline smoke покрывает 4 стабильных сценария, не все экраны.
6. Полный visual regression baseline на все routes не закрыт.
7. Новый GitHub Actions workflow добавлен, но его фактический run ещё нужно подтвердить отдельно.
8. Local `typecheck/test/build` из этого интерфейса не выполнялся.
9. PR остаётся draft.

## Следующий проход

1. Проверить GitHub Actions run по workflow.
2. Обновить PR body под актуальный head и статусы.
3. Подготовить PR к update branch перед merge.
