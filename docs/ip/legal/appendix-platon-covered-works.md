# Приложение № 1 — перечень передаваемых произведений

**Автор:** Platon (git-адрес `platon@MacBook-Pro-Platon.local`)
**Состояние дерева:** `9e88031d7b13c06186ab99a22d7ae2eb75f7c2a5`
**Сформировано:** 2026-09-06T14:51:58.958Z

## Итоги

| показатель | значение |
|---|---|
| коммитов автора | 88 |
| путей затронуто за всю историю | 305 |
| файлов с сохранившимися строками | **133** |
| сохранившихся строк | **8610** |
| из них файлов защищаемого ядра | **24** |
| из них строк защищаемого ядра | **721** |

Метод: Коммиты — git log --all --no-merges по адресу автора. Файлы и строки — git blame по текущему дереву: учитывается только сохранившийся вклад, переписанное позже не включается.

## Раздел А. Файлы защищаемого ядра (CROWN_JEWEL)

| № | файл | строк | blob SHA |
|---:|---|---:|---|
| 1 | `apps/api/src/modules/admin/admin.controller.spec.ts` | 32 | `71ffd12f2a3b` |
| 2 | `apps/api/src/modules/admin/admin.controller.ts` | 43 | `29be9d795d20` |
| 3 | `apps/api/src/modules/admin/admin.module.ts` | 8 | `c9f948b491b1` |
| 4 | `apps/api/src/modules/audit/audit.controller.ts` | 17 | `4eb877fbfac3` |
| 5 | `apps/api/src/modules/audit/audit.module.ts` | 2 | `197fa558779b` |
| 6 | `apps/api/src/modules/audit/audit.service.ts` | 39 | `c0e7f43cf379` |
| 7 | `apps/api/src/modules/auth/auth.service.ts` | 1 | `c1db96161ee1` |
| 8 | `apps/api/src/modules/deals/deals.controller.ts` | 7 | `21aa2e168cb6` |
| 9 | `apps/api/src/modules/deals/deals.service.spec.ts` | 10 | `f2ff8d416389` |
| 10 | `apps/api/src/modules/deals/deals.service.ts` | 2 | `59eeb6ecb4d1` |
| 11 | `apps/api/src/modules/disputes/disputes.controller.ts` | 15 | `4d135541e10f` |
| 12 | `apps/api/src/modules/disputes/disputes.service.ts` | 11 | `db249f480403` |
| 13 | `apps/api/src/modules/disputes/dto/create-dispute.dto.ts` | 2 | `beae40ea2960` |
| 14 | `apps/api/src/modules/documents/document-matrix.service.ts` | 201 | `0bbd413fd98b` |
| 15 | `apps/api/src/modules/documents/documents.controller.ts` | 12 | `23889b247abb` |
| 16 | `apps/api/src/modules/documents/documents.module.ts` | 1 | `380096239c41` |
| 17 | `apps/api/src/modules/documents/documents.service.ts` | 12 | `ef5317e44c76` |
| 18 | `apps/api/src/modules/evidence-pack/evidence-pack.controller.ts` | 48 | `b13f68adcf80` |
| 19 | `apps/api/src/modules/evidence-pack/evidence-pack.module.ts` | 10 | `b18027b0d16e` |
| 20 | `apps/api/src/modules/evidence-pack/evidence-pack.service.ts` | 114 | `80d220755bdf` |
| 21 | `apps/api/src/modules/evidence-pack/evidence-pack.spec.ts` | 72 | `640e8725e189` |
| 22 | `apps/api/src/modules/settlement-engine/settlement-engine.controller.ts` | 24 | `c35341c1fecb` |
| 23 | `apps/api/src/modules/settlement-engine/settlement-engine.service.spec.ts` | 24 | `db32dd2ab226` |
| 24 | `apps/api/src/modules/settlement-engine/settlement-engine.service.ts` | 14 | `e0e667eb89dd` |

## Раздел Б. Остальные файлы

| № | файл | строк | категория | blob SHA |
|---:|---|---:|---|---|
| 1 | `.gitignore` | 3 | STANDARD | `e35dd466aa14` |
| 2 | `apps/api/jest.config.js` | 13 | STANDARD | `cfead4d147bb` |
| 3 | `apps/api/package.json` | 1 | STANDARD | `0bb22e687d08` |
| 4 | `apps/api/prisma/migrations/migration_lock.toml` | 2 | STANDARD | `99e4f2009079` |
| 5 | `apps/api/prisma/schema.prisma` | 26 | STANDARD | `6d609bc977e5` |
| 6 | `apps/api/src/app.module.ts` | 8 | STANDARD | `b4bff96cdf94` |
| 7 | `apps/api/src/common/action-executor/action-executor.module.ts` | 11 | STANDARD | `ef05adcf0731` |
| 8 | `apps/api/src/common/action-executor/action-executor.service.ts` | 187 | STANDARD | `52fb217336f1` |
| 9 | `apps/api/src/common/action-executor/action-executor.spec.ts` | 114 | STANDARD | `238d4ab3d765` |
| 10 | `apps/api/src/common/action-executor/action-policy.ts` | 123 | STANDARD | `37432bb5af0c` |
| 11 | `apps/api/src/common/database/database-seed.service.spec.ts` | 96 | STANDARD | `2ab8395f6eb7` |
| 12 | `apps/api/src/common/database/database-seed.service.ts` | 148 | STANDARD | `8346e49c836c` |
| 13 | `apps/api/src/common/database/database.module.ts` | 7 | STANDARD | `e62db007058a` |
| 14 | `apps/api/src/common/outbox/outbox.service.ts` | 41 | STANDARD | `f0386457a98a` |
| 15 | `apps/api/src/common/outbox/outbox.spec.ts` | 19 | STANDARD | `ebb0c516a70a` |
| 16 | `apps/api/src/common/prisma/prisma.module.ts` | 7 | STANDARD | `e4d1b4b7253b` |
| 17 | `apps/api/src/common/prisma/prisma.service.ts` | 15 | STANDARD | `b088b4c9b97f` |
| 18 | `apps/api/src/modules/integrations/integrations.controller.ts` | 19 | STANDARD | `38d968b28e96` |
| 19 | `apps/api/src/modules/integrations/integrations.service.spec.ts` | 79 | STANDARD | `f98bc648411e` |
| 20 | `apps/api/src/modules/integrations/integrations.service.ts` | 14 | STANDARD | `fa759615e975` |
| 21 | `apps/api/src/modules/labs/labs.service.ts` | 2 | STANDARD | `eedd8321c93b` |
| 22 | `apps/api/src/modules/logistics/logistics.service.ts` | 3 | STANDARD | `2a963749febf` |
| 23 | `apps/api/src/modules/runtime-core/runtime-core.spec.ts` | 142 | STANDARD | `a54248fa2a35` |
| 24 | `apps/web/app/api/platform-status/route.ts` | 50 | STANDARD | `57109912befe` |
| 25 | `apps/web/app/platform-v7/arbitrator/page.tsx` | 15 | STANDARD | `1f39ef40bd36` |
| 26 | `apps/web/app/platform-v7/audit-log/page.tsx` | 14 | STANDARD | `9ee9f04f6836` |
| 27 | `apps/web/app/platform-v7/bank/page.tsx` | 23 | STANDARD | `86d740022763` |
| 28 | `apps/web/app/platform-v7/buyer/page.tsx` | 12 | STANDARD | `337d6568aab4` |
| 29 | `apps/web/app/platform-v7/connectors/page.tsx` | 1 | STANDARD | `b984a2800935` |
| 30 | `apps/web/app/platform-v7/deals/[id]/audit/page.tsx` | 58 | STANDARD | `61aa073171db` |
| 31 | `apps/web/app/platform-v7/deals/[id]/clean/page.tsx` | 2 | STANDARD | `a529966dd75f` |
| 32 | `apps/web/app/platform-v7/deals/[id]/evidence-pack/page.tsx` | 15 | STANDARD | `8ddcf53fe8a9` |
| 33 | `apps/web/app/platform-v7/deals/[id]/review/page.tsx` | 3 | STANDARD | `96fb30578ae4` |
| 34 | `apps/web/app/platform-v7/deals/compare/page.tsx` | 1 | STANDARD | `4b6515cc9f5c` |
| 35 | `apps/web/app/platform-v7/disputes/page.tsx` | 5 | STANDARD | `19ebe2e42bc2` |
| 36 | `apps/web/app/platform-v7/driver/field/page.tsx` | 16 | STANDARD | `b2817b322072` |
| 37 | `apps/web/app/platform-v7/elevator/page.tsx` | 13 | STANDARD | `6338694aa5a8` |
| 38 | `apps/web/app/platform-v7/executive/page.tsx` | 35 | STANDARD | `957cb0732a40` |
| 39 | `apps/web/app/platform-v7/help/page.tsx` | 4 | STANDARD | `b8c792c99f84` |
| 40 | `apps/web/app/platform-v7/lab/page.tsx` | 16 | STANDARD | `1625cbfae97d` |
| 41 | `apps/web/app/platform-v7/logistics/page.tsx` | 10 | STANDARD | `99d3da10b4b0` |
| 42 | `apps/web/app/platform-v7/not-found.tsx` | 7 | STANDARD | `042fab13d94a` |
| 43 | `apps/web/app/platform-v7/operator/page.tsx` | 14 | STANDARD | `46ff5cb785d6` |
| 44 | `apps/web/app/platform-v7/seller/page.tsx` | 11 | STANDARD | `9fc92f2766d0` |
| 45 | `apps/web/components/platform-v7/ActionFeedbackPreviewStrip.tsx` | 1 | STANDARD | `9c214233a1b2` |
| 46 | `apps/web/components/platform-v7/AuditSurfaceSummary.tsx` | 1 | STANDARD | `865d3d9d83ef` |
| 47 | `apps/web/components/platform-v7/BankSmartContractsPanel.tsx` | 1 | STANDARD | `3574eff3cfc9` |
| 48 | `apps/web/components/platform-v7/LiveApiStatusBar.tsx` | 161 | STANDARD | `d0e625b40be5` |
| 49 | `apps/web/components/platform-v7/P7ActionFeedbackStrip.tsx` | 1 | STANDARD | `5ec53ca00d7d` |
| 50 | `apps/web/components/platform-v7/P7EvidenceReadinessAuditStrip.tsx` | 4 | STANDARD | `cba70ac5fa1c` |
| 51 | `apps/web/components/platform-v7/P7MoneySafetyAuditStrip.tsx` | 2 | STANDARD | `e6c7d1ccf0cb` |
| 52 | `apps/web/components/platform-v7/P7PersistenceQueueStatus.tsx` | 9 | STANDARD | `c01a4891846c` |
| 53 | `apps/web/components/platform-v7/RoleExecutionSummary.tsx` | 1 | STANDARD | `2a628bcf5ec0` |
| 54 | `apps/web/components/platform-v7/SupportCaseView.tsx` | 1 | STANDARD | `9f347cc8ce5c` |
| 55 | `apps/web/components/platform-v7/SupportNewCaseClient.tsx` | 1 | STANDARD | `2dcfc219343d` |
| 56 | `apps/web/components/platform-v7/SupportOperatorQueueClient.tsx` | 3 | STANDARD | `294ff42b8707` |
| 57 | `apps/web/components/platform-v7/SystemRouteSummary.tsx` | 2 | STANDARD | `88855835b410` |
| 58 | `apps/web/components/platform-v7/visual/ActionPreview.tsx` | 292 | STANDARD | `7e4b3cc9feb6` |
| 59 | `apps/web/components/platform-v7/visual/AfterActionReceipt.tsx` | 201 | STANDARD | `c59dfbef95e8` |
| 60 | `apps/web/components/platform-v7/visual/BankCleanView.tsx` | 275 | STANDARD | `eca1b4857ad6` |
| 61 | `apps/web/components/platform-v7/visual/CauseLine.tsx` | 317 | STANDARD | `71ea8e50bf57` |
| 62 | `apps/web/components/platform-v7/visual/DealMiniMap.tsx` | 250 | STANDARD | `65b836dff758` |
| 63 | `apps/web/components/platform-v7/visual/DealStatusEdge.tsx` | 105 | STANDARD | `5af4f43c9b22` |
| 64 | `apps/web/components/platform-v7/visual/DealWorkspaceVisualLayer.tsx` | 335 | STANDARD | `40e21e713f3e` |
| 65 | `apps/web/components/platform-v7/visual/DocumentImpactChip.tsx` | 136 | STANDARD | `640b18e3fbca` |
| 66 | `apps/web/components/platform-v7/visual/DriverBigTileIsland.tsx` | 34 | STANDARD | `9965a2945ab7` |
| 67 | `apps/web/components/platform-v7/visual/DriverBigTileMode.tsx` | 252 | STANDARD | `9a8070b64b21` |
| 68 | `apps/web/components/platform-v7/visual/EvidenceStrengthMeter.tsx` | 253 | STANDARD | `fb8754c8a732` |
| 69 | `apps/web/components/platform-v7/visual/ExecutionHeader.tsx` | 253 | STANDARD | `fe539d218137` |
| 70 | `apps/web/components/platform-v7/visual/FocusDetailMode.tsx` | 96 | STANDARD | `f65886ca5515` |
| 71 | `apps/web/components/platform-v7/visual/index.ts` | 85 | STANDARD | `540d194d98ab` |
| 72 | `apps/web/components/platform-v7/visual/MagneticActionDock.tsx` | 203 | STANDARD | `442290c6a92f` |
| 73 | `apps/web/components/platform-v7/visual/MobileExecutionHeader.tsx` | 188 | STANDARD | `eab24d20ebbb` |
| 74 | `apps/web/components/platform-v7/visual/MoneyLockHalo.tsx` | 196 | STANDARD | `1e4657f8757e` |
| 75 | `apps/web/components/platform-v7/visual/ObjectFocusHover.tsx` | 225 | STANDARD | `1f53b6b1e1c6` |
| 76 | `apps/web/components/platform-v7/visual/OperatorRadar.tsx` | 208 | STANDARD | `b0b3017edb92` |
| 77 | `apps/web/components/platform-v7/visual/OperatorRadarIsland.tsx` | 49 | STANDARD | `44d24d4effec` |
| 78 | `apps/web/components/platform-v7/visual/ProgressiveDetailCard.tsx` | 221 | STANDARD | `c63707814f5c` |
| 79 | `apps/web/components/platform-v7/visual/ProofRibbon.tsx` | 177 | STANDARD | `529e7480a212` |
| 80 | `apps/web/components/platform-v7/visual/QuietIntelligenceHint.tsx` | 98 | STANDARD | `58d18e12480b` |
| 81 | `apps/web/components/platform-v7/visual/RoleLens.tsx` | 155 | STANDARD | `0a13aadcea7d` |
| 82 | `apps/web/components/platform-v7/visual/SmartSectionSummary.tsx` | 157 | STANDARD | `dc0f4c32b2c9` |
| 83 | `apps/web/components/platform-v7/visual/TimelineChapters.tsx` | 271 | STANDARD | `e5ee12693f30` |
| 84 | `apps/web/components/platform-v7/visual/TimelineWithImpact.tsx` | 213 | STANDARD | `cd94a9b500eb` |
| 85 | `apps/web/components/platform-v7/visual/TrustDot.tsx` | 171 | STANDARD | `5d52bd5fd8a9` |
| 86 | `apps/web/components/platform-v7/visual/UnlockPath.tsx` | 250 | STANDARD | `5f92764c0883` |
| 87 | `apps/web/components/v7r/AppShell.tsx` | 1 | STANDARD | `dabec39d515c` |
| 88 | `apps/web/components/v7r/CatchAllPage.tsx` | 12 | STANDARD | `6fbfcd911480` |
| 89 | `apps/web/components/v7r/CommandPalette.tsx` | 1 | STANDARD | `bf0be5ab6c73` |
| 90 | `apps/web/components/v7r/DealEvidencePackPreview.tsx` | 3 | STANDARD | `a5fb557404d6` |
| 91 | `apps/web/components/v7r/DisputesRuntime.tsx` | 5 | STANDARD | `234907abffd2` |
| 92 | `apps/web/components/v7r/DomainControlTowerSummary.tsx` | 1 | STANDARD | `ae02aeaccc20` |
| 93 | `apps/web/components/v7r/DomainDisputesSummary.tsx` | 1 | STANDARD | `f3cab9475af5` |
| 94 | `apps/web/components/v7r/EvidenceExportReadinessSummary.tsx` | 15 | STANDARD | `2b047afa7ca8` |
| 95 | `apps/web/components/v7r/EvidencePackOperationsQueue.tsx` | 33 | STANDARD | `e34a2e259adb` |
| 96 | `apps/web/components/v7r/LiveDealInvestorRuntime.tsx` | 1 | STANDARD | `353d702d239d` |
| 97 | `apps/web/components/v7r/PlatformRolesHub.tsx` | 13 | STANDARD | `bb6cb9fca3f3` |
| 98 | `apps/web/components/v7r/RiskBadge.tsx` | 1 | STANDARD | `4ef52b489aaa` |
| 99 | `apps/web/components/v7r/RoleActionDispatchBridge.tsx` | 26 | STANDARD | `61751761dcbb` |
| 100 | `apps/web/components/v7r/RoleContinuityPanel.tsx` | 24 | STANDARD | `c9cc7c7b1243` |
| 101 | `apps/web/components/v7r/SellerLotsRuntime.tsx` | 1 | STANDARD | `6a1b38d3479a` |
| 102 | `apps/web/components/v7r/SellerLotsRuntimeV2.tsx` | 3 | STANDARD | `e8deca59497a` |
| 103 | `apps/web/lib/disputes-server.ts` | 45 | STANDARD | `429db475d17f` |
| 104 | `apps/web/lib/evidence-server.ts` | 54 | STANDARD | `bd3632c7dee9` |
| 105 | `apps/web/lib/labs-server.ts` | 77 | STANDARD | `c8ac35c44447` |
| 106 | `apps/web/lib/logistics-server.ts` | 34 | STANDARD | `060e6f80e3de` |
| 107 | `apps/web/lib/outbox-server.ts` | 74 | STANDARD | `0900cd9d317c` |
| 108 | `apps/web/tests/e2e/platform-v7-executive-admin-pages.spec.ts` | 63 | STANDARD | `9b08865e3d79` |
| 109 | `apps/web/tests/e2e/platform-v7-vil-qa.spec.ts` | 142 | STANDARD | `a05c2d8357db` |

## Раздел В. Коммиты автора

| № | SHA | дата | описание |
|---:|---|---|---|
| 1 | `bfe541993f32` | 2026-05-20 | feat(platform-v7): Visual Intelligence Layer — 28 components + page integrations |
| 2 | `d97ba6264b11` | 2026-05-20 | feat(platform-v7): VIL page integrations for deals/disputes/lots/investor + PR-10 QA |
| 3 | `853d3639385e` | 2026-05-20 | feat(platform-v7): VIL on audit, help, not-found, bank/release-safety |
| 4 | `bf98439b44f9` | 2026-05-20 | feat(platform-v7): EvidenceStrengthMeter, TimelineChapters, ExecutionHeader integration |
| 5 | `17c86b571d9b` | 2026-05-20 | fix(platform-v7): remove onClick function prop from server component boundary |
| 6 | `dc0ae40e4ec1` | 2026-05-20 | fix(platform-v7): use LucideIcon type instead of ComponentType for icon props |
| 7 | `ccae08510d0d` | 2026-05-20 | fix(platform-v7): fix MobileExecutionHeader props — pass named props not items array |
| 8 | `091e192a8e28` | 2026-05-20 | fix(platform-v7): make DealMiniMap sections prop optional (has default) |
| 9 | `e733c7577194` | 2026-05-20 | feat(platform-v7): roll out VIL across all role pages + fix DealWorkspaceVisualLayer |
| 10 | `1747b66fbe0b` | 2026-05-22 | feat(platform-v7): RBAC engine + outbox pattern + document matrix + 63 tests + live API wiring |
| 11 | `b28478c618a9` | 2026-05-22 | feat(platform-v7): VIL visual polish + component consistency pass |
| 12 | `fd1d69a6c21d` | 2026-05-22 | feat(platform-v7): Prisma SQLite persistence + EvidencePack hash chain + 4 more role pages wired |
| 13 | `66618177b863` | 2026-05-22 | feat(platform-v7): AuditService Prisma persistence + elevator + logistics pages wired |
| 14 | `c3cf0c41bdb1` | 2026-05-22 | feat(platform-v7): Prisma persistence wired into DisputesService + OutboxService |
| 15 | `5fe7983ef715` | 2026-05-22 | feat(platform-v7): evidence-server.ts + deal evidence-pack page wired to live API |
| 16 | `de9d2a72343a` | 2026-05-22 | feat(platform-v7): connectors page wired to live integration health API |
| 17 | `7edac47cef22` | 2026-05-22 | feat(platform-v7): AuditController GET /audit + audit-log page wired to Prisma audit events |
| 18 | `92590e39f5cd` | 2026-05-22 | feat: full Prisma schema + DatabaseSeedService for DB-backed persistence |
| 19 | `ff16b17e63f5` | 2026-05-22 | feat: bank HMAC callback endpoint + executive & admin pages wired to API |
| 20 | `3f2de9610d80` | 2026-05-22 | feat: FGIS + EDO inbound webhooks |
| 21 | `ea3b32d91984` | 2026-05-22 | feat: Prisma-backed deal and shipment reads with in-memory fallback |
| 22 | `e29af5d1a513` | 2026-05-22 | test: 5 unit tests for DatabaseSeedService (75 total) |
| 23 | `d4f474a8ec32` | 2026-05-22 | test: 6 unit tests for DealsService Prisma fallback logic (81 total) |
| 24 | `0021b7848c95` | 2026-05-22 | test: 9 unit tests for SettlementEngineService (90 total) |
| 25 | `b53f81cfc9d2` | 2026-05-22 | feat: complete persistence + admin CRUD + 104 tests |
| 26 | `103c7f15e274` | 2026-05-22 | fix: resolve Railway deploy failures |
| 27 | `b38da26927a6` | 2026-05-22 | fix: correct start script path for production build |
| 28 | `c644d1fc6d01` | 2026-05-22 | fix(platform-v7): unify security-rbac and security-contracts with canonical role model |
| 29 | `0898a4167d4b` | 2026-05-23 | docs(platform-v7): add Stage 4 MoneyTree/Document Matrix implementation plan for Codex |
| 30 | `f7c31a468458` | 2026-05-23 | docs(platform-v7): add PR 4.2 Document Matrix task brief for Codex |
| 31 | `fe8d8ec2bdcf` | 2026-05-23 | fix(platform-v7): apply remaining PR 4.3 blockers on top of Codex rewrite |
| 32 | `86ee932c43ee` | 2026-05-23 | fix(platform-v7): move bankOrganizationId check before actorRole in p7ConfirmBankMovement |
| 33 | `ada725145208` | 2026-05-24 | feat(platform-v7): add P7 Application Service Layer (PR 5.1) |
| 34 | `5b9b72981f38` | 2026-06-07 | docs(platform-v7): recover SOT after generated PR 1562 |
| 35 | `3e11dedf685c` | 2026-06-07 | fix(platform-v7): stop repeated generated slices |
| 36 | `2c50840301d8` | 2026-06-07 | fix(platform-v7): keep generated merge pending-safe |
| 37 | `e2f041f82694` | 2026-06-07 | chore(platform-v7): retrigger generated PR checks |
| 38 | `6f1b66bf0996` | 2026-06-07 | fix(platform-v7): allow autopilot docs in generated reconcile |
| 39 | `fabad5673bbc` | 2026-06-07 | fix(platform-v7): recover merged PRs despite stale rollup |
| 40 | `a892660adbd6` | 2026-06-07 | chore(platform-v7): retrigger SOT recovery checks |
| 41 | `9cfecbc5ad0f` | 2026-06-07 | ci(platform-v7): route generated merges through gate |
| 42 | `4e81bdd3311c` | 2026-06-07 | ci(platform-v7): dispatch generated gate immediately |
| 43 | `fe3e83487e23` | 2026-06-07 | fix(platform-v7): use supported PR merge fields |
| 44 | `3d93aa4444cd` | 2026-06-07 | ci(platform-v7): run guard on generated merge scripts |
| 45 | `f09320f86f44` | 2026-06-07 | fix(platform-v7): wait for SOT mergeability in gate |
| 46 | `049db5983333` | 2026-06-07 | fix(platform-v7): wait for SOT PR discovery in gate |
| 47 | `90ba4a7c0633` | 2026-06-07 | fix(platform-v7): wait uppercase pending statuses |
| 48 | `777e2772d41f` | 2026-06-11 | chore(platform-v7): sync VP-2.5 guard scope |
| 49 | `413ac6c4f2bf` | 2026-06-11 | fix(platform-v7): keep blocked executor dry runs green |
| 50 | `8472d980dd83` | 2026-06-11 | test(platform-v7): isolate localhost backend in vitest |
| 51 | `dd453de3f3bd` | 2026-06-11 | fix(platform-v7): restore shell copy normalizer |
| 52 | `5a9f35448ea8` | 2026-06-11 | test(platform-v7): mock support detail search params |
| 53 | `0b99a85ad15e` | 2026-06-11 | test(platform-v7): await connectors route page |
| 54 | `27dd213a66f6` | 2026-06-11 | test(platform-v7): await logistics route page |
| 55 | `3907f127c7f1` | 2026-06-11 | test(platform-v7): await seller mobile route page |
| 56 | `7725245f033f` | 2026-06-11 | test(platform-v7): await decision pack route pages |
| 57 | `f8fb945a41e8` | 2026-06-11 | test(platform-v7): await bank decision pack route page |
| 58 | `25d7248aac59` | 2026-06-11 | test(platform-v7): refresh dispute metadata assertion |
| 59 | `962dd987710e` | 2026-06-11 | test(platform-v7): refresh deals route assertions |
| 60 | `9196e99d2ae8` | 2026-06-11 | test(platform-v7): accept zero min-width serialization |
| 61 | `8f4997e5ec56` | 2026-06-11 | test(platform-v7): refresh seller fgis route copy |
| 62 | `9b0e9a9cdcfa` | 2026-06-11 | test(platform-v7): refresh market rfq route assertions |
| 63 | `55ebd4d3e2ea` | 2026-06-11 | test(platform-v7): refresh offer to deal route assertions |
| 64 | `b7240d64d4de` | 2026-06-11 | test(platform-v7): refresh clean deal card route assertions |
| 65 | `0e0e3aa4f32a` | 2026-06-11 | test(platform-v7): refresh readiness route assertions |
| 66 | `fcfbc49defea` | 2026-06-11 | test(platform-v7): refresh investor executive route assertions |
| 67 | `0e9bc42c3417` | 2026-06-11 | test(platform-v7): refresh buyer financing route assertions |
| 68 | `75da08f53669` | 2026-06-11 | test(platform-v7): refresh operational panel copy boundary |
| 69 | `e0269d76a5d2` | 2026-06-11 | test(platform-v7): refresh bank payment basis panel assertions |
| 70 | `c01adfc18910` | 2026-06-11 | test(platform-v7): refresh fgis runtime check panel assertions |
| 71 | `4a6f8d94344d` | 2026-06-11 | test(platform-v7): refresh action route policy assertions |
| 72 | `dbd2795ecaf4` | 2026-06-11 | test(platform-v7): refresh shell route alias assertions |
| 73 | `e8e8588fd33f` | 2026-06-11 | test(platform-v7): refresh root work entry assertions |
| 74 | `5dd537d6d5b2` | 2026-06-11 | test(platform-v7): refresh role summary route gate assertions |
| 75 | `bf8d14e64e83` | 2026-06-11 | test(platform-v7): refresh operational role cockpit assertions |
| 76 | `bb6e7829c081` | 2026-06-11 | test(platform-v7): refresh operational role title assertion |
| 77 | `4a135288a1db` | 2026-06-11 | test(platform-v7): refresh operational role title assertion |
| 78 | `fa536e70298f` | 2026-06-11 | test(platform-v7): refresh fgis safety note assertion |
| 79 | `c9415fba1194` | 2026-06-11 | test(platform-v7): align action service trip write surface guard |
| 80 | `1f5f3936ac6c` | 2026-06-11 | test(platform-v7): align workspace dispute money permission guard |
| 81 | `22a50d795bea` | 2026-06-11 | test(platform-v7): refresh money reserve amount fixture |
| 82 | `852356a15d12` | 2026-06-11 | test(platform-v7): relax action target count guard |
| 83 | `bbe1b3f00da4` | 2026-06-11 | test(platform-v7): derive action permission service count |
| 84 | `047556249af7` | 2026-06-12 | test(platform-v7): refresh bank role focus copy guard |
| 85 | `3d93b13a9896` | 2026-06-12 | test(platform-v7): refresh helper assertions |
| 86 | `ac6d9f0383e2` | 2026-06-12 | test(platform-v7): align action feedback registry |
| 87 | `2bffb5697f43` | 2026-06-12 | test(platform-v7): refresh role route guards |
| 88 | `4ee9f03087fb` | 2026-06-12 | test(platform-v7): refresh command center entry guard |

