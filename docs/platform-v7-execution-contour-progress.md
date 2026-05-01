# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | runtime layer + rollback state + gates + green Vercel preview |
| P1 backlog | 51% | 49% | начат UX/RBAC/mobile/a11y/visual/runtime/error-state/persistence-design/repository-contract/pixel-baseline/CI слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 96% | 4% | fast CI green; full Playwright gate вынесен в issue #414 |
| Полное ТЗ | 74% | 26% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `a5805495179f02e1dd7302df01ba6939062f0040` стал green по всем 4 Vercel preview.
2. `Platform V7 Fast Gates` прошёл успешно.
3. `CI` прошёл успешно.
4. `Node CI` прошёл успешно.
5. Fast gate проверяет install, `apps/web typecheck` и platform-v7 unit gates.
6. Создан issue `#414` для доработки полного Playwright gate.

## Ограничения

1. Runtime stores пока server-side in-memory.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Persistence ADR/schema/repository contract — proposed, not implemented.
4. Детальная страница рейса закрыта rewrite-обходом.
5. Pixel baseline smoke покрывает 4 стабильных сценария, не все экраны.
6. Full Playwright gate требует доработки по issue #414.
7. PR остаётся draft.

## Следующий проход

1. Обновить PR body под актуальный head и статусы.
2. Оставить PR draft до закрытия #414 или явного scope-out решения.
3. Подготовить PR к update branch перед merge.
