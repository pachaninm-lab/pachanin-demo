# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the
automation conveyor only — it does not represent product completion.

---

CURRENT: PR 16.0 Risk & Document Security Layer

CURRENT ALLOWED:
- apps/web/tests/unit/platformV7RiskDocumentSecurityLayer.test.ts

CURRENT CRITERIA:
- Confirms all 6 risk & document security source files are present.
- Confirms pre-integration: no live network calls, no external API references.
- Confirms anti-leak-filter: scanMessageForLeaks (phone/email/external_link/messenger/inn/exact_address/bypass_phrase, safeText replacement, maxAction precedence).
- Confirms bypass-risk-score: riskLevelFromBypassScore (low/medium/high/critical thresholds), mapLeakFindingToSignal (finding→signal type mapping, source=chat), calculateBypassRiskProfile (score accumulation, restrictions for high/critical, cooldown for deal_cancelled, clamp 0-100), platformTrustScoreFromBypassRisk (100-bypass clamped).
- Confirms audit-events: createAuditEvent (required fields, optional dealId/reason/before/after), requireReason (5 reason-required actions, throws without reason), withAudit (returns result+auditEvent, enforces requireReason, sets after).
- Confirms contact-vault: canRevealContact (role/stage/bypassRisk/operatorApproval checks), revealContact (throws when denied, returns maskedValue+auditEvent when allowed).
- Confirms document-access-control: canPreviewDocument (driver=false, bypassScore>=80=false, dealDraft/acceptedOffer/operatorApproved=true), canDownloadDocument (driver/investor=denied, no draft=denied, bypassRisk>=35 without approval=denied), documentAccessLabel (download/preview/closed).
- Confirms document-fingerprinting: createDocumentFingerprint (all fields, dealId/lotId/rfqId/NO-SCOPE scope, base64 invisibleFingerprint), auditDocumentAccess (fingerprint+auditEvent, downloaded vs opened action).
- Restricted areas remain blocked. Merge gate remains final authority.

DONE (MASTER-TZ checkpoints):
- Stage 3: RBAC / ACL / roles / access rights
- Stage 4: MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- PR 5.0: Runtime Inventory
- PR 5.3: Persistence Port Interfaces
- PR 5.4: DTO / Validation Schemas
- PR 5.1: Application Service Layer
- PR 5.5: Mock Persistence Adapter
- PR 5.2: Server Action Wrappers
- PR 5.6: Runtime Integration Tests
- PR 5.7: Final Stage 5 QA
- PR 6.0: External Adapter Emulators
- PR 7.0: AI Integration Gateway
- PR 8.0: Product Entry / Onboarding
- PR 9.0: Theme / Visual / Role Cockpit
- PR 10.0: Deal Workspace
- PR 11.0: Deal State / Dispute / Evidence
- PR 12.0: Grain Execution Automation Engines
- PR 13.0: Domain Layer
- PR 14.0: Deal Transaction Layer
- PR 15.0: Grain Automation Engines 2

DONE (autopilot smoke conveyor):
- baseline
- Runner Inline PR
- Runner Gate Fix
- Runner Opens PR
- Runner PR Permission Smoke
- Autopilot Resilience Layer
- Role Boundary Smoke
- Autopilot State Schema
- Autopilot Next-layer Selector
- Autopilot Check Analyzer
- Autopilot Merge Gate
- Autopilot Dry-run Loop
- Autopilot Safe Task Intake
- Autopilot Issue Executor Dry-run
- Autopilot Issue Executor PR Wiring
- Autopilot Full Loop Verification
- Autopilot Live Controlled Pilot Gate
- Autopilot Step Enablement
- Autopilot Scope Proposal Gate
- Autopilot Exact Path Unlock
- Autopilot Product Slice Proposal
- Autopilot Product Slice 01 through 20

NEXT (strict order — each unlocked only after previous merges):
1. PR 5.1 Application Service Layer                 ← DONE
2. PR 5.5 Mock Persistence Adapter                  ← DONE
3. PR 5.2 Server Action Wrappers                    ← DONE
4. PR 5.6 Runtime Integration Tests                 ← DONE
5. PR 5.7 Final Stage 5 QA                          ← DONE
6. PR 6.0 External Adapter Emulators                ← DONE
7. PR 7.0 AI Integration Gateway                    ← DONE
8. PR 8.0 Product Entry / Onboarding                ← DONE
9. PR 9.0 Theme / Visual / Role Cockpit             ← DONE
10. PR 10.0 Deal Workspace                          ← DONE
11. PR 11.0 Deal State / Dispute / Evidence         ← DONE
12. PR 12.0 Grain Execution Automation Engines      ← DONE
13. PR 13.0 Domain Layer                            ← DONE
14. PR 14.0 Deal Transaction Layer                  ← DONE
15. PR 15.0 Grain Automation Engines 2              ← DONE
16. PR 16.0 Risk & Document Security Layer          ← CURRENT

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
