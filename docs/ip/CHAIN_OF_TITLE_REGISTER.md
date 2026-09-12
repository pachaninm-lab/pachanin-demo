# Chain of Title Register

Status: **IN_PROGRESS — UNRESOLVED for every material contributor.**

Source SHA: `fd895e061f0e27661a6e67f436f03108e35e5dd9`
History analysed: 26 211 commits, full (non-shallow) history
Machine-readable backing: [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv)
Regenerate with: `node scripts/ip/build-ip-clean-room.mjs <outDir>`
Currency is enforced: `node scripts/ip/verify-provenance-currency.mjs` fails when
the committed record, this page's own numbers included, no longer matches a fresh
build. It had drifted by 2 976 commits and 654 files before that gate existed.

This register records **who committed**, which is a repository fact. It does not
record **who owns exclusive rights**, which is a contractual fact that does not
exist inside Git. No entry below may be read as evidence of assignment.

## Why nothing is RESOLVED

A contributor moves to `RESOLVED` only when a signed instrument transferring or
licensing exclusive rights exists and is referenced here by identifier and hash.
No such instrument is currently referenced for any identity. Marking any row
`RESOLVED` without one would be a fabricated PASS.

Contracts and personal documents are deliberately **not** stored in Git. Only a
reference, a hash and a status belong here.

## Identity classification

21 distinct identities. Commit counts sum to 26 211, matching the analysed
history exactly.

### Owner identities — consolidation required

The rights holder committed under three separate email identities. They must be
confirmed as the same legal person, otherwise 17 commits sit outside the
owner's proven identity.

| Identity | Commits | Rights status |
|---|---:|---|
| `pachaninm-lab#97bdb9e06bb3722c` | 24 429 | UNRESOLVED |
| `pachaninm-lab#f203a02abad826ee` | 13 | UNRESOLVED |
| `pachaninm-lab#e0917de297183325` | 4 | UNRESOLVED |

Owner subtotal: **24 446 commits (93.3%)**.

### Third-party individual — assignment required

| Identity | Commits | Rights status |
|---|---:|---|
| `Platon#af68b1a9b3724c86` | 88 | UNRESOLVED |

This is a natural person who is neither the owner nor an automation account,
and who contributed across a three-week window in 2026. **88 commits of
authored material currently have no documented transfer of rights.** Until an
assignment or work-for-hire instrument is referenced, the platform cannot be
described as wholly owned by the rights holder. This is the single most
material chain-of-title gap in the repository.

### AI tooling

See [`AI_ASSISTED_PROVENANCE.md`](./AI_ASSISTED_PROVENANCE.md).

| Identity | Commits | Rights status |
|---|---:|---|
| `Claude#cd29c5ac348a026a` | 1 162 | UNRESOLVED |
| `Codex#b1b6016d8905655b` | 65 | UNRESOLVED |
| `claude[bot]#a77c9bb540d3b078` | 4 | UNRESOLVED |

AI subtotal: **1 231 commits (4.7%)**, spanning **two different vendors**.

### Unattributed local identity

| Identity | Commits | Rights status |
|---|---:|---|
| `root#ce3eaa797da1a69f` | 4 | UNRESOLVED — identity unknown |

A default local account name carrying no attribution. These 4 commits must be
traced to a known person or tool before origin can be asserted.

### Automation accounts

| Identity | Commits |
|---|---:|
| `github-actions[bot]#e7cd911927c7d1ac` | 338 |
| `platform-v7-agent#267eb41e0cd8769b` | 50 |
| `platform-v7-ops#9333822632522fe1` | 16 |
| `p7-state#3f46d14b3a05c9e1` | 15 |
| `pc-crop-governed-bot#46894a3de9aa7129` | 7 |
| `dependabot[bot]#bd5a8d6c673b738d` | 3 |
| `pc-crop-governance-bot#785a16a1e5e89b92` | 3 |
| `public-entry-watch#150c5ec0bc5e2a90` | 3 |
| `p7-authority-bot#a442423719e2da8b` | 2 |
| `pc-crop-authority[bot]#5ef736f7b7cbf835` | 2 |
| `pc-crop-auth-mail-checker#785a16a1e5e89b92` | 1 |
| `pc-crop-auth-mail-fix#785a16a1e5e89b92` | 1 |
| `platform-v7-industrial-bot#2a63107e6760d2a0` | 1 |

Automation subtotal: **442 commits**.

An automation account is not an author. Rights in what it committed follow the
human or tool that directed it, so these commits inherit the unresolved status
of the identities above rather than forming a separate class.

**Observation:** `pc-crop-governance-bot`, `pc-crop-auth-mail-checker` and
`pc-crop-auth-mail-fix` share the email hash `785a16a1e5e89b92`. Three display
names, one mail identity. Whoever controls that mailbox controls all three.

## CROWN_JEWEL position

The IP programme requires `UNRESOLVED_RIGHTS = 0` for CROWN_JEWEL.

Current state: **636 of 636 CROWN_JEWEL files have unproven first-party
origin**, and every identity that touched them is `UNRESOLVED`. The requirement
is therefore **FAIL**, not partially met.

## Files introduced by a merge

21 files, four of them CROWN_JEWEL in the auth module, had **no recorded origin
at all** — not an unresolved one, an absent one. They entered the mainline
through squash merges, and `git log` does not diff a merge commit unless it is
told to, so a path that first appears in one matched nothing and fell through to
`UNKNOWN`. The register reported them as unknowable when git knew exactly when
they arrived and who merged them.

The lookup is now merge-aware and those rows carry `MERGE_INTRODUCED=<sha>` in
`origin_source`. That marker is not decoration: attribution to a merge says **when
the file entered the mainline and who put it there**, not who typed it, which for
a squashed branch no longer exists in this history. All 21 resolve to
`pachaninm-lab#97bdb9e06bb3722c`.

`original_contributor = UNKNOWN` is now **0 files**, down from 21. Every file in
the repository has an identity attached to it, which is what makes the list below
complete.

## HUMAN_LEGAL_ACTION_REQUIRED

Technical work cannot close these. Each needs a document the rights holder must
obtain. What each one unblocks is measured against
[`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv), not estimated:

| # | Document | Files it unblocks | CROWN_JEWEL it unblocks |
|---|---|---:|---:|
| 2 | **Owner identity consolidation** — a signed confirmation that all three `pachaninm-lab` email identities are the same legal person | **6 093** | **501** |
| 4 | **Position on AI-assisted output** — a recorded decision on how the rights holder treats material produced with Claude and Codex, including the terms in force at the time of use | **2 249** | **326** |
| 1 | **Assignment from the third-party individual** (`Platon#af68b1a9b3724c86`, 88 commits) — an instrument transferring exclusive rights in the authored material | **293** | **26** |
| 3 | **Identification of `root#ce3eaa797da1a69f`** — determine who or what produced these 4 commits, then place them under the correct identity | **2** | **0** |

The counts overlap, because most files were touched by more than one identity.
The disjoint view — how many files need *exactly* which set — is what says whether
a single signature is worth anything on its own:

| Documents required | Files | CROWN_JEWEL |
|---|---:|---:|
| 2 alone | 4 388 | 302 |
| 2 and 4 | 1 433 | 180 |
| 4 alone | 655 | 126 |
| 1, 2 and 4 | 154 | 18 |
| 1 and 2 | 116 | 1 |
| none — automation only | 58 | 2 |
| 1 alone | 18 | 5 |
| 1 and 4 | 5 | 2 |
| 2, 3 and 4 | 2 | 0 |

Three things follow, and none of them is obvious from the commit counts alone:

1. **Document 2 is the largest by a wide margin and the cheapest to obtain** — it
   is the rights holder writing a confirmation about themselves. It unblocks 501
   of the 636 crown jewels; 302 of them need nothing else.
2. **Document 3 is worth 2 files and no crown jewels.** It is still required for a
   complete record, but it blocks nothing and should not hold up the other three.
3. **The four documents together are sufficient.** After all four, zero files and
   zero crown jewels remain unresolvable. Before the merge-aware lookup above, 21
   files — 4 of them crown jewels — could not have been closed by any signature at
   all, because they had no identity to attach one to.

Store the resulting documents outside Git. Reference them here by identifier and
hash only, then move the corresponding rows to `RESOLVED`.
