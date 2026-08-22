# Chain of Title Register

Status: **IN_PROGRESS — UNRESOLVED for every material contributor.**

Source SHA: `0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4`
History analysed: 23 235 commits, full (non-shallow) history
Machine-readable backing: [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv)
Regenerate with: `node scripts/ip/build-ip-clean-room.mjs <outDir>`

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

21 distinct identities. Commit counts sum to 23 235, matching the analysed
history exactly.

### Owner identities — consolidation required

The rights holder committed under three separate email identities. They must be
confirmed as the same legal person, otherwise 17 commits sit outside the
owner's proven identity.

| Identity | Commits | Rights status |
|---|---:|---|
| `pachaninm-lab#97bdb9e06bb3722c` | 21 780 | UNRESOLVED |
| `pachaninm-lab#f203a02abad826ee` | 13 | UNRESOLVED |
| `pachaninm-lab#e0917de297183325` | 4 | UNRESOLVED |

Owner subtotal: **21 797 commits (93.8%)**.

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
| `Claude#cd29c5ac348a026a` | 841 | UNRESOLVED |
| `Codex#b1b6016d8905655b` | 65 | UNRESOLVED |
| `claude[bot]#a77c9bb540d3b078` | 4 | UNRESOLVED |

AI subtotal: **910 commits (3.9%)**, spanning **two different vendors**.

### Unattributed local identity

| Identity | Commits | Rights status |
|---|---:|---|
| `root#ce3eaa797da1a69f` | 4 | UNRESOLVED — identity unknown |

A default local account name carrying no attribution. These 4 commits must be
traced to a known person or tool before origin can be asserted.

### Automation accounts

| Identity | Commits |
|---|---:|
| `github-actions[bot]#e7cd911927c7d1ac` | 332 |
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

Automation subtotal: **436 commits**.

An automation account is not an author. Rights in what it committed follow the
human or tool that directed it, so these commits inherit the unresolved status
of the identities above rather than forming a separate class.

**Observation:** `pc-crop-governance-bot`, `pc-crop-auth-mail-checker` and
`pc-crop-auth-mail-fix` share the email hash `785a16a1e5e89b92`. Three display
names, one mail identity. Whoever controls that mailbox controls all three.

## CROWN_JEWEL position

The IP programme requires `UNRESOLVED_RIGHTS = 0` for CROWN_JEWEL.

Current state: **605 of 605 CROWN_JEWEL files have unproven first-party
origin**, and every identity that touched them is `UNRESOLVED`. The requirement
is therefore **FAIL**, not partially met.

## HUMAN_LEGAL_ACTION_REQUIRED

Technical work cannot close these. Each needs a document the rights holder
must obtain:

1. **Assignment from the third-party individual** (`Platon#af68b1a9b3724c86`,
   88 commits) — an instrument transferring exclusive rights in the authored
   material to the rights holder. Without it, exclusive ownership of the
   platform cannot be asserted.
2. **Owner identity consolidation** — a signed confirmation that all three
   `pachaninm-lab` email identities are the same legal person.
3. **Identification of `root#ce3eaa797da1a69f`** — determine who or what
   produced these 4 commits, then place them under the correct identity.
4. **Position on AI-assisted output** — a recorded decision on how the rights
   holder treats material produced with Claude and Codex, including the terms
   in force at the time of use.

Store the resulting documents outside Git. Reference them here by identifier
and hash only, then move the corresponding rows to `RESOLVED`.
