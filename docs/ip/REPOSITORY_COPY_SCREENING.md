# Repository-wide copy screening

Both earlier screenings look only inside `docs/ip/proprietary-core-boundary.json`:
688 files, of which 660 have a parser. The repository tracks **4 747** files in
the same languages. The other ~4 000 — the application shell, the web routes, the
scripts, the ML service, the migrations — had **never been compared against
anything**, while `docs/ip/CHAIN_OF_TITLE_REGISTER.md` carries all 6 175 of them
as files with an origin.

That asymmetry runs in the wrong direction. Third-party code pasted into a file
nobody calls a crown jewel is exactly as much of a rights problem, and rather more
likely — nobody reviews the shell.

```
IP_SIMILARITY_CORPUS=<corpus> node scripts/ip/build-repository-copy-screening.mjs <out>
```

## Method, and why it is narrower

This screening asks only the decisive question — *is this file a copy* — by
comparing three digests, with no pairwise comparison at all:

| Digest | Survives |
|---|---|
| exact SHA-256 of the bytes | nothing; it is the baseline |
| SHA-256 of the normalized text | comment removal, reindenting, reflowing, renamed strings, changed numbers |
| SHA-256 of the token sequence | all of the above **and** respacing |

The third exists because the second does not reach as far as it reads.
Normalisation collapses runs of whitespace rather than removing them, so
`a * 1.05` and `a*1.05` produce different normalized digests. That was found by a
unit test written on the wrong premise; the test was kept for the right one, and
both limits are now pinned by it.

All three are O(files), so the whole repository against the whole corpus costs one
pass — five seconds. What this does **not** find is a partial derivative. The
protected core gets that from the winnowing and shape screenings. The rest of the
repository does not, and this record does not pretend otherwise.

## What was screened

| | |
|---|---|
| Tracked entries | 6 829 |
| Screened (comparable language, regular file) | **4 747** |
| Previously screened by any run | 688 |
| Corpus files | 25 478 |
| Findings | 1 641 |
| **Findings of substance** | **5**, across **2 files** |

1 636 of the findings are on 21 structurally empty files — empty `__init__.py`,
`next-env.d.ts`, barrels of re-exports. Structural emptiness is measured (every
word outside `export/from/import/as/default` and outside a string or number
placeholder), not judged.

## The two files

### `apps/web/public/mockServiceWorker.js` — third-party code in our tree

349 lines, normalized-identical to `msw@2.13.2`'s own `mockServiceWorker.js`. This
is expected: `msw` requires its service worker to be copied into the public
directory, and `npx msw init public/` is how it gets there. The licence is MIT.

What matters is not that it is there, but what the register says about it:

| | |
|---|---|
| `origin_class` | `UNKNOWN` |
| `origin_source` | `REPOSITORY_HISTORY_ONLY` |
| `rights_basis` | `CHAIN_OF_TITLE_REQUIRED` |
| `status` | `UNRESOLVED` |

The register treats it as a file of unproven origin awaiting chain of title, when
its origin is now **proven by measurement**: it is a copy of an MIT-licensed
dependency, placed there by that dependency's own installer.

**This record does not change that classification, and the change was deliberately
not made.** `classify()` in `scripts/ip/build-ip-clean-room.mjs` decides origin by
path patterns; adding a pattern for this file would turn a measurement into a
hard-coded assertion, which is precisely the fabricated PASS the register exists to
prevent. How tool-vendored files are declared is an owner decision about the
register's schema, not a regex. The measurement is on the record and the register
is unchanged.

### `apps/api/prisma/schema.prisma` — our code inside a dependency

The reverse direction, and the answer to it. `@prisma/client@5.22.0` contains
`.prisma/client/schema.prisma`, which is normalized-identical to **our** schema.
Prisma's generator copies the schema into the generated client; it is our file
travelling outward, not a third-party file travelling in.

**Our code reaches a third-party directory in exactly one place, by a generator,
and nowhere else.** The screening compared 4 747 of our files against 25 478 of
theirs and found no other crossing in either direction.

## Two things the enumeration found that a copy screening is not looking for

### One tracked symlink is absolute

Of 14 tracked symlinks, 13 are relative. One is not:

```
apps/web/apps/web/web -> /home/user/pachanin-demo/apps/web
```

A committed absolute path to one machine's layout. On any checkout not at that
exact path it is a dangling link, and where it does resolve it points at its own
grandparent, so `apps/web/apps/web/web/apps/web/apps/web/…` descends without
bound — verified, not supposed. Nothing in the repository references it: the eight
relative siblings are the documented test mirror (`AUDIT_maturity-runtime_2026-07-03.md`),
and the test that used to depend on them now resolves from the `.git` directory
and says so in its own comment.

It is reported here rather than removed, because removal belongs in a change whose
evidence is the web test suite passing, not in a screening tool's branch.

### Four groups of byte-identical files inside our own tree

| Group |
|---|
| `apps/landing/postcss.config.js` = `apps/web/postcss.config.js` |
| `apps/ml/routers/__init__.py` = `apps/ml/training/__init__.py` (both empty) |
| `apps/web/app/api/commercial/expansion/route.full.ts` = `…/route.ts` |
| Five identical `loading.tsx` under `apps/web/app/platform-v7/{arbitrator,compliance,lab,support,surveyor}` |

Not a rights question. It matters because the register counts every path as a file
with an origin, so a duplicated file is counted twice and reads as twice the
first-party work. `route.full.ts` in particular looks like a leftover.

## What this establishes

**Establishes:** of 4 747 tracked files in comparable languages, exactly one is a
copy of a third-party dependency, it is a tool-installed MIT service worker, and
it is identified. No other file in the repository — inside the protected core or
outside it — is a whole-file copy of anything we depend on, however reformatted.

**Does not establish:** anything about partial derivatives outside the protected
core; anything about a corpus beyond our own dependencies; and nothing whatsoever
about authorship, which remains four owner documents away.
