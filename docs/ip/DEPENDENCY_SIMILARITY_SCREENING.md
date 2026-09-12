# Dependency similarity screening

The originality half of the IP programme had never produced a number. Its
screening tool was written and correct, and it had never run against anything:
status `CORPUS_REQUIRED`, blocker `APPROVED_OFFLINE_EXTERNAL_CORPUS_NOT_PROVIDED`.
A comparison against nothing answers nothing, so "is the protected core original"
stood unmeasured — which is not the same as unfavourable, and was being read as
though it were.

One corpus needs no approval to obtain and no network to fetch: the packages this
repository already depends on. That is also the likeliest way third-party code
reaches a first-party module by accident — somebody pastes a helper out of a
library instead of calling it.

Rebuild the corpus with `node scripts/ip/build-dependency-corpus.mjs <out>` and
screen with `IP_SIMILARITY_CORPUS=<out> node scripts/ip/build-offline-similarity-evidence.mjs <out2>`.

## What was compared

| | |
|---|---|
| Protected first-party files | **688** |
| Third-party packages linked | **1146** |
| Corpus files after filtering | **23 084** |
| Corpus aggregate digest | `9c93ed98c38efa77faa0ba026400022e6cc755fad8f2e4d0bab68f4fa97e5bea` |
| Method | exact SHA-256, normalized-token SHA-256, winnowing signatures |

Normalisation strips comments, replaces every string and number with a
placeholder and collapses whitespace before tokenising, so a copy survives
reformatting, renamed strings and changed literals and is still matched.

## Result

**78 findings, affecting exactly 2 of the 688 files, and neither is a finding of
substance.**

Both are re-export barrels:

- `packages/domain-core/src/execution-simulation/index.ts` — 7 lines
- `packages/integration-sdk/src/index.ts` — 45 lines

Measured, not judged: after removing `export * from …` lines and comments, **both
files contain zero characters of code**. Normalisation turns them into
`export * from <STRING>;` repeated, which is identical to every other barrel file
in existence — they match the table-of-contents files of zod, NestJS and
@angular-devkit for that reason and no other. There is nothing in them to copy.

No exact match, and no normalized-token match on any file carrying logic.

## Why this result is trustworthy

A screening run that finds nothing is worthless unless it can be shown to find
something. Two files were planted inside the protected core and the screening
re-run:

| Planted | Detected as |
|---|---|
| Verbatim copy of `zod/src/v3/types.ts` (5 138 lines) | `EXACT_SHA256` |
| The same file with comments stripped | `NORMALIZED_TOKENS` |

Both were caught, on the same corpus and the same settings that report the core
clean. The planted files were then removed and the tree restored.

## What this does and does not establish

**Establishes:** no file in the protected core is copied from a package this
repository depends on.

**Does not establish:** that nothing was copied from anywhere else. Other grain
or commodity-trading platforms, off-the-shelf ERP modules and contractor-supplied
code were not in this corpus and are not addressed by this run. Naming those
sources is an owner decision; the tooling is ready for them.

**Says nothing about authorship.** Originality and chain of title are separate
claims proven by separate evidence. `docs/ip/CHAIN_OF_TITLE_REGISTER.md` records
605 of 605 CROWN_JEWEL files with unproven first-party origin and four documents
the rights holder must obtain. Nothing here moves that.
