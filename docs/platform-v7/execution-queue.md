# platform-v7 execution queue

CURRENT: P0 auth/session cabinet session body-role guard.

GOAL: keep platform-v7 moving toward real execution readiness without mixing this P0 auth/session boundary with broad backend, runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- apps/web/app/api/platform-v7/cabinet-session/route.ts
- apps/web/tests/unit/platformV7CabinetSessionRoute.static.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- #2111 is a narrow P0 auth/session hardening PR;
- direct `body.role` must not remain an unconditional trusted source for cabinet session issuance;
- verified backend role is preferred when available;
- direct body-role issuance is allowed only behind explicit controlled-pilot/demo/dev-test boundaries;
- production-like mode rejects direct body-role issuance unless a verified backend role exists;
- keep current controlled-pilot / pre-integration maturity language;
- readiness remains 72% until broader runtime/security layers are merged and verified;
- no apps/landing, package or lockfile changes;
- no broad backend/API/DB/auth/session rewrite in this PR.

NEXT:
- Layer: P0 backend register role assignment hardening.
- Allowed files:
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/dto/register.dto.ts
  - apps/api/src/modules/auth/**/*.spec.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - production-like register flow must not accept privileged role assignment directly from request DTO;
  - controlled-pilot/demo role assignment must be explicit and isolated;
  - existing demo auth tests must stay green;
  - no web login rewrite, no durable session rewrite and no server RBAC enforce in the same PR;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72%.

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
19. P0 auth/session cabinet session body-role guard is active here.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session rewrite inside #2111;
- Netlify plus GitHub Actions green before merge;
- Vercel and Deno deprecated external statuses are not active gate for platform-v7.

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

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope, money/ledger, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete.
