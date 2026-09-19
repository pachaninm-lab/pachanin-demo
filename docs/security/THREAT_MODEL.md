# Threat Model

Status: **IN_PROGRESS.** Covers the threat list required by the IP/security
programme. Prevention and detection cite controls that exist in this
repository today; where a control is absent, the entry says so.

Source SHA: `91d0546e938a870c01e35796bd844681041964e3`
Target: OWASP ASVS 5, Level 3 where applicable. The ASVS matrix is produced by
`scripts/security/build-asvs-matrix.mjs` from
`docs/security/asvs-applicability-decisions.json`; this document does not
substitute for it, and neither one is evidence that a control is deployed.

No exploitable detail, reproduction steps, secrets or CROWN_JEWEL source
appear here, by policy.

## Standing constraints

Three facts shape every entry below and are not repeated in each one.

| Constraint | Consequence |
|---|---|
| Repository is **public** | Source-exfiltration threats are already realised. Attackers read the code. |
| **No independent reviewer** | Every "four-eyes" control is aspirational, not enforced. |
| **Single owner** | Every `owner` field below resolves to the same person. Bus factor 1. |

`HISTORICAL_SOURCE_DISCLOSURE = TRUE`. A later private cutover reduces future
exposure; it does not retract what is already published.

## Trust boundaries

1. Browser ↔ web app — untrusted client. No client-supplied role, tenant, price, status or approval is authoritative.
2. Web ↔ API — server-authoritative decisions only.
3. API ↔ PostgreSQL — tenant isolation enforced in the database, not only in application code.
4. API ↔ external integrations (1С, ЭДО, Диадок, СБИС, banks, ФГИС, РЖД/ЭТРАН, КриптоПро, ФНС, Росреестр) — untrusted responses behind first-party ports/adapters.
5. Gekta ↔ Qwen — foundation model is third-party infrastructure behind a first-party adapter; model output is untrusted content.
6. Gekta ↔ retrieved/user content — RAG and uploads are untrusted input, never instructions.
7. GitHub Actions ↔ repository and registry — CI holds privileges the developer does not.
8. Operator ↔ REG.RU VPS — production authority.

---

## 1. Source, repository and insider

### Repo theft / source exfiltration
- **Assets:** CROWN_JEWEL domain, settlement, pricing, risk, accounting, Gekta orchestration.
- **Attacker:** anyone with a browser; a former collaborator.
- **Path:** clone the public repository.
- **Prevention:** CROWN_JEWEL boundary defined machine-readably (`docs/ip/proprietary-core-boundary.json`, 32 protected roots); CODEOWNERS present; forbidden publication roots declared.
- **Detection:** none for reads of a public repository.
- **Residual risk:** **HIGH — realised.** The code is public now.
- **Response:** private cutover, then treat future work as trade secret. Does not undo prior disclosure.

### Account takeover of the repository owner
- **Path:** credential stuffing or session theft against the single GitHub account.
- **Prevention:** MFA on the account (owner-managed, outside this repository).
- **Detection:** GitHub audit log.
- **Residual risk:** **HIGH.** One account compromise equals full control of source, CI and release. No second approver exists to interrupt it.
- **Owner action required:** hardware security key; no shared accounts.

### Malicious insider
- **Prevention:** least privilege, immediate offboarding (documented intent, not enforced tooling).
- **Residual risk:** **HIGH.** With no second reviewer, a single trusted identity can merge anything.

### Secret leakage
- **Prevention:** `Secrets · Gitleaks blocking`, `Repository secrets · Trivy blocking`, `Secret scanning (gitleaks)` — all blocking on every PR.
- **Detection:** the same gates on every exact head.
- **Evidence:** green on every merge in this programme.
- **Residual risk:** **MEDIUM.** Full-history scanning is authoritative in CI, but any secret ever committed must be treated as compromised until rotated, and `docs/security/SECRET_ROTATION_REGISTER.md` does not yet exist.

---

## 2. Supply chain and CI

### CI compromise
- **Prevention:** third-party Actions pinned to immutable commit SHAs; bounded workflow permissions; `pnpm install --ignore-scripts`; checkout credentials not persisted; exact-head SHA verification.
- **Detection:** `Workflow Syntax Guard`, `platform-v7 autopilot guard` (source-controlled path allow-list), `Security policy · exact-head scope and exceptions`.
- **Residual risk:** **MEDIUM.** CI can push images and read secrets; a malicious merge is the realistic route in, and merging currently needs no second approver.

### Supply-chain attack / dependency hijack / package compromise
- **Prevention:** lockfile-pinned installs; install scripts disabled; `dependency-review` on every PR; `Production dependencies · HIGH and CRITICAL blocking`; `npm/pnpm dependency audit`; `Trivy vulnerability scan`.
- **Detection:** the above, plus Dependabot advisories.
- **Residual risk:** **HIGH.** GitHub reports critical- and high-severity advisories against the default branch. Production runtime dependencies are separately gated and green, so the open remainder is concentrated in dev/transitive scope — but the programme target of zero is **not met**.

### Malicious or anomalous package
- **Prevention:** dependency allow-list required by policy — `config/dependency-allowlist.json` **does not yet exist**.
- **Residual risk:** **HIGH.** New dependencies are not yet gated against an approved list.

---

## 3. Production and data

### REG.RU compromise
- **Assets:** production runtime, database, TLS material.
- **Prevention:** production authority restricted to REG.RU VPS; exact-SHA/digest release discipline; Caddy-fronted routing.
- **Detection:** live domain smoke checks; running-revision binding in CI.
- **Residual risk:** **MEDIUM.** Signed immutable release provenance is not yet fully established.

### Database theft / backup theft / ransomware
- **Prevention:** no public database exposure; TLS; least-privilege roles; migration/runtime separation; encrypted backups (intended).
- **Detection:** `12 roles · 19 commands · PostgreSQL RLS · DR restore` exercises restore in CI.
- **Residual risk:** **HIGH.** A restore job passing in CI is not a proof of production backup recovery. `docs/security/BACKUP_RESTORE_EVIDENCE.md` does not exist, RPO/RTO are undefined, and no immutable offline copy is proven. **Backup without restore proof is not a PASS.**

---

## 4. Application security

### Tenant breakout / IDOR / BOLA
- **Assets:** every organization's deals, documents, money and accounting records.
- **Prevention:** PostgreSQL row-level security enabled in migrations — enforcement lives in the database, not only in application code; server-side identity → tenant → role → permission → resource → policy chain.
- **Detection:** `PostgreSQL 16 RLS tenant isolation` and `RLS, race, restart, appeal and settlement acceptance`, blocking on every PR.
- **Evidence:** green on every merge in this programme.
- **Residual risk:** **LOW–MEDIUM.** Coverage is proven for tested surfaces; exports, search, websocket and support tooling need explicit per-surface confirmation.

### Privilege escalation / MFA bypass / session theft
- **Prevention:** server-authoritative role and session decisions; session rotation on privilege transition — entering MFA-pending state rotates the session and its CSRF token (proven by the acceptance repair in #4505); MFA enrolment, recovery and freshness policy inside the CROWN_JEWEL boundary.
- **Detection:** `Persistent sessions · rotation · MFA · revoke`, blocking.
- **Residual risk:** **LOW–MEDIUM.**

### CSRF
- **Prevention:** CSRF tokens across the web layer; token rotates with the session, so a pre-login token cannot be replayed into a post-login state.
- **Detection:** browser acceptance matrix exercises real MFA login.
- **Residual risk:** **LOW.**

### SQLi
- **Prevention:** parameterised access through the ORM/adapter layer; raw SQL confined to migrations.
- **Detection:** `SAST · Semgrep blocking`, `CodeQL`.
- **Residual risk:** **LOW.**

### XSS / RCE
- **Prevention:** React escaping by default; server-side rendering boundaries.
- **Detection:** `CodeQL`, `SAST · Semgrep blocking`, `Qodana`.
- **Residual risk:** **LOW–MEDIUM.**

### SSRF
- **Prevention:** outbound integration calls constrained to first-party adapters; public-IPv4 DNS pinning applied where recipient-controlled hosts are contacted.
- **Detection:** `CodeQL`, `SAST · Semgrep blocking`.
- **Residual risk:** **MEDIUM.** Not every outbound path has been individually audited.

### Credential stuffing
- **Prevention:** rate limiting present across API surfaces; MFA required for privileged roles.
- **Residual risk:** **MEDIUM.**

---

## 5. Business logic and money

### Settlement manipulation / unauthorised money operation
- **Assets:** settlement engine, ledger, accounting invariants.
- **Prevention:** server-authoritative settlement decisions; integer/fixed-point money; transactional writes; idempotency keys used broadly across the API; row locking and versioning; double-entry invariants.
- **Detection:** `Auction Atomic Gate`, `Outbox PostgreSQL Gate`, `Industrial core · races · outbox · reconciliation · load proof`, `PostgreSQL race, restart and rollback acceptance` — all blocking.
- **Residual risk:** **MEDIUM.** Race and rollback behaviour is exercised; a full abuse-case matrix (skip/self approval, double release, price change after approval, dispute bypass) is **not yet documented** as a standalone suite.

### Replay / race condition / webhook forgery
- **Prevention:** idempotency; outbox pattern with leases and redrive; transactional state transitions.
- **Detection:** `PostgreSQL leases, recovery and redrive acceptance`, `Two worker processes · PostgreSQL 16 · Kafka · recovery`.
- **Residual risk:** **MEDIUM.** Inbound webhook signature verification per integration partner is not individually evidenced here.

### Document substitution / forged evidence
- **Prevention:** document lifecycle and substitution-prevention workflow inside the CROWN_JEWEL boundary; tamper-evident audit and evidence-pack orchestration.
- **Residual risk:** **MEDIUM.** Audit tamper-evidence is asserted by design; independent verification is not yet evidenced.

---

## 6. Gekta and the foundation model

### Prompt injection
- **Assets:** Gekta tool execution, Deal and accounting context, user data.
- **Path:** untrusted content — a retrieved document, an upload, or user text — carrying instructions that the model follows.
- **Prevention:** untrusted-content handling and safety policy implemented in the first-party TAI layer (`apps/tai`), which is where orchestration, retrieval and safety logic live.
- **Residual risk:** **MEDIUM–HIGH.** Defences are concentrated in the TAI layer; the API-side Gekta and tool modules contain no explicit injection-isolation markers, so tool-call isolation across that boundary needs confirmation rather than assumption.

### RAG poisoning
- **Path:** attacker-influenced content enters the retrieval corpus and steers later answers.
- **Prevention:** first-party retrieval and ranking; provenance handling in the product layer.
- **Detection:** none automated.
- **Residual risk:** **HIGH.** `docs/ip/DATA_AND_MODEL_PROVENANCE.csv` does not exist, so corpus origin is not yet registered. Unknown data origin is an open item.

### Model extraction
- **Path:** systematic querying to reconstruct proprietary prompts, decision trees, pricing or risk logic.
- **Prevention:** system prompts and commercial algorithms held server-side; rate limiting.
- **Residual risk:** **MEDIUM.** No automated extraction-pattern detection exists.

### Foundation model integrity
- **Prevention:** Qwen classified `THIRD_PARTY_INFRASTRUCTURE`, used unmodified behind a first-party adapter. `QWEN_MODIFICATION`, `QWEN_FINETUNE`, `QWEN_LORA`, `QWEN_WEIGHT_MUTATION` all declared `NONE` in `docs/ip/proprietary-core-boundary.json`.
- **Detection:** the boundary requires pinned model and tokenizer hashes, fail-closed.
- **Residual risk:** **MEDIUM.** The declaration exists; an enforced fail-closed hash gate is **not yet implemented**, so an unexpected model, tokenizer or config change would not currently fail the build.
- Qwen must never be presented as the rights holder's own model.

---

## 7. Upload handling

- **Prevention:** required controls are MIME plus magic-byte plus extension agreement, size and decompression limits, malware scan and quarantine, parser isolation, signed URLs and tenant binding.
- **Residual risk:** **MEDIUM.** These are programme requirements; per-control evidence is not yet assembled in this document and should be established before upload handling is claimed as PASS.

---

## 8. Transport configuration

- **Prevention:** the production edge is Caddy with automatic HTTPS on the single
  REG.RU virtual server. Where the application opens a TLS socket itself it sets
  `rejectUnauthorized: true`, and nothing in the tree disables certificate
  verification — there is no `rejectUnauthorized: false` and no
  `NODE_TLS_REJECT_UNAUTHORIZED` anywhere.
- **Detection:** none. No configuration drift check exists for the edge.
- **Residual risk:** **HIGH.** Two distinct gaps.
  - **The production TLS configuration is not under version control.** The
    runbook treats Compose, Caddy and environment as protected artifacts held on
    the host. Nothing in this repository can show which protocol versions,
    cipher suites, certificate chain or stapling behaviour production serves. A
    change to the edge leaves no reviewable trace, and no ASVS transport
    requirement can be closed from source.
  - **Internal service-to-service traffic is plaintext by default.** Web to API,
    API to Elasticsearch, API to the model service and the telemetry exporter
    all default to `http://`, and the telemetry endpoint validator accepts a
    plaintext scheme deliberately. `infra/istio/peer-authentication.yml` declares
    STRICT mesh mTLS, but it does not apply: production is Docker Compose on one
    virtual server, not a Kubernetes cluster, and the platform's own interface
    copy states the mesh is a target model pending a live cluster.
- `infra/nginx/nginx.conf` is **not** the production terminator. Its TLS
  directives must never be cited as evidence about production.

---

---

## Authentication pathways

Every way a request can come to be treated as authenticated, and what each one
proves. ASVS 5.0 V6.1.3 asks for exactly this list, together with the controls
and the authentication strength behind each entry; V6.3.4 asks additionally that
nothing be missing from it. It is held to the tree by
`scripts/security/verify-authentication-pathways.test.mjs`, which enumerates
every file that signs a session token or writes a session cookie and fails when
one of them is not accounted for here.

**One credential format on the API side.** `apps/api/src/modules/auth/access-token.ts`
signs and verifies the only access-token format the API accepts, for platform and
Gekta sessions alike, under one secret, with issuer, audience and token type all
checked. Session scope is never read from the token: it is re-read from
`auth.sessions` on every verification, so a client cannot widen its own scope.
Every one-time bearer credential — password reset, MFA recovery, invitation,
email verification, membership selection, refresh, MFA challenge, registration
status, backup code, staff access — is minted by `opaque-token-authority.ts`,
purpose-bound and versioned, so a token issued for one purpose cannot verify
against another purpose's record.

**Two tiers, and they are not the same thing.** An API session admits a request
to data. A *cabinet session* is a web-tier cookie read by the Next.js middleware
to decide which role's pages render; it is signed with `JWT_SECRET` but the API
never sees it and never accepts it. Three routes mint one. Everything a cabinet
session displays is still fetched with an API credential, so it selects a view,
it does not grant data access.

### Ways in — API sessions

| # | Pathway | Proof required | Strength |
|---|---|---|---|
| A | Platform login (`auth.service.ts`) | password, then MFA where the role or account requires it | password (+ TOTP/backup code, conditional) |
| B | Gekta product login (`gekta-registration.service.ts` → `product-session.service.ts`) | password, then MFA always | password + TOTP/backup code, unconditional |
| C | Gekta registration email verification | one-time registration token, then TOTP enrolment | address possession + TOTP |
| D | Demo login (non-production only) | none | none, by design — fail-closed in production |

**A — platform login.** The password is verified with the versioned hashing
module, then re-read inside the same serializable transaction before a session is
issued, so a password change between the check and the session invalidates the
proof. MFA is required when the role demands it, when the account is an
organization admin, or when the account has enrolled a factor; where required,
the session starts `MFA_PENDING` with a ten-minute challenge and only the
verified code activates it.

**B — Gekta product login.** Same password verification, and the stored hash is
re-read and compared inside the transaction before anything is issued. MFA is
**not** conditional here: `issueMfaSession` always creates an `MFA_PENDING`
session and a challenge, and no active token is issued at that step. This
pathway is strictly stronger than A, deliberately. It is separately scoped: a
Gekta session lives in the product session store, and the guard resolves it only
on routes explicitly marked as product-session surfaces, so the two are not
interchangeable.

**C — Gekta registration email verification.** The one-time registration token
proves control of the address, and the challenge row must be consumed by exactly
one update or the flow aborts. It mints an enrolment session, not an active one:
the TOTP step still has to be completed. No password is presented at this step
because it was set at registration and its hash already exists.

**D — demo login.** Three routes (`/api/auth/demo`, `/api/auth/demo/role/[role]`,
`/api/auth/demo/instant/[role]`) and one branch in the web proxy mint
`demo.`-prefixed cookies with a role derived from the email prefix, with no
password and no MFA. Four independent controls stand between that and production:

1. `demoLoginAllowed()` returns false whenever `NODE_ENV` is `production`,
   **before** the enabling flag is read, so production cannot switch it on with
   an environment variable.
2. Each route answers 503 when the policy is false.
3. The token is not a signed JWT, and the API accepts exactly one format, so it
   cannot authenticate to the API at all.
4. The web proxy refuses to forward it (`verified_real_session_required`,
   `demo_session_disabled`) rather than passing it upstream.

The primary login route contains no demo fallback, and a test asserts it stays
that way.

### Ways in — cabinet sessions (web tier only)

| # | Pathway | Proof required | Production |
|---|---|---|---|
| E | Owner cabinet open (`/platform-v7/staff/open-cabinet`) | CSRF + origin, an existing access cookie, and an ACTIVE `PLATFORM_OWNER` assignment with `mfaVerified` confirmed by the API | reachable |
| F | Cabinet session (`/api/platform-v7/cabinet-session`) | a backend-verified role; a body-supplied role only outside production | body-role path blocked |
| G | Cabinet lock login (`/api/platform-v7/cabinet-lock-login`) | a configured shared password | 410, always |

**E — owner cabinet open.** The one cabinet pathway reachable in production, and
the strongest of the three. It requires a CSRF token compared in constant time
against its cookie plus an allow-listed origin, an existing access cookie, and
then an authority decision: either the API confirms an ACTIVE `PLATFORM_OWNER`
assignment **with MFA verified**, or — only when three environment variables
including a hard expiry date are all set — a controlled test fixture token
carrying `testAccess` and `owner` claims. A real platform access token cannot
satisfy the fixture branch: it carries different claim names entirely. The role
is bound server-side to a fixed controlled test organization and a submitted
organization that does not match is refused, so this cannot open a customer
organization. Lifetime is capped at one hour for the API-authorized branch and
eight for the fixture.

**F — cabinet session.** Issues a cabinet cookie from a backend-verified role.
The direct body-supplied role is available only under `NODE_ENV` of `development`
or `test`.

**G — cabinet lock login.** A shared-password gate for non-production review
contours. It answers 410 in production before reading anything else, and 503
when no password is configured, so an unset environment cannot become an open
door.

### Not ways in

**Refresh** rotates a refresh credential within its family and re-issues an
access token. It performs no authentication and inherits the strength of the
pathway that created the session; it can neither raise nor lower it.

**MFA step-up** (`/api/auth/mfa-step-up/start|verify`) requires an existing
access token and elevates an already-authenticated session for control-plane and
financial actions. Freshness is enforced in the guard for financial commands
above a threshold.

**Staff access sessions** are not an independent pathway. The guard verifies the
platform access token first and only then resolves the `x-staff-access-session`
header, which narrows an already-authenticated actor rather than establishing
one. A repeated header is rejected rather than merged.

**The gov-id bridge** (`/api/platform-v7/gov-id/start` and `/callback`, gated by
`PLATFORM_V7_GOV_ID_ENABLED`) is OIDC-shaped but does not authenticate. The
callback validates `state` against its cookie, then redirects to a fallback
target with a reason and clears its own cookies. It never exchanges the
authorization code, never contacts a token endpoint, and writes no session,
access, refresh or CSRF cookie. Earlier revisions of this programme recorded it
as the second authentication pathway; re-reading it showed that it is not one,
and that the pathways that do exist were the ones not written down.

**The Sber Business callback** was a pathway and is one no longer. Its web half
would have set access, refresh, session and CSRF cookies from any upstream
payload carrying a token, with no `state` validation and no MFA step, behind a
server half that returned `not_configured`. It was removed in #4692; only
read-model helpers remain, with no importer.

### Consistency

A, B and C all terminate in the same place — a session row whose scope is re-read
on every request — and all three require a second factor before that session
becomes active, except where A's risk-based rule says none is required for that
role and account. That exception is a property of the account, not of the route
taken, and the caller cannot choose it.

D and G are deliberate exceptions that production cannot reach: D produces a
credential the API refuses, and G answers 410 before it reads its own
configuration.

E is the case that needs care, because it is reachable in production and mints a
role-bearing cookie. Two things bound it: the authority check demands an active
owner assignment **with MFA already verified**, which is a higher bar than
pathway A clears; and the session it mints is a web-tier view selector bound to a
controlled test organization, not an API credential.

**Residual risk: MEDIUM.** The inventory is now enforced against the tree, and
that is a real control: a new minting surface fails the build until it is written
down. What is *not* yet proven is the second half of V6.3.4 — that the controls
behind each of these twelve surfaces are enforced consistently. That needs
per-surface evidence, particularly for what the middleware trusts a cabinet
cookie to assert, and it is not claimed here.


## Summary of open gaps

Ranked by residual risk, these are the items this model does **not** consider mitigated:

1. Public proprietary source — realised, irreversible.
2. Critical/high dependency advisories on the default branch — target is zero.
3. No independent reviewer — no four-eyes control is real.
4. No backup restore proof, no defined RPO/RTO.
5. No dependency allow-list.
6. RAG corpus provenance unregistered.
7. Qwen immutability declared but not enforced fail-closed.
8. Account takeover of the single owner identity is unbounded in impact.
9. Production TLS configuration is not under version control.
10. Internal service-to-service traffic is plaintext by default.

Each is tracked against the IP/security programme under #4459. None is closed
by the existence of this document.
