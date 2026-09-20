# AI-Assisted Provenance

Status: **MEASURED — AI involvement disclosed and attributed per file. One
crown-jewel module has no surviving human-authored line.**

Source SHA: `23cf35a2592e67017505d48748974f834da2b5d7`
History analysed: 27 021 commits across all refs
Machine-readable backing: [`AI_PROVENANCE.csv`](./AI_PROVENANCE.csv),
[`AI_PROVENANCE_SUMMARY.json`](./AI_PROVENANCE_SUMMARY.json),
[`AI_ONLY_FILES.csv`](./AI_ONLY_FILES.csv)
Regenerate with: `node scripts/ip/build-ai-provenance.mjs`

The IP programme requires that AI tooling use is disclosed rather than hidden.
This document discloses it, and — unlike earlier revisions — quantifies it.

## Disclosure

AI tooling from **two vendors** authored commits in this repository.

| Tool | Vendor | Commits | Share |
|---|---|---:|---:|
| Claude Code | Anthropic | 1 254 | 4.6% |
| Codex | OpenAI | 65 | 0.24% |

**Total: 1 319 commits, 4.9% of the analysed history.**

This document was itself written by AI tooling under owner direction, and the
commit carrying it appears under that identity. The disclosure includes the act
of making it.

## Why commit counts understate the picture

Commit share is 4.9%. Surviving-line share is **22.4%**. The two differ because
a single commit may rewrite a whole file, and because the owner's commits are
numerous and often small.

Line share is the honest measure of what the product is made of. Measured by
`git blame` against `HEAD`:

| Contributor class | Surviving lines | Share |
|---|---:|---:|
| OWNER | 864 557 | 76.0% |
| AI_ASSISTANT | 255 183 | 22.4% |
| AUTOMATION_BOT | 9 171 | 0.81% |
| THIRD_PARTY_HUMAN | 8 561 | 0.75% |
| UNATTRIBUTED_SERVER_IDENTITY | 2 | 0.0002% |
| **Total** | **1 137 474** | |

`UNREGISTERED = 0` confirms every author address in the tree is accounted for in
[`contributor-rights-register.json`](./contributor-rights-register.json). There
are no unclassified contributors. 6 901 of 6 904 tracked files were attributed;
the remaining 3 are empty and contain no lines to attribute.

Identities are matched by the SHA-256 of the lowercased Git author address, the
identifier `CONTRIBUTORS.csv` publishes. Raw addresses are personal data and are not
stored in the repository.

## A correction to the earlier measure

Earlier revisions of this file reported AI involvement from the `ai_involvement`
field in `FILE_PROVENANCE.csv`. That field derives from **which addresses ever
touched a file**, which is the correct basis for the rights gate — a contributor
since edited away still once held rights — but the wrong basis for describing the
current code.

Read as a statement about what is in the tree today, it was misleading: a file
whose every surviving line was written by an assistant still reported
`DECLARED_AI_ASSISTED_WITH_HUMAN_AUTHORSHIP`, because a human made its first
commit. On that basis the count of AI-only files was **zero**. On the surviving-
line basis it is **705**.

Both fields are now published. `ai_involvement` continues to serve the rights
gate; `AI_PROVENANCE.csv` describes the code.

## AI-only material

705 files contain AI-authored surviving lines and **no** surviving line authored
by any human identity.

| Scope | Files | AI lines |
|---|---:|---:|
| Whole repository | 705 | 209 723 |
| Inside the protected boundary | 145 | 28 258 |
| CROWN_JEWEL | 142 | 27 984 |

Some of the 705 are generated evidence artifacts (`FILE_PROVENANCE.csv`/`.json`),
which are machine output rather than authored expression, and 23 are the IP tooling
and documents added by the branch that produced this measurement — themselves
AI-written. The crown-jewel subset is real product source.

### Concentration — the finding that matters

AI-only files are not spread evenly. One crown-jewel root is **entirely** AI-only:

| Crown-jewel root | Files | AI-only | % files | % AI lines |
|---|---:|---:|---:|---:|
| `apps/api/src/modules/accounting` | 51 | **51** | **100%** | **100%** |
| `apps/api/src/modules/ledger` | 3 | 2 | 67% | 82% |
| `apps/api/src/modules/organizations` | 3 | 2 | 67% | 99% |
| `packages/domain-core` | 59 | 23 | 39% | 35% |
| `apps/web/lib/gekta` | 18 | 7 | 39% | 56% |
| `packages/integration-sdk` | 51 | 19 | 37% | 48% |
| `apps/api/src/modules/auth` | 91 | 30 | 33% | 39% |

The accounting module is the single concentrated exposure: 51 of 51 files, with
no surviving human-authored line anywhere in it.

## What this exposure actually is

It is **not** the same kind of risk as the unassigned third-party contribution,
and conflating the two would misstate both.

- **Third-party human material** — somebody else may hold rights. A signature
  fixes it. See [`PLATON_IP_ASSIGNMENT.md`](./PLATON_IP_ASSIGNMENT.md).
- **AI-authored material** — nobody else claims it. The vendors' terms assign
  output rights to the operating user. The risk is the opposite one: in some
  jurisdictions **copyright may not subsist in it at all**, because protection
  attaches to human creative authorship.

No signature can close the second. It is not a defect to be remediated but a
limit on what may be claimed, and it is recorded here so that nothing is claimed
past it.

### The measure is an upper bound, not a finding of no human authorship

"No surviving line attributed to a human Git address" is not the same as "no
human creative contribution". Every line of this material was produced under the
owner's direction: specification, prompting, review, correction and acceptance
were human acts, and the selection, structure and arrangement of the codebase are
human decisions throughout.

Whether that direction amounts to authorship in a given jurisdiction is a legal
question this repository cannot answer. What it can do is state the boundary
honestly, which is what the 705 figure is for: it bounds the material for which
the question arises. It does not decide it.

## Position taken

1. **Disclose, do not minimise.** The figures above are published rather than
   summarised away, including the 100% finding for the accounting module.
2. **Do not relabel AI output as human-authored.** No file has been reclassified
   on the strength of AI authorship, and the rights register records the AI
   identities under their own class rather than folding them into OWNER.
3. **Claim the compilation, not every line.** The supportable claim covers the
   codebase as a whole and its selection, structure and arrangement. See
   [`OWNERSHIP_CLAIMS_POSITION.md`](./OWNERSHIP_CLAIMS_POSITION.md) §2.3.
4. **Substantive rework where it is worth the cost.** For the accounting module,
   human authorship could be established by substantive human revision rather
   than cosmetic editing. That is a product decision with real cost, it is out of
   scope for an IP change under `AGENTS.md`, and it is recorded here as an option
   rather than performed.

## Required per-CROWN_JEWEL record — PARTIALLY POPULATED

The programme requires, per CROWN_JEWEL component: `human_specification`,
`human_owner`, `AI involvement`, `reviewer`, `origin evidence`, `final
implementation status`.

Now populated for all 637 CROWN_JEWEL files: `AI involvement` (per-file,
surviving-line basis) and `origin evidence` (Git first-commit, blob SHA and
rights basis). Still **not** populated: `human_specification`, `reviewer` and
`final implementation status`, none of which exist anywhere in the repository to
be extracted. This is an open gap, stated as such.

## Model terms

Use of these tools is governed by each vendor's terms as they stood at the time
of use. Those terms are not reproduced here and are not stored in Git. The rights
holder's recorded position on output produced with them is listed in
[`CHAIN_OF_TITLE_REGISTER.md`](./CHAIN_OF_TITLE_REGISTER.md) under
`HUMAN_LEGAL_ACTION_REQUIRED`.

## Distinct from the product's foundation model

The AI tooling described here is **development tooling** and is unrelated to the
product's own AI system.

The Gekta foundation model is Qwen, classified `THIRD_PARTY_INFRASTRUCTURE`
behind a first-party model adapter, with `QWEN_MODIFICATION = NONE`. Its boundary
is defined in [`proprietary-core-boundary.json`](./proprietary-core-boundary.json).
Qwen is never to be presented as the rights holder's own model, and no development
tool listed above is part of the shipped product.
