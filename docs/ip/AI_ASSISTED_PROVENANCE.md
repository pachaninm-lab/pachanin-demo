# AI-Assisted Provenance

Status: **IN_PROGRESS — AI involvement disclosed; per-file attribution measured; per-CROWN_JEWEL records not populated.**

Source SHA: `4998f58ebdf66db84f45054b0af84b8ea28577ee`
History analysed: 24 848 commits, full (non-shallow) history
Machine-readable backing: [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv), [`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv)
Attribution artefact: `artifacts/ip-clean-room/AI_ATTRIBUTION.json`
Regenerate with: `node scripts/ip/build-ai-attribution.mjs`

The IP programme requires that the use of AI tooling is disclosed rather than
hidden. This document discloses it.

## Disclosure

AI tooling from **two different vendors** authored commits in this repository.

| Tool | Vendor | Identity | Commits |
|---|---|---|---:|
| Claude Code | Anthropic | `Claude#cd29c5ac348a026a` | 1 072 |
| Codex | OpenAI | `Codex#b1b6016d8905655b` | 65 |
| Claude (app integration) | Anthropic | `claude[bot]#a77c9bb540d3b078` | 4 |

**Total: 1 141 commits, 4.6% of the analysed history.**

This document is itself being written by Claude Code under owner direction, and
that commit will appear under the identity above. The disclosure includes the
act of making the disclosure.

## Per-file attribution — measured

An earlier version of this document stated that per-file AI attribution across
the tree was **not established**, and reported instead that 30 of 6 178 files
carried an `AI_ASSISTED_FIRST_PARTY` declaration. That answered a different
question: how many files carry a recorded declaration, not what the tooling
touched. The share of commits (4.6%) answers a third question again, and is the
most misleading of the three, because one commit may rewrite a module while a
thousand adjust configuration.

The measurement below takes, for every tracked file, the set of author
identities across the whole history, and classifies the file by that set.

| Scope | Files | HUMAN_ONLY | AI_AND_HUMAN | AI_ONLY | AI touched |
|---|---:|---:|---:|---:|---:|
| CROWN_JEWEL | 636 | 305 | 189 | **136** | **325 (51.1%)** |
| PROTECTED_PRODUCT_UI | 65 | 34 | 28 | 3 | 31 (47.7%) |
| STANDARD | 6 066 | 4 101 | 1 358 | 534 | 1 892 (31.2%) |
| **All tracked** | **6 767** | 4 440 | 1 575 | 673 | **2 248 (33.2%)** |

Two figures matter more than the rest:

- **AI tooling appears in the history of just over half the CROWN_JEWEL files.**
- **136 CROWN_JEWEL files have no human author in Git at all** — every commit
  touching them was made under a tool identity or an automation account.

The scope classification uses the same rule as
`scripts/ip/build-ip-clean-room.mjs`, and the CROWN_JEWEL count is cross-checked
against `PROVENANCE_SUMMARY.json` at the same source SHA by
`scripts/ip/build-ai-attribution.test.mjs`. Two different counts of the same
thing would be worse than none.

Counts move with every commit. The artefact and the test regenerate; the numbers
printed above are true at the source SHA declared at the top.

## What this does and does not establish

Commit authorship shows **which agent wrote a commit**. It does not show how
much of the resulting code originated from the tool versus from human
specification, and it does not by itself establish that the output is free of
third-party material.

`AI_ONLY` therefore means *no non-automation human identity appears in that
file's commit history*. It does not mean a human was uninvolved: specification,
direction and review happen outside Git and leave no author record. The number
measures the shape of the evidence, not the shape of the authorship.

The published [`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv) classifies files by
**declared** origin, which is a different axis and remains sparse. A low
`AI_ASSISTED_FIRST_PARTY` count there reflects how few files carry a recorded
declaration, not how little the tooling touched.

## Required per-CROWN_JEWEL record — NOT YET POPULATED

The programme requires, for each CROWN_JEWEL component: `human_specification`,
`human_owner`, `AI involvement`, `reviewer`, `origin evidence`,
`final implementation status`.

None of the 636 CROWN_JEWEL files currently carry a populated record. This is an
open gap, stated as `FAIL` rather than deferred silently.

The measurement above bounds the work: 325 of those files have tool involvement
to record, and 136 of them have no human author in Git to name as reviewer from
repository evidence alone.

## Consequence for classification

Where independence or origin of critical code cannot be sufficiently
demonstrated, the programme requires **clean-room rewrite**, not a formal
first-party label applied for convenience.

No file in this repository has been relabelled first-party on the strength of AI
authorship. `UNKNOWN` remains `UNKNOWN` until evidence-backed review or
clean-room replacement resolves it.

## Model terms

Use of these tools is governed by each vendor's terms as they stood at the time
of use. Those terms are not reproduced here and are not stored in Git. The
rights holder's position on output produced with them is a legal determination
recorded in [`CHAIN_OF_TITLE_REGISTER.md`](./CHAIN_OF_TITLE_REGISTER.md) as
`HUMAN_LEGAL_ACTION_REQUIRED`.

The measurement above is what makes that determination consequential rather than
theoretical: it applies to 2 248 files, and to half the proprietary core.

## Distinct from the product's foundation model

The AI tooling described here is **development tooling** and is unrelated to the
product's own AI system.

The Gekta foundation model is Qwen, classified `THIRD_PARTY_INFRASTRUCTURE`
behind a first-party model adapter, with `QWEN_MODIFICATION = NONE`. Its
boundary is defined in
[`proprietary-core-boundary.json`](./proprietary-core-boundary.json). Qwen is
never to be presented as the rights holder's own model, and no development tool
listed above is part of the shipped product.
