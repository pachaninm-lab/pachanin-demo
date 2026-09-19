# M3-7 Final UX/Visual Gate — Route-by-Route Netlify QA

platform-v7 / «Прозрачная Цена». Активный host: `https://vermillion-kitsune-0e7b97.netlify.app`.
Проверяется автоматическим smoke-гейтом (HTTP 200 на каждом маршруте) + ручным визуальным контролем.

## Заголовочные системы (единообразие верха)

Платформа использует две намеренные премиум-системы шапки + сильные кастом-герои:
- **CockpitHero** (premium, зелёный акцент, KPI-плитки): buyer, seller, operator, executive, surveyor, lab, elevator, driver, root entry, register, login, roles, open.
- **ExecutionCanvas** (дизайн-система, структурный header): роли через `RoleExecutionCockpitPage` — logistics.
- **Сильные кастом-герои** (премиум, осознанные): bank (badge/h1 + 10 disclosure), control-tower («Остановлено X» + KPI-band + observability), arbitrator (decision-guard панель с testid).

«Старый синий бесхозный герой» оставался у **seller** и **operator** — в M3-7 оба переведены на CockpitHero.

## Route-by-route

| Маршрут | Герой | Длинный хвост (§14) | Mobile 390 | Статус |
|---------|-------|---------------------|-----------|--------|
| `/platform-v7` (вход) | CockpitHero | KPI-плитки + степпер | адаптив | ✓ |
| `/platform-v7/register` | CockpitHero | поля + статусы заявки | адаптив | ✓ |
| `/platform-v7/login` | CockpitHero | способы входа + форма | адаптив | ✓ |
| `/platform-v7/roles` | CockpitHero | сетка ролей | адаптив | ✓ |
| `/platform-v7/open` | CockpitHero | степпер цепочки | адаптив | ✓ |
| `/platform-v7/buyer` | CockpitHero | Smart Collapse (журнал/маршруты/лоты) | mobile-excellence | ✓ |
| `/platform-v7/seller` | CockpitHero (M3-7) | Smart Collapse (маршруты/лоты) | адаптив | ✓ |
| `/platform-v7/operator` | CockpitHero (M3-7) | Smart Collapse (причинные связи/сводка) | адаптив | ✓ |
| `/platform-v7/control-tower` | кастом-премиум + KPI-band | observability collapse + радар | mobile e2e | ✓ |
| `/platform-v7/bank` | кастом-премиум + донат | 4× `<details>` disclosure | mobile e2e | ✓ |
| `/platform-v7/executive` | CockpitHero | Signal Wall + BI collapse | адаптив | ✓ |
| `/platform-v7/surveyor` | CockpitHero | короткий экран | адаптив | ✓ |
| `/platform-v7/lab` | CockpitHero | Smart Collapse + mobile CSS | `.p7-lab-*` 390 | ✓ |
| `/platform-v7/elevator` | CockpitHero + степпер | Smart Collapse + mobile CSS | `.p7-elevator-*` 390 | ✓ |
| `/platform-v7/driver/field` | CockpitHero + офлайн-баннер | field-фокус, без хвоста | field 390 | ✓ |
| `/platform-v7/logistics` | ExecutionCanvas | Smart Collapse (документы/водители/очередь) | адаптив | ✓ |
| `/platform-v7/arbitrator` | decision-guard панель | короткий экран | адаптив | ✓ |

## DoD §14 / §39 / §40

- Длинный несортированный хвост свёрнут в Smart Collapse / `<details>` по всем тяжёлым ролям.
- Верх и нижние секции — в одной дизайн-системе (premium-токены light+dark), без «красивый верх — мусор ниже».
- Один фокус на экран (роль → деньги/блокер → действие).
- Mobile 390×844 — адаптивные правила + e2e `platform-v7-mobile-overflow-390`.
- Netlify smoke-гейт — зелёный на актуальном host по 7 ключевым маршрутам.

## Ограничение проверки

Автогейт проверяет доступность (HTTP 200), не пиксельную точность. Пиксельная сверка с
мокапами и полная мобильная проверка по всем field-ролям — ручной шаг владельца на живом
deploy (ссылки выше). Отдельные мокап-детали (тайлы реальной карты, QR на приёмке,
табы лаборатории) — опциональная полировка, не требование §14.
