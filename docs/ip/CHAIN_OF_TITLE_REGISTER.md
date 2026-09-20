# Chain of Title Register

Status: **MEASURED — one identity unresolved with live exposure, one unresolved
with none. All other contributing identities carry a recorded rights basis.**

Source SHA: `74ffed9c5fa858f7accbd2ab6594877de3f50280`
History analysed: 27 017 commits across all refs, full (non-shallow) history
Machine-readable backing:
[`contributor-rights-register.json`](./contributor-rights-register.json),
[`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv),
[`AI_PROVENANCE.csv`](./AI_PROVENANCE.csv)
Regenerate with: `node scripts/ip/build-ip-clean-room.mjs <outDir>`

This register records **who committed**, which is a repository fact, and **what
rights basis the rights holder records for each identity**, which is a position.
Neither is an adjudication of title. Git proves who committed; it never proves
who owns.

## Method and its two bases

Two different questions are asked of Git, and they need different bases.

**Who held rights in anything that ever went into this repository** is asked of
`git log --all`: 27 017 commits over every ref in the clone, including unmerged
branches. That is the conservative basis — it counts an identity as having
touched a file even if the work later moved or was superseded.

**What the product is made of today** is asked of `git blame` against `HEAD`:
which identity authored each line that actually survives. That is the basis for
the AI provenance in [`AI_PROVENANCE.csv`](./AI_PROVENANCE.csv) and for the
assignment schedule.

A file clears to first-party only under one of three tiers, in this order:

1. `TOUCH_HISTORY` — no identity lacking a resolved basis ever touched it.
2. `SURVIVING_LINE` — such an identity did touch it, but owns no surviving line.
3. `DE_MINIMIS_RESIDUE` — such an identity owns surviving lines, and every one of
   them has been verified to carry no expression. See
   [`deminimis-line-adjudications.json`](./deminimis-line-adjudications.json).

Everything else stays `UNKNOWN`. The default presumes nothing owned.

## Identity classification

19 distinct author addresses, consolidated into 6 identities. Commit counts sum
to 27 017, matching the analysed history exactly.

Throughout this package an identity is named by the SHA-256 of its lowercased Git
author address — the identifier [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv) already
publishes. Raw addresses are personal data and are not stored in the repository, so
the classifier, the registers and the generated evidence all match on the digest.

| Identity | Class | Addresses | Commits | Share | Rights status |
|---|---|---:|---:|---:|---|
| pachaninm-lab | OWNER | 3 | 25 162 | 93.1% | **RESOLVED** |
| Claude | AI_ASSISTANT | 2 | 1 254 | 4.6% | **RESOLVED** |
| repository automation | AUTOMATION_BOT | 11 | 444 | 1.6% | **RESOLVED** |
| Platon | THIRD_PARTY_HUMAN | 1 | 88 | 0.33% | **UNRESOLVED** |
| Codex | AI_ASSISTANT | 1 | 65 | 0.24% | **RESOLVED** |
| root (project server) | UNATTRIBUTED_SERVER_IDENTITY | 1 | 4 | 0.01% | **UNRESOLVED** |

### OWNER — resolved, with one confirmation outstanding

The rights holder committed under three addresses: one personal, two GitHub
noreply forms carrying the same account id. That they are one account is a
repository fact. That the resulting rights are held *personally*, rather than
assigned to an employer or a commissioning party, is not a repository fact and
is listed below for confirmation.

### AI_ASSISTANT — resolved against third parties, unsettled as to subsistence

Two vendors. Recorded under provider terms assigning output rights to the
operating user, so no third party claims this material. That is a different
question from whether copyright subsists in it at all. See
[`AI_ASSISTED_PROVENANCE.md`](./AI_ASSISTED_PROVENANCE.md); the exposure there is
non-protectability, not a competing owner, and no signature can close it.

### AUTOMATION_BOT — resolved

11 addresses. These identities execute workflows that are themselves first-party
files in this repository. Their commits are deterministic transformations, not
independent authorship. Dependabot commits move dependency version ranges and
introduce no third-party source into the tree.

Three of these addresses share one mailbox hash under three display names.
Whoever controls that mailbox controls all three. Recorded as an observation.

### THIRD_PARTY_HUMAN — UNRESOLVED, and the only live exposure

One natural person, neither the owner nor an automation account, whose authored
material survives in the current tree. Nothing in the repository records an
assignment, a contributor agreement or an employment relationship.

The exposure is quantified rather than estimated. The exact file and line
schedule is [`PLATON_ASSIGNMENT_SCHEDULE.csv`](./PLATON_ASSIGNMENT_SCHEDULE.csv),
and the prepared instrument is [`PLATON_IP_ASSIGNMENT.md`](./PLATON_IP_ASSIGNMENT.md).

This is **the single remaining chain-of-title gap with live effect on the gate.**

### UNATTRIBUTED_SERVER_IDENTITY — UNRESOLVED, no live exposure

Four commits made as `root` on the project's own virtual server. A root shell
identifies a machine account, not a person, so the natural person behind them is
not established by Git alone, and the identity stays UNRESOLVED.

It blocks nothing. Its entire surviving footprint is two lines in one file — a
blank line and a no-op comment appended by commit `1b5a84b07` purely to change
the file's hash so a CI workflow would re-run. Those two lines are adjudicated
non-expressive and re-verified against the real file content on every run; the
adjudication fails automatically if the content ever changes.

The line was **not** removed and the history was **not** rewritten. Erasing a
provenance question is not the same as answering it.

## CROWN_JEWEL position

| Measure | Baseline | Current |
|---|---:|---:|
| Tracked files | 6 881 | 6 881 |
| `UNKNOWN` origin | 6 840 | **132** |
| `FIRST_PARTY_PROPRIETARY` | 0 | **6 708** |
| Unresolved rights files | 6 880 | **172** |
| CROWN_JEWEL files | 637 | 637 |
| CROWN_JEWEL of unknown origin | 637 | **24** |
| Unresolved file licence markers | 0 | **0** |

The requirement is `CROWN_JEWEL_UNKNOWN_ORIGIN = 0`. Current state is **24**, so
the requirement is **FAIL**, not partially met.

All 24 are attributable to the single unresolved third-party identity. This was
established by measurement rather than inference: temporarily marking that
identity `RESOLVED` drove `UNKNOWN_ORIGIN_FILES` and `CROWN_JEWEL_UNKNOWN_ORIGIN`
to **0**, after which the register was restored unchanged. The residual is
exactly one signature wide.

The remaining 172 unresolved-rights files are the 132 `UNKNOWN` files plus 40 IP
control files that carry `HUMAN_CHAIN_OF_TITLE_CONFIRMATION_REQUIRED` by design —
the IP tooling declines to certify itself.

## HUMAN_LEGAL_ACTION_REQUIRED

Technical work cannot close these. What follows is the complete list; earlier
revisions of this register listed four items, and two have since been closed by
measurement rather than by signature.

1. **Assignment from the third-party individual.** An instrument transferring
   exclusive rights in the scheduled material to the rights holder. Prepared and
   awaiting signature. **This is the only item blocking the ownership gate.**
2. **Owner confirmation of personal holding.** A recorded confirmation that the
   rights are held personally and are not assigned to an employer or
   commissioning party. Does not block the gate; affects who the rights holder
   actually is.
3. **Recorded position on AI-assisted output.** A determination on how the rights
   holder treats material produced with AI tooling, including the terms in force
   at the time of use. Does not block the gate; bounds what may be claimed.

Closed since the previous revision:

- ~~Owner identity consolidation~~ — resolved as a repository fact. The three
  addresses carry the same GitHub account id.
- ~~Identification of the root identity~~ — no longer required for classification.
  Its surviving footprint is non-expressive and adjudicated as such; the identity
  remains UNRESOLVED and blocks nothing.

Store resulting documents outside Git. Reference them here by identifier and
hash only, then move the corresponding rows to `RESOLVED`.

## What a RESOLVED row does not mean

It does not mean a court has ruled, that an instrument was reviewed by a lawyer,
or that the rights holder's position is beyond challenge. It means the rights
holder has recorded a basis, the basis is stated, and the classifier was allowed
to rely on it. A reader doing diligence should read the basis, not the status.
