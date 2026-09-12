# Dependency similarity screening

The originality half of the IP programme had never produced a number. Its
screening tool was written and correct, and it had never run against anything:
status `CORPUS_REQUIRED`, blocker `APPROVED_OFFLINE_EXTERNAL_CORPUS_NOT_PROVIDED`.
A comparison against nothing answers nothing, so "is the protected core original"
stood unmeasured — which is not the same as unfavourable, and was being read as
though it were.

One corpus needs no approval to obtain and no network to fetch: the dependencies
this repository already has on disk. That is also the likeliest way third-party
code reaches a first-party module by accident — somebody pastes a helper out of a
library instead of calling it.

```
node scripts/ip/build-dependency-corpus.mjs <corpus>
IP_SIMILARITY_CORPUS=<corpus> node scripts/ip/build-offline-similarity-evidence.mjs <out>
```

`apps/tai` declares its Python dependencies in `pyproject.toml` rather than
installing them into the tree, so on a machine where they are absent they are
fetched into a target directory and passed in:

```
pip install --target <target> fastapi           # the one dependency apps/tai declares
IP_CORPUS_PYTHON_ROOTS=<target> node scripts/ip/build-dependency-corpus.mjs <corpus>
```

## Correction to the first published run

The first version of this record screened against an npm-only corpus and reported
**688 files clean**. 151 of those 688 files are Python, and the npm store holds
**one** `.py` file in total. Those 151 files had been compared against an
effectively empty set and reported clean.

That is the exact failure this corpus exists to prevent: a tool pointed at a
structurally unsuitable corpus returns a clean result over an empty set, and the
result looks like proof. It was caught by the run's own numbers — the composition
of the corpus against the composition of the core — not by anybody reviewing the
conclusion.

What was overstated was **coverage, not the verdict**. The two files the first run
reported are still the only non-Python files with findings, and both still measure
zero characters of code. The record below replaces it.

## What was compared

| | |
|---|---|
| Protected first-party files | **688** |
| npm packages linked | **1 146** |
| Python roots linked | **6** (whatever `python3` reports as `sys.path` and its site directories, plus the declared `apps/tai` closure) |
| Regular files linked | **75 778** (4 non-regular entries dropped) |
| Corpus files after the tool's own filter | **25 478** |
| Corpus aggregate digest | `360ca182428c88bef3a4b312589a7a0bf3518ee417933da2525d527d8d91e041` |
| Method | exact SHA-256, normalized-token SHA-256, winnowing signatures |

Normalisation strips comments, replaces every string and number with a
placeholder and collapses whitespace before tokenising, so a copy survives
reformatting, renamed strings and changed literals and is still matched.

### Coverage is not uniform, and the gaps are named

| Language | Protected files | Corpus files | Screened? |
|---|---:|---:|---|
| `.ts` | 456 | 7 919 | yes |
| `.py` | 151 | 2 393 | yes |
| `.tsx` | 53 | 10 | yes — see below |
| `.sql` | 24 | **0** | **no** |
| `.css` | 4 | 26 | **no** |

Comparison is cross-extension: every protected file is compared against every
corpus file whatever its extension. The 10 `.tsx` files understate what the 53
TSX components were screened against — **1 061** corpus files in `.js`, `.ts` and
`.mjs` import `react`, call `React.createElement` or use a JSX runtime, across 57
React-family packages. That is a real corpus.

SQL is different. The corpus contains **no SQL at all**, and SQL is not
token-comparable to JavaScript or Python, so the 24 migrations under
`apps/tai/tai/migrations` were compared against nothing. Four stylesheets against
26 is likewise too thin to call a screening. **28 of the 688 files are not covered
by this run and are not claimed to be.**

## Result

**87 findings, affecting exactly 3 of the 688 files, and none is a finding of
substance.**

| File | Lines | Measured | Value |
|---|---:|---|---:|
| `packages/domain-core/src/execution-simulation/index.ts` | 7 | characters of code after removing re-export lines and comments | **0** |
| `packages/integration-sdk/src/index.ts` | 45 | characters of code after removing re-export lines and comments | **0** |
| `apps/tai/tai/__init__.py` | 1 | executable statements in the module body, per `ast.parse` | **0** |

Measured, not judged. The first two are re-export barrels: normalisation turns
them into `export * from <STRING>;` repeated, identical to every other barrel file
in existence, which is why they match the table-of-contents files of zod, NestJS
and `@angular-devkit`. The third is a single module docstring — it normalises to
three `<STRING>` placeholders and therefore matches every docstring-only
`__init__.py` in the Python corpus — nine of them, in `pip`, `wsgiref`, `lib2to3`,
`xml.parsers` and `fasteners`. There is nothing in any of the three to copy.

No exact match, and no normalized-token match, on any file carrying logic.

## Why this result is trustworthy, and where it stops

A screening run that finds nothing is worthless unless it can be shown to find
something. Copies were planted inside the protected core and the screening re-run,
on the same corpus and settings that report the core clean.

| Stage | Planted | Detected as |
|---|---|---|
| 1 | Verbatim `zod/src/v3/types.ts` (5 138 lines) | `EXACT_SHA256` |
| 1 | Verbatim `pydantic/main.py` (1 838 lines) | `EXACT_SHA256` |
| 2 | The same TypeScript file, comments stripped | `NORMALIZED_TOKENS` |
| 2 | The same Python file, comments stripped | `NORMALIZED_TOKENS` |
| 3 | The same two files, every non-keyword identifier renamed | **not detected** |

Stage 3 is a negative result and is published as one. Normalisation replaces
strings, numbers, comments and whitespace — it does not replace identifiers, and
the winnowing fingerprint is computed over tokens that include them. A verbatim
1 838-line copy with its identifiers renamed passes this screening cleanly.
**"No findings" here means "no copy that survives reformatting", not "nothing was
copied".** Closing that gap needs structural comparison (AST shape rather than
token text), which this tool does not do.

The planted files were removed and the tree restored; the working tree is clean.

## What this does and does not establish

**Establishes:** none of the 660 screened files is copied from a dependency of
this repository, and none is a comment-stripped or reformatted derivative of one.

**Does not establish:** anything about the 28 unscreened `.sql` and `.css` files;
anything about a corpus outside our own dependencies — other grain or
commodity-trading platforms, off-the-shelf ERP modules and contractor-supplied
code were not in it; and anything about a copy whose identifiers were renamed.
Naming external corpus sources is an owner decision; the tooling is ready for them.

**Says nothing about authorship.** Originality and chain of title are separate
claims proven by separate evidence. `docs/ip/CHAIN_OF_TITLE_REGISTER.md` records
605 of 605 CROWN_JEWEL files with unproven first-party origin and four documents
the rights holder must obtain. Nothing here moves that.
