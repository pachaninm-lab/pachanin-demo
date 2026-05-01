# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | runtime layer + rollback state + gates + green Vercel preview |
| P1 backlog | 47% | 53% | начат UX/RBAC/mobile/a11y/visual/runtime/error-state/persistence-design слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 93% | 7% | unit/mobile/visual/DOM role/runtime/API/cross-screen/screenshot/console gates |
| Полное ТЗ | 71% | 29% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `7b8a6366f67953a47a38eb0624df7a276f3122cd` стал green по всем 4 Vercel preview.
2. Добавлен `platform-v7-runtime-persistence-adr.md`.
3. Добавлен `platform-v7-runtime-persistence-schema.sql`.
4. Зафиксирован будущий путь к устойчивому command/event/snapshot хранилищу.
5. Зафиксировано, что текущий runtime остаётся memory-store для controlled pilot.
6. Зафиксирован запрет считать memory-store закрытым production persistence.

## Ограничения

1. Runtime stores пока server-side in-memory.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Persistence ADR/schema — proposed, not implemented.
4. Детальная страница рейса закрыта rewrite-обходом.
5. Screenshot gate остаётся smoke/capture gate, не pixel-diff baseline.
6. Локальный полный Playwright-run из этого интерфейса не выполнялся.
7. Local `typecheck/test/build` из этого интерфейса не выполнялся.
8. PR остаётся draft.

## Следующий проход

1. Подготовить repository interface для будущего adapter без подключения к runtime.
2. Продолжить visual polish / pixel baseline отдельным блоком.
3. Подготовить PR к update branch перед merge.
