# Platform-v7 Visual Wow Core Baseline

Дата: 2026-05-20
Статус прохода: PR-0 / inventory only
Стадия продукта для дальнейших работ: controlled-pilot / pre-integration / тестовый контур внешних подключений

Этот документ фиксирует фактическое состояние `platform-v7` перед внедрением Visual Intelligence Layer. В PR-0 код, UI, маршруты, данные, бизнес-логика, MoneyTree, release/hold/reserve и `data-testid` не меняются.

## Scope

Разрешённые зоны следующей работы:

- `apps/web/app/platform-v7`
- `apps/web/components/platform-v7`
- `apps/web/components/v7r`
- `apps/web/lib/platform-v7`
- `apps/web/lib/domain`
- `apps/web/tests`
- `docs`
- точечно: scoped CSS-файлы `apps/web/styles/platform-v7-*.css`

Защищённые зоны:

- `apps/landing` не трогать.
- AppShell не переписывать с нуля.
- MoneyTree, reserve, hold, release и банковские guardrails не менять без отдельного money PR.
- `data-testid` сохранять.
- backend, DB, migrations, auth/RBAC core и live-интеграции не добавлять.

## Реальная карта маршрутов

Факт по файловой системе:

- `apps/web/app/platform-v7` содержит 173 `page.tsx`.
- Есть root layout: `apps/web/app/platform-v7/layout.tsx`.
- Есть catch-all route: `apps/web/app/platform-v7/[...slug]/page.tsx`.
- Есть зрелый not-found экран: `apps/web/app/platform-v7/not-found.tsx`.
- Есть route aliases в `apps/web/lib/platform-v7/route-canonicalization.ts`.

Ключевые пользовательские маршруты, уже покрытые smoke или route-map:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/deals`
- `/platform-v7/deals/DL-9102`
- `/platform-v7/deals/DL-9106/clean`
- `/platform-v7/lots`
- `/platform-v7/lots/create`
- `/platform-v7/bank`
- `/platform-v7/bank/release-safety`
- `/platform-v7/buyer`
- `/platform-v7/seller`
- `/platform-v7/logistics`
- `/platform-v7/driver/field`
- `/platform-v7/elevator`
- `/platform-v7/lab`
- `/platform-v7/surveyor`
- `/platform-v7/disputes`
- `/platform-v7/disputes/DK-2024-89`
- `/platform-v7/arbitrator`
- `/platform-v7/compliance`
- `/platform-v7/executive`
- `/platform-v7/investor`
- `/platform-v7/connectors`
- `/platform-v7/documents`
- `/platform-v7/support`

Маршрутные факты и gaps:

- `/platform-v7/deals/[id]` сейчас редиректит на `/platform-v7/deals/[id]/clean`.
- `/platform-v7/deals/[id]/clean` является фактическим deal workspace.
- `/platform-v7/integrations` редиректит на `/platform-v7/connectors`.
- `/platform-v7/marketplace`, `/platform-v7/market`, `/platform-v7/field` канонизируются в существующие рабочие маршруты.
- `/platform-v7/lots/new` отсутствует; есть `/platform-v7/lots/create` и `/platform-v7/seller/lots/new`.
- `/platform-v7/audit-log` отсутствует как отдельная страница; журнал есть в сделке, support и `deals/[id]/audit`.
- `/platform-v7/integrations/[provider]` отсутствует; есть общий alias на connectors и `/platform-v7/integrations/grain`.

## Role pages

Фактические роли platform-v7:

- seller: `/platform-v7/seller`
- buyer: `/platform-v7/buyer`
- logistics: `/platform-v7/logistics`
- driver: `/platform-v7/driver` и основной field-route `/platform-v7/driver/field`
- elevator: `/platform-v7/elevator`
- lab: `/platform-v7/lab`
- surveyor: `/platform-v7/surveyor`
- bank: `/platform-v7/bank`
- operator: `/platform-v7/control-tower` и `/platform-v7/operator`
- arbitrator: `/platform-v7/arbitrator`
- compliance: `/platform-v7/compliance`
- executive: `/platform-v7/executive`
- investor: `/platform-v7/investor`

Основная модель ролей и доступов:

- `apps/web/lib/platform-v7/role-access.ts`
- `apps/web/lib/platform-v7/security-rbac.ts`
- `apps/web/lib/platform-v7/security-contracts.ts`
- `apps/web/lib/platform-v7/grain-execution/automation/role-visibility-engine.ts`

Ограничения, уже зафиксированные в коде:

- driver закрыт от bank, investor, buyer, seller, connectors, role switch route и control tower.
- bank закрыт от driver field route, lots create, connectors и driver action surface.
- investor/executive имеют отдельные ограничения по полям и surface.
- operator имеет самый широкий доступ.

## Shell / header

Фактическая оболочка:

- `apps/web/app/platform-v7/layout.tsx` использует `AppShellV4`.
- В layout также монтируются `ScopedShellGuard`, `SupportHeaderIcon`, `RoleHeaderSwitcher`, `RoleExecutionSummaryGate`, `AuditSurfaceSummaryGate`, `SystemRouteSummaryGate`, `WorkRouteNav`.
- `AppShellV4` находится в `apps/web/components/v7r/AppShellV4.tsx`.

Что уже есть:

- фиксированная верхняя шапка;
- brand zone: `Прозрачная Цена`;
- subtitle: `Сделка · логистика · документы · деньги`;
- command/search button;
- role select на desktop;
- mobile role button через drawer;
- notification bell;
- system status chips для ФГИС, банка и споров;
- main content offset и `overflow-x: hidden`;
- desktop/mobile media rules в inline CSS.

Чего ещё нет относительно Living Execution Header:

- нет Cause-to-Money execution zone `Деньги · Документы · Рейс · Качество · Спор`;
- нет compact deal pulse в header;
- нет TrustDot рядом с важными суммами/статусами;
- нет shrink-on-scroll;
- mobile role switch сейчас через drawer, не bottom sheet;
- actionable alert model смешан с общими уведомлениями;
- header не показывает главный blocker конкретной сделки без page-level props.

Безопасная точка для PR-2:

- не переписывать `AppShellV4` целиком;
- добавить presentational header layer рядом с ним или постепенно выделить header content;
- оставить `RoleHeaderSwitcher`, `SupportHeaderIcon`, `WorkRouteNav` и существующие `data-testid`.

## P7 / existing UI layers

Фактический UI слой:

- `apps/web/components/platform-v7` содержит 91 файла.
- `apps/web/components/v7r` содержит 59 файлов.
- Основные P7 primitives:
  - `P7Card.tsx`
  - `P7Section.tsx`
  - `P7Page.tsx`
  - `P7Toolbar.tsx`
  - `P7ActionLog.tsx`
  - `P7ActionButton.tsx`
  - `P7GuardedActionButton.tsx`
  - `P7UiPrimitives.tsx`
  - `p7Theme.ts`
- Execution design layer:
  - `ExecutionDesignSystem.tsx`
  - `ExecutionDesignSystem.module.css`
  - `lib/platform-v7/design/tokens.ts`
  - `lib/platform-v7/design/execution-cockpit.ts`
- Premium root experience:
  - `components/platform-v7/premium/ExecutionUi.tsx`
  - `components/platform-v7/premium/ExecutionUi.module.css`
  - root `/platform-v7` renders `PlatformCommandCenterHub`.

Вывод:

- Вторую дизайн-систему создавать нельзя.
- Visual Intelligence Layer нужно строить как presentational-first layer поверх P7 primitives, `p7Theme` и existing execution tokens.
- Новый путь `apps/web/components/platform-v7/visual` сейчас отсутствует и безопасен для PR-1/PR-2 как additive layer.

## Money surfaces

Фактические деньги/банк/hold/release поверхности:

- `apps/web/app/platform-v7/bank/page.tsx`
- `apps/web/app/platform-v7/bank/release-safety/page.tsx`
- `apps/web/app/platform-v7/deals/[id]/clean/page.tsx`
- `apps/web/app/platform-v7/deals/[id]/money/page.tsx`
- `apps/web/app/platform-v7/deals/grain-release/page.tsx`
- `apps/web/app/platform-v7/control-tower/page.tsx`
- `apps/web/components/platform-v7/MoneyImpactSummaryStrip.tsx`
- `apps/web/components/platform-v7/MoneyGateCard.tsx`
- `apps/web/components/platform-v7/MoneyTreeStrip.tsx`
- `apps/web/components/platform-v7/P7MoneySafetyAuditStrip.tsx`
- `apps/web/lib/platform-v7/domain/release-guard.ts`
- `apps/web/lib/platform-v7/money-safety.ts`
- `apps/web/lib/platform-v7/bank-release-decision.ts`
- `apps/web/lib/domain/kpi/controlTower.ts`

Текущая сильная сторона:

- UI уже формулирует деньги через резерв, удержание, основание и банковскую проверку.
- Есть release guard и отдельные bank/money tests.

Риск:

- В старых runtime surfaces ещё встречается словарь `hold/release/callback` как видимый или почти видимый технический язык.
- Есть несколько CTA на некоторых экранах; для Visual Wow Core нужен один primary CTA в первом viewport.

Безопасный следующий слой:

- MoneyLockHalo должен быть purely presentational и принимать props: amount, state, source, blocker, nextStep.
- Нельзя менять `evaluateReleaseGuard`, MoneyTree, release decision и bank operation logic.

## Documents surfaces

Фактические document surfaces:

- `apps/web/app/platform-v7/documents/page.tsx`
- `apps/web/app/platform-v7/deals/[id]/documents/page.tsx`
- `apps/web/app/platform-v7/deals/[id]/transport-documents/page.tsx`
- `apps/web/app/platform-v7/deals/grain-sdiz/page.tsx`
- `apps/web/components/platform-v7/DocumentsMatrix.tsx`
- `apps/web/components/platform-v7/DocumentsMatrixActions.tsx`
- `apps/web/components/platform-v7/DocumentReadinessMiniMatrix.tsx`
- `apps/web/components/platform-v7/DocumentGateCard.tsx`
- `apps/web/components/platform-v7/DocumentPreviewGate.tsx`
- `apps/web/lib/platform-v7/deal-workspace-documents.ts`
- `apps/web/lib/platform-v7/document-access-control.ts`
- `apps/web/lib/platform-v7/document-money-decision-pack.ts`
- `apps/web/lib/platform-v7/server-document-gate.ts`

Текущая сильная сторона:

- DocumentsMatrix уже показывает source, status, owner, missing state и влияние на банковское основание.

Gap для PR-1:

- Нет унифицированного `DocumentImpactChip`.
- Влияние документа на деньги/рейс/спор пока размазано по локальным labels.

## Evidence / dispute surfaces

Фактические evidence/dispute surfaces:

- `apps/web/app/platform-v7/disputes/page.tsx`
- `apps/web/app/platform-v7/disputes/[id]/page.tsx`
- `apps/web/app/platform-v7/evidence-pack/page.tsx`
- `apps/web/app/platform-v7/deals/[id]/evidence-pack/page.tsx`
- `apps/web/components/platform-v7/EvidencePack.tsx`
- `apps/web/components/platform-v7/EvidenceReadinessMiniMatrix.tsx`
- `apps/web/components/platform-v7/P7EvidenceReadinessAuditStrip.tsx`
- `apps/web/components/platform-v7/EvidenceDecisionPanel.tsx`
- `apps/web/components/v7r/DealEvidencePackPreview.tsx`
- `apps/web/components/v7r/EvidenceDisputeContinuityPanel.tsx`
- `apps/web/lib/platform-v7/evidence-model.ts`
- `apps/web/lib/platform-v7/evidence-pack.ts`
- `apps/web/lib/platform-v7/evidence-readiness-matrix.ts`
- `apps/web/lib/platform-v7/dispute-evidence-pack.ts`
- `apps/web/lib/platform-v7/grain-execution/automation/evidence-pack-engine.ts`

Текущая сильная сторона:

- disputes page уже показывает причину, сумму влияния, SLA, ответственного, следующий шаг и доказательства.

Gap для PR-1/PR-4:

- Нет общего `ProofRibbon`.
- Нет общего `EvidenceStrengthMeter`.
- Timeline events ещё не в едином `TimelineWithImpact`.

## Journal / audit surfaces

Фактические journal/audit surfaces:

- `apps/web/components/platform-v7/P7ActionLog.tsx`
- `apps/web/components/platform-v7/JournalPreview.tsx`
- `apps/web/app/platform-v7/deals/[id]/audit/page.tsx`
- `apps/web/lib/platform-v7/action-log.ts`
- `apps/web/lib/platform-v7/action-log-feedback.ts`
- `apps/web/lib/platform-v7/audit-event-helper.ts`
- `apps/web/lib/platform-v7/audit-events.ts`
- `apps/web/lib/platform-v7/audit-trail.ts`
- `apps/web/lib/platform-v7/deal-workspace-timeline.ts`
- `apps/web/lib/platform-v7/journal-preview.ts`

Gap:

- Нет отдельного `/platform-v7/audit-log`.
- Нет общего `TimelineChapters`.
- Журнал местами показывает событие, но не всегда явно показывает последствие для денег, документа, рейса, качества или спора.

## Deal workspace

Фактический главный deal workspace:

- `/platform-v7/deals/[id]` -> redirect to `/platform-v7/deals/[id]/clean`
- implementation: `apps/web/app/platform-v7/deals/[id]/clean/page.tsx`
- tabs: `apps/web/components/platform-v7/P7DealWorkspaceTabs.tsx`
- source: `apps/web/lib/platform-v7/deal360-source-of-truth.ts`
- selectors: `apps/web/lib/domain/selectors.ts`

Что уже отвечает ТЗ:

- ID сделки, лот, статус, деньги, документы, маршрут и blockers видны.
- Есть next action block.
- Деньги уже связаны с release guard.

Что нужно усилить в PR-3/PR-4:

- CauseLine между blocker и money.
- MoneyLockHalo вокруг ключевой суммы.
- UnlockPath с текущим шагом.
- DealMiniMap вместо длинной прокрутки.
- FocusDetailMode `Главное / Детали`.
- TimelineWithImpact для событий с последствиями.
- MagneticActionDock с одним primary CTA.

## Bank view

Фактическая bank page:

- `apps/web/app/platform-v7/bank/page.tsx`
- использует `RoleExecutionCockpitPage` и bank cockpit model.
- показывает очередь денег, reserve/release/hold, документы, внешние контуры, доказательства, action feedback и журнал.

Сильная сторона:

- Текст в текущей bank model уже фиксирует, что банк подтверждает статус, а платформа показывает основание.

Gap:

- Нет отдельного `BankCleanView`.
- Страница ещё содержит много операционных блоков; для bank role нужен чистый срез: основание, сумма, документы, риски, ручная проверка, журнал.

## Driver / field view

Фактический driver field route:

- `apps/web/app/platform-v7/driver/field/page.tsx`
- `data-testid="platform-v7-driver-field-shell"`
- использует `FieldDriverRuntime compact`.
- есть dedicated mobile-focused smoke tests.

Сильная сторона:

- Driver field route уже отделён от общего банковского/инвесторского контекста.
- В коде есть role leakage restrictions.

Gap:

- Нет `DriverBigTileMode` как общего presentational component.
- Primary action есть в hero, но нет bottom action dock.
- Не хватает унифицированной receipt after action.

## Control Tower

Фактический operator center:

- `apps/web/app/platform-v7/control-tower/page.tsx`
- использует `P7Page`, `P7Section`, `RoleExecutionCockpitContent`, `DomainControlTowerSummary`, `OperatorExecutionQueue`, `ExecutionSimulationActionPanel`, transport hotlist.

Сильная сторона:

- Очередь уже сортируется по severity, amount at risk и risk score.
- Каждая строка имеет reason, owner, amount at risk и action.

Gap:

- Нет `OperatorRadar`.
- В первом viewport может быть больше двух сильных visual blocks.
- Нужна строгая группировка: Деньги / Документы / Рейсы / Споры / Риски.

## Data layer and E01 queue facts

Прямые импорты `@/lib/v7r/data` всё ещё есть в runtime и selector слоях:

- `apps/web/components/v7r/DealsOverviewRuntime.tsx`
- `apps/web/components/v7r/BankRuntime.tsx`
- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/components/v7r/AppShellV3.tsx`
- `apps/web/components/v7r/DealDetailRuntime.tsx`
- `apps/web/components/v7r/CatchAllPage.tsx`
- `apps/web/lib/domain/fixtureSource.ts`
- `apps/web/lib/domain/selectors.ts`
- `apps/web/lib/domain/adapters.ts` as type import

PR-0 не меняет это. Для E01 после Visual Wow PRs безопасный порядок остаётся:

1. маленькие stores/selectors;
2. runtime files до 300 строк;
3. средние runtime files;
4. `CatchAllPage` только частями.

## Mobile risks

Проверочные стандарты уже частично есть:

- `platform-v7-mobile-overflow-gate.spec.ts` проверяет 375/390/414/768/1440.
- `platform-v7-route-map-smoke.spec.ts` проверяет route rendering и horizontal overflow.
- `platform-v7-driver-field-mobile-pass.spec.ts` и related specs защищают driver route.
- `PLATFORM_V7_QA_VIEWPORTS` в `visual-qa-guardrails.ts` содержит 360, 375, 430, 768, 1024 и desktop widths.

Фактические mobile risks:

- AppShellV4 mobile header сжимает desktop controls, но не является отдельным `MobileExecutionHeader`.
- Role switch на mobile через side drawer, не через bottom sheet.
- Search через command overlay есть, но не оформлен как mobile command layer из ТЗ.
- `/platform-v7/deals` включает legacy runtime list below custom cards; нужно проверить single CTA и первый viewport после PR-1/PR-3.
- Некоторые legacy surfaces всё ещё имеют таблицы или dense grids; smoke tests ловят overflow, но не ловят cognitive overload.
- `prefers-reduced-motion: reduce` есть в premium UI CSS и exhibition CSS, но не в едином platform-v7 final polish layer.

## Existing QA gates

Факты:

- `apps/web/tests` содержит 525 файлов.
- E2E platform-v7 specs покрывают route smoke, mobile overflow, forbidden copy, role leakage, driver field, bank release action, documents matrix/actions, action feedback, visual smoke.
- Unit tests покрывают role access, shell model, navigation, money safety, release guard, evidence, documents, bank, driver isolation, visual QA guardrails.

Ключевые уже существующие gates:

- `apps/web/tests/e2e/platform-v7-route-map-smoke.spec.ts`
- `apps/web/tests/e2e/platform-v7-mobile-overflow-gate.spec.ts`
- `apps/web/tests/e2e/platform-v7-forbidden-copy-gate.spec.ts`
- `apps/web/tests/e2e/platform-v7-role-leakage-deep.spec.ts`
- `apps/web/tests/e2e/platform-v7-driver-field-mobile-pass.spec.ts`
- `apps/web/tests/e2e/platform-v7-bank-release-action-visibility.spec.ts`
- `apps/web/tests/e2e/platform-v7-action-feedback-gate.spec.ts`
- `apps/web/tests/unit/platformV7VisualQaGuardrails.test.ts`
- `apps/web/tests/unit/platformV7MoneyReleaseBankConfirmation.spec.ts`
- `apps/web/tests/unit/platformV7DriverRoleIsolation.test.ts`

PR-10 should extend, not replace, these gates.

## Forbidden / risky copy inventory

Maturity overclaim class:

- App code search did not show direct positive claims of industrial readiness, complete live integration, payment guarantee, no-risk or no-analogue messaging in active `platform-v7` UI.
- Guardrail files and historical docs intentionally contain banned phrases as negative examples; keep them out of visible UI and new PR descriptions unless a test specifically requires them.

Visible technical/dev-language candidates to clean later:

- `apps/web/app/platform-v7/buyer/financing/page.tsx`
- `apps/web/app/platform-v7/evidence-pack/page.tsx`
- `apps/web/app/platform-v7/market-rfq/page.tsx`
- `apps/web/app/platform-v7/seller/fgis-parties/page.tsx`
- `apps/web/components/platform-v7/BankManualReviewPanel.tsx`
- `apps/web/components/platform-v7/BankBeneficiariesPanel.tsx`
- `apps/web/components/v7r/RoleActionDispatchBridge.tsx`
- `apps/web/components/v7r/ExecutionSimulationActionPanel.tsx`
- `apps/web/components/v7r/BankRuntime.tsx`
- `apps/web/components/v7r/CatchAllPage.tsx`
- `apps/web/app/platform-v7/[...slug]/page.tsx`

Rule for future copy PR:

- Replace technical/test lexicon with trust-layer wording.
- Keep the honest boundary: external connections require contracts, access and confirmation on real deals.
- Do not repeat disclaimers on every card; use `TrustDot`.

## Safe edit zones for PR-1

Best next additive files:

- `apps/web/components/platform-v7/visual/DealStatusEdge.tsx`
- `apps/web/components/platform-v7/visual/TrustDot.tsx`
- `apps/web/components/platform-v7/visual/SmartSectionSummary.tsx`
- `apps/web/components/platform-v7/visual/DocumentImpactChip.tsx`
- `apps/web/components/platform-v7/visual/ProofRibbon.tsx`

Preferred implementation constraints:

- presentational-first props only;
- no data fetch;
- no domain model changes;
- no new business statuses;
- no MoneyTree/release/hold/reserve changes;
- no `data-testid` deletion;
- CSS scoped through component classes or platform-v7 CSS variables;
- use existing P7 tone/tokens where possible;
- mobile safe by default;
- no animation without reduced-motion fallback.

Safe minimal integration candidates after primitives exist:

- `/platform-v7/deals` cards: DealStatusEdge, TrustDot, compact ProofRibbon, SmartSectionSummary.
- `/platform-v7/deals/[id]/clean`: only additive visual wrappers around existing money/docs/cockpit blocks.
- `/platform-v7/control-tower`: one OperatorRadar-light summary only after PR-1 primitives.

Do not touch in PR-1:

- `apps/landing`
- Money release logic
- bank guard logic
- data fixtures
- route canonicalization
- AppShellV4 rewrite
- role access matrices
- package files

## PR-0 conclusion

Platform-v7 already has a strong controlled-pilot execution backbone: role cockpit models, money guardrails, document matrix, evidence/dispute surfaces, action feedback strips, driver field shell, route and mobile gates.

The main visual gap is not missing business logic. The gap is a unified Visual Intelligence Layer that makes the existing execution logic readable in 5-10 seconds:

- one blocker;
- one money impact;
- one responsible owner;
- one primary action;
- clear consequence in the journal;
- trust/source indicator without repeated disclaimers.

Next safe step: PR-1 Visual primitives as additive presentational components, then minimal mounting on one or two low-risk surfaces.
