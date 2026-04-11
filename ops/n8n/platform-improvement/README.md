# n8n platform improvement agent pack

Назначение: вынести вокруг платформы внешний контур постоянного улучшения кода, логики, дизайна и юзабилити.

Пакет не встраивается в продукт и не принимает необратимых решений. Он нужен, чтобы:
- находить ошибки и деградации
- ловить логические разрывы между ролями и стадиями сделки
- выявлять слабые места UX/UI
- собирать единый backlog улучшений

## Что создать в n8n

Собери один workflow:

1. Trigger
   - Manual Trigger
   - Schedule Trigger: каждые 4 часа
   - GitHub Trigger: push / pull request / branch update

2. Set Context
   Передай всем агентам одинаковый контекст:
   - repository_full_name
   - branch
   - compare_base
   - preview_url
   - production_url
   - scope = code + logic + design + usability
   - project_formula = digital execution rail for grain deal, not marketplace

3. Пять параллельных AI Agent узлов
   - Platform Improvement Lead
   - Role-to-Role E2E Tester
   - Product Logic Auditor
   - UX & Trust Redline Auditor
   - Security & RBAC Auditor

4. Merge Results
   Собери ответы всех пяти агентов в один массив

5. Final Backlog Agent
   Сожми всё в итоговый backlog

## Приоритеты

- P0 — ломает вход, роль, сделку, деньги, документы, спор, критичный маршрут
- P1 — мешает использовать, бьёт по доверию, ухудшает контроль
- P2 — косметика, текст, вторичный UX

## Обязательный формат результата

Для каждой проблемы:

`[priority] / [area] / [screen or module] / [problem] / [why it matters] / [fix]`

## Рекомендуемый порядок узлов в workflow

1. Manual Trigger
2. Schedule Trigger
3. GitHub Trigger
4. Set Context
5. Platform Improvement Lead
6. Role-to-Role E2E Tester
7. Product Logic Auditor
8. UX & Trust Redline Auditor
9. Security & RBAC Auditor
10. Merge
11. Final Backlog Agent
12. Telegram / Slack / Notion / Gmail output

## Правила для всех агентов

1. Улучшают только платформу.
2. Не уходят в маркетинг, продажи, инвестиции и PR.
3. Не предлагают декоративные функции без пользы для сделки.
4. Не завышают зрелость.
5. Любой вывод превращают в конкретный фикс.
6. Если проблема не влияет на сделку, деньги, документы, спор, доступ, доверие или полевой маршрут — ставят низкий приоритет.

## Что запускать первым

Сначала ручной запуск на ветке и preview URL.
Потом запуск по push и PR.
Автофиксы, auto-merge и auto-deploy на первом этапе не включать.
