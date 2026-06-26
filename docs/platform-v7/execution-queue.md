# platform-v7 execution queue

CURRENT: P0 backend register role assignment hardening.

GOAL: keep platform-v7 moving toward real execution readiness without mixing this P0 auth/session boundary with broad backend, runtime, data, money, documents, integrations, load or ops layers.

CURRENT STATUS:
- #2111 is merged: P0 cabinet-session body-role guard is active.
- #2112 is closed as completed.
- #2113 remains open: branch protection/settings cleanup for deprecated Vercel/Deno required checks.
- #2115 remains open: tool safety blocks the current backend register role hardening write path.

CURRENT ALLOWED:
- apps/api/src/modules/auth/auth.service.ts
- apps/api/src/modules/auth/dto/register.dto.ts
- apps/api/src/modules/auth/**/*.spec.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- production-like register flow must not accept privileged role assignment directly from request DTO;
- controlled-pilot/demo role assignment must be explicit and isolated;
- existing demo auth tests must stay green;
- no web login rewrite, no durable session rewrite and no server RBAC enforce in the same PR;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%;
- no apps/landing, package or lockfile changes.

CURRENT BLOCKERS:
- #2115 blocks the allowed auth file write path for the current P0 backend register role hardening layer.
- #2113 requires repository settings/branch protection verification and should not change platform code.

NEXT AFTER CURRENT GREEN:
- Layer: P0 RBAC / tenant scope / object scope source-of-truth selection.
- Keep it separate from money, ledger, audit, outbox, storage and live integrations.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is active from #2057.
6. Driver / field first-screen scope is active from #2058.
7. Driver / field first-screen pass is active from #2059.
8. Public mobile process carousel polish is active in #2062/#2064.
9. Public process stage copy polish is active from #2065.
10. Netlify root entry redirect recovery is active from root-entry-redirect.
11. Public hero copy polish is active from #2067/#2068/#2070/#2071.
12. Driver field route anchor hardening is active from #2072 after stale #2061 was superseded.
13. Public entry human copy pass is active from #2075.
14. Public register header actions pass is active from #2076.
15. Public register visual system pass is active from #2077.
16. Driver / field follow-up audit is active from #2078.
17. Driver / field mobile touch target hardening is active from #2079.
18. Field roles follow-up audit is active from #2080.
19. P0 auth/session cabinet session body-role guard is active from #2111.
20. P0 backend register role assignment hardening is current and blocked by #2115 until the auth file write path is available.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session rewrite inside the current P0 register layer;
- Netlify plus GitHub Actions green before merge;
- Vercel and Deno deprecated external statuses are not active gate for platform-v7 unless branch protection still requires them.

DONE:
- #2028 seller CSS leak guard.
- #2029 state sync after mobile shell stabilization.
- #2031 seller mobile CSS text leak fix.
- #2032 mobile shell stabilization follow-up.
- #2034 public registration CTA recovery.
- #2036 public role-scoped registration handoff.
- #2037 public login role handoff.
- #2038 stable shell boundary.
- #2040 single shell copy normalizer.
- #2041 public role cards login handoff.
- #2042 access copy polish.
- #2045 mobile header pass.
- #2046 protected mobile header recovery.
- #2048 shell copy normalizer replacement.
- #2049 public entry login split.
- #2051 registration completion route guard.
- #2053 docs queue sync.
- #2055 protected mobile header action recovery.
- #2056 public mobile brand title recovery.
- #2057 elevator first-screen pass.
- #2058 driver field first-screen scope selection.
- #2059 driver field first-screen pass.
- #2065 public process stage copy polish.
- #2067 public hero copy polish.
- #2068 public hero mobile composition.
- #2070 public hero mobile sizing.
- #2071 public entry copy proofread.
- #2072 driver field route anchor hardening.
- #2075 public entry human copy pass.
- #2076 public register header actions pass.
- #2077 public register visual system pass.
- #2078 driver field follow-up audit.
- #2079 driver field mobile touch target hardening.
- #2080 field roles follow-up audit.
- root-entry-redirect Netlify root entry redirect recovery.
- #2111 P0 auth/session cabinet session body-role guard.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope, money/ledger, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete.
