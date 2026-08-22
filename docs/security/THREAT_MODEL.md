# Threat Model

Status: **IN_PROGRESS.** Covers the threat list required by the IP/security
programme. Prevention and detection cite controls that exist in this
repository today; where a control is absent, the entry says so.

Source SHA: `91d0546e938a870c01e35796bd844681041964e3`
Target: OWASP ASVS 5, Level 3 where applicable. The ASVS matrix
(`docs/security/ASVS_MATRIX.csv`) is **not yet produced** — this document does
not substitute for it.

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

Each is tracked against the IP/security programme under #4459. None is closed
by the existence of this document.
