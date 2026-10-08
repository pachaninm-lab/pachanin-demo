# AI-Assisted Provenance

Status: **IN_PROGRESS — AI involvement disclosed, per-file attribution incomplete.**

Source SHA: `0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4`
History analysed: 23 235 commits, full (non-shallow) history
Machine-readable backing: [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv), [`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv)

The IP programme requires that the use of AI tooling is disclosed rather than
hidden. This document discloses it.

## Disclosure

AI tooling from **two different vendors** authored commits in this repository.

| Tool | Vendor | Identity | Commits |
|---|---|---|---:|
| Claude Code | Anthropic | `Claude#cd29c5ac348a026a` | 841 |
| Codex | OpenAI | `Codex#b1b6016d8905655b` | 65 |
| Claude (app integration) | Anthropic | `claude[bot]#a77c9bb540d3b078` | 4 |

**Total: 910 commits, 3.9% of the analysed history.**

This document is itself being written by Claude Code under owner direction, and
that commit will appear under the identity above. The disclosure includes the
act of making the disclosure.

## What this does and does not establish

Commit authorship shows **which agent wrote a commit**. It does not show how
much of the resulting code originated from the tool versus from human
specification, and it does not by itself establish that the output is free of
third-party material.

The published [`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv) is a snapshot of
`a81317071f58a2b67b5a9c04271c0fd0437e052c` and classifies **28 of its 6 175
files** as `AI_ASSISTED_FIRST_PARTY`, on the basis of explicit declaration.

Regenerated at this document's source SHA
(`0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4`, 6 178 files) the counts are **30
`AI_ASSISTED_FIRST_PARTY` and 6 147 `UNKNOWN`**. The difference is exactly the
three files added by the register slice itself; the published snapshot cannot
describe files created after it was generated.

A low `AI_ASSISTED_FIRST_PARTY` count is not a claim that AI touched only those
files. It reflects how few files carry a recorded origin declaration. Per-file
AI attribution across the tree is **not yet established**.

## Required per-CROWN_JEWEL record — NOT YET POPULATED

The programme requires, for each CROWN_JEWEL component: `human_specification`,
`human_owner`, `AI involvement`, `reviewer`, `origin evidence`,
`final implementation status`.

None of the 605 CROWN_JEWEL files currently carry a populated record. This is
an open gap, stated as `FAIL` rather than deferred silently.

## Consequence for classification

Where independence or origin of critical code cannot be sufficiently
demonstrated, the programme requires **clean-room rewrite**, not a formal
first-party label applied for convenience.

No file in this repository has been relabelled first-party on the strength of
AI authorship. `UNKNOWN` remains `UNKNOWN` until evidence-backed review or
clean-room replacement resolves it.

## Model terms

Use of these tools is governed by each vendor's terms as they stood at the time
of use. Those terms are not reproduced here and are not stored in Git. The
rights holder's position on output produced with them is a legal determination
recorded in [`CHAIN_OF_TITLE_REGISTER.md`](./CHAIN_OF_TITLE_REGISTER.md) as
`HUMAN_LEGAL_ACTION_REQUIRED`.

## Distinct from the product's foundation model

The AI tooling described here is **development tooling** and is unrelated to
the product's own AI system.

The Gekta foundation model is Qwen, classified `THIRD_PARTY_INFRASTRUCTURE`
behind a first-party model adapter, with `QWEN_MODIFICATION = NONE`. Its
boundary is defined in
[`proprietary-core-boundary.json`](./proprietary-core-boundary.json). Qwen is
never to be presented as the rights holder's own model, and no development tool
listed above is part of the shipped product.
