# Owner package C — expert review of the 58 gold-set cases

Status: **blocked on people, not on code.** The corpus, the review protocol, the
validator and the recording tool all exist on exact main. What does not exist is a single
human decision: `reviewed_cases: 0`, `unreviewed_cases: 58`.

Program: #2726, issue #2788. Blocks backlog item **E.06** (authenticated human reviewer
attestation without LLM-only judging), which blocks **E.01–E.05** and ultimately **L.10**.

Issue #2973 is closed and completed, and it is correctly out of the external blocker list.
It delivered the corpus and the protocol. It is **not** evidence of expert acceptance — the
check that issue named as its own closing condition still exits 2. That distinction is the
reason this package exists.

---

## 1. What is being reviewed, and where

| | |
|---|---|
| Corpus source | `docs/platform-v7/autopilot/tai-ap-14c/gold-set-source.v1.json` |
| Validator and materializer | `docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs` |
| Review policy and record file | `docs/platform-v7/autopilot/tai-ap-14c/expert-reviews.v1.json` |
| Recording tool | `docs/platform-v7/autopilot/tai-ap-14c/record-expert-review.mjs` |
| Protocol reference | `docs/platform-v7/autopilot/tai-ap-14c/README.md` |

There is no review web interface. Reviewers work against the materialized corpus, which is
generated deterministically from the source:

```bash
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs \
  --materialize ~/tai-review
```

That writes four files. Reviewers read two of them:

- `~/tai-review/platform-gold.v1.json` — 42 platform cases;
- `~/tai-review/agro-gold.v1.json` — 16 agro cases.

Each case carries its prompts in Russian, English and Chinese, the expected disposition,
the required citation minimum, the freshness rule, the abstention policy and the list of
prohibited claims. **Reviewers judge whether that expected disposition is correct** — they
are not scoring model output, because no model output exists yet. This is review of the
gold standard itself, which is why it has to happen before any accuracy measurement.

---

## 2. Reviewer roles

Four roles are allowed. They are defined in `expert-reviews.v1.json` and the validator
rejects anything else.

| Role | Who this is | What they are judging |
|---|---|---|
| `PLATFORM_OWNER` | Someone who owns how the platform actually behaves — deal states, role permissions, what each cabinet may see | Whether the expected answer matches real platform behaviour, and whether the abstention boundary is drawn in the right place |
| `DOMAIN_EXPERT` | A Russian grain-trade practitioner — agronomy, grain quality, regulation, logistics tariffs | Whether the expected agro answer is factually right and whether the cited official source is the right authority |
| `SECURITY_REVIEWER` | Someone who owns tenant isolation, RBAC and prompt-injection posture | Whether an adversarial case's expected refusal actually closes the hole, rather than only appearing to |
| `LEGAL_OR_METHOD_REVIEWER` | Legal counsel, or a methodologist for measurement questions | Whether a regulatory claim is stated lawfully, and whether prohibited-claim lists are complete |

**Primary role is fixed by domain:** every `PLATFORM` case needs a `PLATFORM_OWNER` among
its approvals; every `AGRO` case needs a `DOMAIN_EXPERT`. No substitution.

**Minimum viable staffing: three people** — one `PLATFORM_OWNER`, one `DOMAIN_EXPERT`, and
one person holding `SECURITY_REVIEWER` or `LEGAL_OR_METHOD_REVIEWER`. Four is better,
because the security and legal judgements are genuinely different skills and the 23
critical cases split unevenly between them.

---

## 3. Which cases are critical, and how many signatures each needs

23 of 58 cases are `CRITICAL`. The rest are `HIGH`.

| Criticality | Cases | Approvals per case | Composition |
|---|---|---|---|
| `HIGH` | 35 | **1** | must include the domain's primary role |
| `CRITICAL` | 23 | **2 independent** | must include the domain's primary role **and** a `SECURITY_REVIEWER` or `LEGAL_OR_METHOD_REVIEWER` |

**Total approval records required: 81.**

"Independent" means distinct `reviewer_id`. One person cannot satisfy both slots on a
critical case by holding two roles — the validator counts distinct
`reviewer_id:reviewer_role` pairs and refuses a duplicate reviewer on the same case.

A single `REJECTED` or `NEEDS_CHANGES` anywhere blocks the whole corpus until it is
resolved. That is deliberate: a rejected case means the gold standard is wrong, and
measuring against a wrong standard is worse than not measuring.

---

## 4. Six work packages

Split by theme so that one person can hold a coherent slice in their head, and so the two
adversarial packages — which need the most care per case — stay small.

### B1 — Platform roles (12 cases, 3 critical, 15 signatures)

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `platform.role.operator` | HIGH | CANONICAL | 1 |
| `platform.role.buyer` | HIGH | CANONICAL | 1 |
| `platform.role.seller` | HIGH | CANONICAL | 1 |
| `platform.role.logistics` | HIGH | CANONICAL | 1 |
| `platform.role.driver` | HIGH | CANONICAL | 1 |
| `platform.role.elevator` | HIGH | CANONICAL | 1 |
| `platform.role.laboratory` | HIGH | CANONICAL | 1 |
| `platform.role.surveyor` | HIGH | CANONICAL | 1 |
| `platform.role.bank` | **CRITICAL** | CANONICAL | 2 |
| `platform.role.compliance` | **CRITICAL** | CANONICAL | 2 |
| `platform.role.arbitrator` | **CRITICAL** | CANONICAL | 2 |
| `platform.role.executive` | HIGH | CANONICAL | 1 |

### B2 — Deal states: draft through signing and money (12 cases, 2 critical, 14 signatures)

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `platform.state.draft` | HIGH | CANONICAL | 1 |
| `platform.state.lot_published` | HIGH | CANONICAL | 1 |
| `platform.state.offer_received` | HIGH | CANONICAL | 1 |
| `platform.state.offer_accepted` | HIGH | CANONICAL | 1 |
| `platform.state.contract_pending` | HIGH | CANONICAL | 1 |
| `platform.state.contract_signed` | HIGH | CANONICAL | 1 |
| `platform.state.reserve_requested` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.reserve_confirmed` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.driver_assigned` | HIGH | CANONICAL | 1 |
| `platform.state.loading_scheduled` | HIGH | CANONICAL | 1 |
| `platform.state.loading_confirmed` | HIGH | CANONICAL | 1 |
| `platform.state.in_transit` | HIGH | CANONICAL | 1 |

### B3 — Deal states: logistics, laboratory, documents, closure (11 cases, 5 critical, 16 signatures)

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `platform.state.arrived` | HIGH | CANONICAL | 1 |
| `platform.state.weighing_completed` | HIGH | CANONICAL | 1 |
| `platform.state.lab_sampled` | HIGH | CANONICAL | 1 |
| `platform.state.lab_protocol_created` | HIGH | CANONICAL | 1 |
| `platform.state.documents_pending` | HIGH | CANONICAL | 1 |
| `platform.state.documents_complete` | HIGH | CANONICAL | 1 |
| `platform.state.dispute_open` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.dispute_resolved` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.partial_bank_basis` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.bank_basis_confirmed` | **CRITICAL** | CANONICAL | 2 |
| `platform.state.closed` | **CRITICAL** | CANONICAL | 2 |

### B4 — Platform adversarial and ambiguous variants (7 cases, 4 critical, 11 signatures)

Highest attention per case. These are where a wrong gold standard would bless a real hole.

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `platform.variant.typo-sdiz` | HIGH | TYPO | 1 |
| `platform.variant.translit-role` | HIGH | TRANSLITERATION | 1 |
| `platform.variant.ambiguous-next` | HIGH | AMBIGUOUS | 1 |
| `platform.variant.adversarial-role-override` | **CRITICAL** | ADVERSARIAL | 2 |
| `platform.variant.adversarial-source-injection` | **CRITICAL** | ADVERSARIAL | 2 |
| `platform.variant.unknown-secret` | **CRITICAL** | ADVERSARIAL | 2 |
| `platform.variant.integration-status` | **CRITICAL** | AMBIGUOUS | 2 |

### B5 — Agro: the eight official-source topics (8 cases, 4 critical, 12 signatures)

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `agro.topic.grain-market-prices` | HIGH | CANONICAL | 1 |
| `agro.topic.agriculture-production` | HIGH | CANONICAL | 1 |
| `agro.topic.grain-regulation` | **CRITICAL** | CANONICAL | 2 |
| `agro.topic.grain-quality` | **CRITICAL** | CANONICAL | 2 |
| `agro.topic.grain-traceability` | HIGH | CANONICAL | 1 |
| `agro.topic.logistics-tariffs` | HIGH | CANONICAL | 1 |
| `agro.topic.finance-rates` | **CRITICAL** | CANONICAL | 2 |
| `agro.topic.agronomy-recommendations` | **CRITICAL** | CANONICAL | 2 |

### B6 — Agro adversarial and ambiguous variants (8 cases, 5 critical, 13 signatures)

| Case | Criticality | Kind | Signatures |
|---|---|---|---|
| `agro.variant.typo-wheat-quality` | HIGH | TYPO | 1 |
| `agro.variant.translit-key-rate` | HIGH | TRANSLITERATION | 1 |
| `agro.variant.ambiguous-price` | HIGH | AMBIGUOUS | 1 |
| `agro.variant.guaranteed-yield` | **CRITICAL** | ADVERSARIAL | 2 |
| `agro.variant.ignore-freshness` | **CRITICAL** | ADVERSARIAL | 2 |
| `agro.variant.invented-law` | **CRITICAL** | ADVERSARIAL | 2 |
| `agro.variant.pesticide-dose` | **CRITICAL** | AMBIGUOUS | 2 |
| `agro.variant.source-injection` | **CRITICAL** | ADVERSARIAL | 2 |

**Suggested assignment with three reviewers**

| Reviewer | Packages | Cases | Signatures |
|---|---|---|---|
| `PLATFORM_OWNER` | B1, B2, B3, B4 (primary on all) | 42 | 42 |
| `DOMAIN_EXPERT` | B5, B6 (primary on all) | 16 | 16 |
| `SECURITY_REVIEWER` / `LEGAL_OR_METHOD_REVIEWER` | second signature on all 23 critical cases across all six | 23 | 23 |

42 + 16 + 23 = 81.

---

## 5. Step-by-step instructions for a reviewer

1. **Get the corpus.**

   ```bash
   git clone <repo> && cd pachanin-demo
   node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs --materialize ~/tai-review
   ```

2. **Open your package's cases** in `~/tai-review/platform-gold.v1.json` or
   `~/tai-review/agro-gold.v1.json`. For each case read: the three prompt locales, the
   expected disposition, the required authority and citation minimum, the freshness rule,
   the abstention policy, the prohibited claims.

3. **Decide, per case, whether the expected disposition is correct.** The questions to
   hold in mind:

   - Would a competent human in this role give this answer to this question?
   - If the expected disposition is *abstain*, is abstaining genuinely right — or is the
     system dodging a question it should answer?
   - If it is *answer with citation*, is the named authority the correct one, and is the
     freshness rule tight enough for how fast this fact moves?
   - For adversarial cases: does the expected refusal actually close the attack, or does
     it merely decline the literal wording while leaving the paraphrase open?
   - Is anything in `prohibited_claims` missing?

4. **Write a review note.** Any format — a signed PDF, a text file, minutes of a meeting.
   It must state the case ids, your decision on each, and your reasoning. It is **not**
   committed to Git; only its SHA-256 goes into the record, so the note can be produced
   later and re-checked against the digest.

5. **Record each decision.** One command per case:

   ```bash
   node docs/platform-v7/autopilot/tai-ap-14c/record-expert-review.mjs \
     --case platform.role.bank \
     --reviewer-id reviewer.ivanov \
     --role PLATFORM_OWNER \
     --decision APPROVED \
     --evidence ~/review-notes/b1-signed.pdf
   ```

   Add `--dry-run` first to see the record without writing it. `--decision` accepts
   `APPROVED`, `REJECTED` or `NEEDS_CHANGES`. Add
   `--disagreement-with <review_id>` when you are deliberately contradicting an existing
   review — the disagreement is recorded, not hidden.

   The tool computes the case digest binding and `review_sha256`, and regenerates
   `baseline-assessment.v1.json` in the same operation. That second part matters: the
   authority compares the computed assessment against the committed baseline *before* it
   reaches `--require-accepted`, so a review recorded without refreshing the baseline would
   make every later run fail with `baseline assessment does not match corpus/reviews`. Both
   files go into your commit.

   It refuses to run if the evidence file is missing or empty, if the case is unknown, if
   the role is not in the allowed list, if you have already reviewed that case, or if your
   `reviewer-id` is long enough to push the constructed `review_id` past 200 characters —
   it tells you the exact budget rather than writing a record the authority would reject.

6. **Commit and open a PR** with the updated `expert-reviews.v1.json` **and**
   `baseline-assessment.v1.json`. Review records are the artefact; they belong in the
   repository history, and the baseline must travel with them.

### If you reject a case

`REJECTED` and `NEEDS_CHANGES` are the useful outcomes when the gold standard is wrong.
The case then has to be corrected in `gold-set-source.v1.json`. Doing so changes that
case's digest, which invalidates every existing review of it — including approvals already
recorded. That is intended: an approval refers to an exact case text, and once the text
changes the approval no longer refers to anything. Those cases must be re-reviewed.

---

## 6. Authenticated identity and MFA

Reviewer identity rests on GitHub commit authorship plus the review note, not on a
platform login. There is no separate reviewer authentication system, and inventing one is
not a prerequisite for this work.

What must be true:

1. **The reviewer has their own GitHub account with MFA enabled**, and it is a member of
   the repository. GitHub requires 2FA for organization members where the organization
   enforces it; confirm it is enforced before assigning packages.
2. **Commits recording reviews are signed** — GPG, SSH or S/MIME, showing `Verified` on
   GitHub. This is what binds a record to a person rather than to a string anybody could
   type.
3. **`reviewer_id` is opaque and stable** — for example `reviewer.ivanov`, not an email
   address. It must match `^[A-Za-z0-9._:-]{1,200}$`. The mapping from `reviewer_id` to a
   real person is held by the owner outside the repository, so a personal identity is not
   published in Git while remaining auditable by whoever holds the mapping.
4. **One person, one `reviewer_id`.** The independence rule for critical cases is only
   real if two ids mean two people. This is the one control here that cannot be enforced
   by software, and it is the owner's responsibility.
5. **The review note is attributable** — signed, or on identifiable letterhead, or minuted
   with named attendees.

A reviewer without MFA and commit signing can still do the intellectual work, but their
decision must be recorded and committed by someone who has both, and the note must name
the actual reviewer. Record that person's `reviewer_id`, not the committer's.

---

## 7. How APPROVED / REJECTED is recorded

Every record lands in the `reviews` array of `expert-reviews.v1.json` in this exact shape:

```json
{
  "review_id": "review.platform.role.bank.reviewer.ivanov",
  "case_id": "platform.role.bank",
  "case_sha256": "430bd297e26acde1f69204e87dc60da4979de2e922406280936df822eaa5a095",
  "reviewer_id": "reviewer.ivanov",
  "reviewer_role": "PLATFORM_OWNER",
  "decision": "APPROVED",
  "reviewed_at": "2026-07-26T00:31:00.318Z",
  "evidence_sha256": "e224733e713e91ac679339176d94dbc71bff505fe565347461be772d738b70e4",
  "disagreement_with_review_id": null,
  "review_sha256": "8e6805f6e13875fcff5b8dbc75f90227c2710e566c65f58f3846dc5877c59890"
}
```

The digests are what make this more than a claim:

- `case_sha256` binds the decision to the exact case text. Edit the case and the record
  goes stale automatically.
- `evidence_sha256` binds it to the reviewer's note without publishing the note.
- `review_sha256` is computed over the whole record minus itself, so the record cannot be
  edited in place afterwards without detection.

The example above is a **dry run against a real case**, printed to show the shape. It is
not in `expert-reviews.v1.json` and must not be copied there: `reviewer.ivanov` is not a
person, and a record with no human behind it is exactly the thing this whole apparatus
exists to prevent.

`expert-reviews.v1.json` currently contains `"reviews": []`. No review has been
fabricated, and none will be. An LLM is not an allowed reviewer role and must never be
recorded as one.

---

## 8. Re-running the acceptance check

At any point, to see where things stand:

```bash
# Structural validation plus current pending assessment. Exit 0 while reviews are missing.
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs

# The acceptance gate. Exit 2 until every case has sufficient approvals.
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs --require-accepted
echo "exit: $?"
```

Current output:

```
"reviewed_cases": 0,
"unreviewed_cases": 58,
"blocking_reasons": ["EXPERT_REVIEWS_MISSING"]
exit: 2
```

The command exits 0 when, and only when: every case has its required number of distinct
approvals, each includes the domain's primary role, each critical case also has a security
or legal/method approval, every `case_sha256` still matches the current corpus, and no
`REJECTED` or `NEEDS_CHANGES` is open.

At that point **E.06** can move to `ACCEPTED` in the acceptance backlog, citing the run
that produced exit 0. Until then it stays `BLOCKED`, and nothing about model quality can
be claimed.

---

## 9. What this package does not claim

- No review exists. `reviewed_cases` is 0 and `expert-reviews.v1.json` is empty.
- Reviewing the gold set does not measure model accuracy. E.01–E.05 need real model
  observations against this corpus, and that needs an admitted model, which needs the
  benchmark, which needs the GPU host and immutable storage.
- E.06 stays `BLOCKED`. Model admission stays `PENDING_ADMISSION`. Production operational
  status stays `NOT_ATTESTED`.
