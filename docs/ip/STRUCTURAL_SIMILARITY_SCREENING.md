# Structural similarity screening

The token screening in `docs/ip/DEPENDENCY_SIMILARITY_SCREENING.md` publishes a
blind spot it measured on itself: a verbatim 1 838-line copy of `pydantic/main.py`
with every non-keyword identifier renamed was **not detected by any of its three
methods**. Its normalisation replaces strings, numbers, comments and whitespace —
it does not replace identifiers, and the winnowing fingerprint is computed over
tokens that include them. Renaming is also the cheapest laundering there is: one
editor command.

That gap is the whole reason this second screening exists. It compares **shape**
instead of text.

## Method

Every file is parsed and reduced to the **pre-order sequence of its syntax node
kinds**, and nothing else. Identifiers, strings, numbers, comments and formatting
are gone by construction — the walk reads `node.kind`, never the name it carries.
A renamed copy therefore produces the identical sequence.

- TypeScript, TSX and JavaScript are parsed with the workspace's own TypeScript
  compiler (5.9.3).
- Python is parsed with `ast`. The interpreter is chosen by trying the newest
  first and keeping the one that parses the whole protected core, because
  `apps/tai` declares `requires-python >= 3.12` and Python 3.11 rejects two of its
  files as syntax errors rather than reading them. This run used **Python 3.13.12**.
- Python node ids are offset past the whole TypeScript `SyntaxKind` enum, so a
  cross-language match cannot occur even by accident.
- **A file that cannot be parsed is reported, never skipped.** Silently dropping
  unparseable files is how a screening reports a clean result for files it never
  looked at — the failure this programme has already made once, and corrected.

```
IP_SIMILARITY_CORPUS=<corpus> node scripts/ip/build-structural-similarity-evidence.mjs <out>
```

## What was compared

| | |
|---|---|
| Protected files with a parser (`.ts`, `.tsx`, `.js`, `.py`) | **660** |
| Fingerprinted | **660** — none failed to parse |
| Comparable (shape ≥ 200 nodes) | **532** |
| Below the size floor | **128** |
| Corpus files comparable | **10 350** |
| Corpus files that failed to parse | 1 |

`.sql` and `.css` are absent because this tool has no parser for them; they remain
the unscreened 28 named in the token record.

## Result

**No structural finding. Zero.**

Neither an identical shape nor a shape similarity above 0.75 anywhere among
532 × 10 350 comparisons.

### The threshold is not tuned, and here is the proof

A reporting threshold is worth nothing unless the scores it cleared are published
beside it. The highest shape similarity reached by **any** protected file against
**any** of the 10 350 third-party files is:

| | |
|---|---|
| Highest score among all real protected files | **0.0667** (`apps/web/components/gekta/GektaProductShell.tsx`) |
| Median top score | **0.0039** |
| Files with any shape overlap at all | 361 of 532 |
| Reporting threshold | 0.75 |
| A renamed verbatim copy | **1.0** |
| A renamed copy with 7 of 38 top-level statements removed and new code added | **0.93** |

Between 0.067 and 0.93 there is nothing. The threshold could be moved anywhere in
that range without changing a single result, which is what makes it a threshold
rather than a tuning knob.

## Falsification

| Planted in the protected core | Detected as |
|---|---|
| `pydantic/main.py` (1 838 lines) with every non-keyword identifier renamed | `IDENTICAL_SHAPE` 1.000 |
| `zod/src/v3/types.ts` (5 138 lines) with all 8 813 identifiers renamed | `IDENTICAL_SHAPE` 1.000 |
| The renamed Python copy, 7 of 38 top-level statements deleted, a new class and function added | `SHAPE_JACCARD` 0.933 |

The first two are exactly the copies the token screening let through. Both are
caught here at 1.0, on the same corpus and settings that report the core clean.
The planted files were removed and the tree restored.

An earlier attempt at the TypeScript probe produced invalid TypeScript, and the
run reported it as `PROTECTED_FILES_NOT_PARSED:1` rather than scoring it — the
no-silent-skip rule catching a real case on its first outing.

## The whole repository, not only the core

The run above covers `docs/ip/proprietary-core-boundary.json`: 660 files with a
parser. The repository tracks **3 082** files in languages this tool can parse.
Screening only the boundary and reporting "the code is original" is the same
coverage overstatement this programme already made once, with Python.

`IP_STRUCTURAL_SCOPE=all-tracked` screens all of them.

| | core | whole repository |
|---|---:|---:|
| Files with a parser | 660 | **3 082** |
| Failed to parse | 0 | **0** |
| Comparable (≥ 200 nodes) | 532 | **2 310** |
| Findings | 0 | **4** |
| Distinct files in those findings | — | **1** |

The four findings are one file — `apps/web/public/mockServiceWorker.js` — matching
msw's own service worker at `IDENTICAL_SHAPE` 1.0 across four package
resolutions. That is the file the repository-wide token screening independently
identified as msw 2.13.2, MIT, placed there by `npx msw init public/`. Two
methods that share no code arrived at the same single answer, and it is the only
third-party file either of them finds.

### The calibration is weaker here, and that is the useful part

Outside the core the highest score a first-party file reaches is **0.391**, not
0.067. Eight files clear 0.2. Every one of them is explainable, and the
explanations are the same two shapes:

| Score | File | Matches |
|---:|---|---|
| 0.391 | `apps/web/lib/platform-v7/lexicon.ts` | happy-dom's CSS property config |
| 0.290 | `apps/web/i18n/staff-control-center-messages.ts` | the same |
| 0.257 | `apps/web/components/platform-v7/PublicRoleIntelligenceSummary.tsx` | the same |
| 0.211 | `apps/web/components/platform-v7/visual/index.ts` | `rxjs/src/operators/index.ts` |

A message dictionary and a CSS property table are both one large nested object
literal, so they have the same shape for a reason that has nothing to do with
either of them. Two barrels of re-exports likewise. This is the convergence the
methodology note predicts, seen rather than assumed — and it is why the threshold
is worth more now than it was at 0.067: the empty band it sits in is 0.39 to
0.93, measured against real structural coincidence rather than against nothing.

Median top score across 2 309 first-party comparable files: **0.0041**.

## What this does not close

**Fragments.** Similarity is Jaccard over the whole file, so a small piece lifted
from a large one scores low. Measured, not supposed: the renamed `pydantic/main.py`
cut down to 853 of its 6 879 nodes scores **0.096** — below the threshold, and
correctly so, because at that point the file is 12% of what it was. Both
screenings detect whole-file derivatives. Neither detects a copied function inside
an otherwise original file.

**Files below the floor.** 128 protected files have fewer than 200 shape nodes and
are not compared. A shape that small is shared by every codebase; reporting on it
would produce noise, not evidence.

**Structure that is genuinely convergent.** A shape match is evidence of
structure, not proof of copying. Two independent implementations of the same small
pattern can share a shape — which is why a match is a finding for review and never
a verdict. Nothing reached that point in this run.

**Anything about a corpus we do not have.** Like the token screening, this run
covers our own dependencies only.

**Anything about authorship.** Originality and chain of title remain separate
claims with separate evidence. `docs/ip/CHAIN_OF_TITLE_REGISTER.md` is unchanged
by this run.

## Read together

| Question | Answer | Evidence |
|---|---|---|
| Is any core file a copy of a dependency? | No, for 660 of 688 files | token screening |
| Is any core file a **reformatted** copy? | No | token screening, `NORMALIZED_TOKENS` |
| Is any core file a **renamed** copy? | No, for 532 of them | this run, `IDENTICAL_SHAPE` |
| Is any core file a renamed **partial** derivative? | No, above 0.75 similarity | this run, `SHAPE_JACCARD` |
| Did we write it? | **Not answered here** | chain of title — four owner documents outstanding |
