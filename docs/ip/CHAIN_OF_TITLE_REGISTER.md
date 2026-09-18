# Chain of Title Register

Status: **IN_PROGRESS — rights UNRESOLVED for every identity. Identity itself is now largely resolved from repository evidence.**

Source SHA: `1e5c050f5652b5ab18ab2024e4f4d339a5ff7040`
History analysed: 24 848 commits, full (non-shallow) history
Machine-readable backing: [`CONTRIBUTORS.csv`](./CONTRIBUTORS.csv)
Regenerate the counts with: `node scripts/ip/build-ip-clean-room.mjs <outDir>`

This register records **who committed**, which is a repository fact. It does not
record **who owns exclusive rights**, which is a contractual fact that does not
exist inside Git. No entry below may be read as evidence of assignment.

## Two different questions

Earlier versions of this register ran identity and rights together. They are not
the same question and they do not close the same way:

- **Identity** — which account or machine produced a commit. This is answerable
  from the repository and from the forge, and most of it is answered below.
- **Rights** — who holds exclusive rights in the authored material. This is
  answerable only by a signed instrument, and none is referenced yet.

Resolving identity does not move a single row to `RESOLVED`. It does something
narrower and still useful: it turns open investigations into one-line questions
the rights holder can answer or sign.

## Why nothing is RESOLVED

A contributor moves to `RESOLVED` only when a signed instrument transferring or
licensing exclusive rights exists and is referenced here by identifier and hash.
No such instrument is currently referenced for any identity. Marking any row
`RESOLVED` without one would be a fabricated PASS.

Contracts and personal documents are deliberately **not** stored in Git. Only a
reference, a hash and a status belong here.

## Identity classification

21 distinct identities. Commit counts sum to 24 848, matching the analysed
history exactly.

### Owner identities — one GitHub account, evidenced

| Identity | Address | Commits | Identity status | Rights status |
|---|---|---:|---|---|
| `pachaninm-lab#97bdb9e06bb3722c` | `pachaninm@gmail.com` | 23 157 | Primary | UNRESOLVED |
| `pachaninm-lab#f203a02abad826ee` | `263435807+pachaninm-lab@users.noreply.github.com` | 13 | Same GitHub account — evidenced | UNRESOLVED |
| `pachaninm-lab#e0917de297183325` | `pachaninm-lab@users.noreply.github.com` | 4 | Same GitHub account — evidenced | UNRESOLVED |

Owner subtotal: **23 174 commits (93.3%)**.

**Evidence for the two secondary identities.** GitHub issues no-reply addresses
in two documented shapes: the legacy `<login>@users.noreply.github.com` and the
current `<numeric-id>+<login>@users.noreply.github.com`. Both secondary
addresses carry the login `pachaninm-lab`, and the numeric form carries the id
`263435807`. That id was read back live from the GitHub API on a comment in this
repository, which returned `login: pachaninm-lab`, `id: 263435807`,
`author_association: OWNER`. The 17 commits therefore come from the same GitHub
account that owns this repository.

**What that does and does not settle.** It settles the account. It does not
settle the legal person, because a forge account is not an identity document.
The open question is consequently much smaller than it was: rather than
confirming that three unexplained mailboxes are the same human, the rights
holder confirms that they hold GitHub account `pachaninm-lab` (id `263435807`).

### Third-party individual — assignment required

| Identity | Address | Commits | Rights status |
|---|---|---:|---|
| `Platon#af68b1a9b3724c86` | `platon@MacBook-Pro-Platon.local` | 88 | UNRESOLVED |

This is a natural person who is neither the owner nor an automation account,
committing from a personal machine across a three-week window in May 2026. The
work is substantial and product-facing: the platform-v7 Visual Intelligence
Layer, its rollout across role pages, an RBAC engine and an outbox pattern.

**88 commits of authored material currently have no documented transfer of
rights.** Until an assignment or work-for-hire instrument is referenced, the
platform cannot be described as wholly owned by the rights holder. **This is the
single material chain-of-title gap in the repository**, and it is the one item
here that no amount of repository evidence can close.

### AI tooling

See [`AI_ASSISTED_PROVENANCE.md`](./AI_ASSISTED_PROVENANCE.md).

| Identity | Address | Commits | Rights status |
|---|---|---:|---|
| `Claude#cd29c5ac348a026a` | `noreply@anthropic.com` | 1 072 | UNRESOLVED |
| `Codex#b1b6016d8905655b` | `codex@openai.local` | 65 | UNRESOLVED |
| `claude[bot]#a77c9bb540d3b078` | `209825114+claude[bot]@users.noreply.github.com` | 4 | UNRESOLVED |

AI subtotal: **1 141 commits (4.6%)**, spanning **two different vendors**.

### Server-side operational identity

| Identity | Address | Commits | Identity status | Rights status |
|---|---|---:|---|---|
| `root#ce3eaa797da1a69f` | `root@cv7660557.novalocal` | 4 | Traced to a cloud host — owner confirmation needed | UNRESOLVED |

**What the four commits are.** One regenerates a lockfile after a PostCSS bump;
three are bare CI triggers (`ci: trigger exact-head acceptance` and two
variants, one naming PR #3684). None introduces authored product material. Their
content is operational, which is consistent with an operator working on a
server rather than an unidentified author.

**What the address shows.** `.novalocal` is the internal DNS suffix OpenStack
assigns to instances, so `cv7660557` is a cloud VM rather than a workstation.

**What is deliberately not claimed.** The hostname `cv7660557` appears nowhere
in this repository, so the repository cannot corroborate whose machine it is.
Calling it the production host would be an inference presented as a fact. The
remaining question is one line: does the rights holder operate host
`cv7660557`? If yes, these four commits fold into the owner identity above.

### Automation accounts

| Identity | Address | Commits |
|---|---|---:|
| `github-actions[bot]#e7cd911927c7d1ac` | `41898282+github-actions[bot]@users.noreply.github.com` | 337 |
| `platform-v7-agent#267eb41e0cd8769b` | `platform-v7-agent@users.noreply.github.com` | 50 |
| `platform-v7-ops#9333822632522fe1` | `platform-v7-ops@users.noreply.github.com` | 16 |
| `p7-state#3f46d14b3a05c9e1` | `p7-state@users.noreply.github.com` | 15 |
| `pc-crop-governed-bot#46894a3de9aa7129` | `pc-crop-governed-bot@users.noreply.github.com` | 7 |
| `pc-crop-governance-bot#785a16a1e5e89b92` | `actions@users.noreply.github.com` | 3 |
| `public-entry-watch#150c5ec0bc5e2a90` | `public-entry-watch@users.noreply.github.com` | 3 |
| `dependabot[bot]#bd5a8d6c673b738d` | `49699333+dependabot[bot]@users.noreply.github.com` | 3 |
| `p7-authority-bot#a442423719e2da8b` | `p7-authority-bot@users.noreply.github.com` | 2 |
| `pc-crop-authority[bot]#5ef736f7b7cbf835` | `pc-crop-authority[bot]@users.noreply.github.com` | 2 |
| `pc-crop-auth-mail-checker#785a16a1e5e89b92` | `actions@users.noreply.github.com` | 1 |
| `pc-crop-auth-mail-fix#785a16a1e5e89b92` | `actions@users.noreply.github.com` | 1 |
| `platform-v7-industrial-bot#2a63107e6760d2a0` | `platform-v7-industrial-bot@users.noreply.github.com` | 1 |

Automation subtotal: **441 commits**.

An automation account is not an author. Rights in what it committed follow the
human or tool that directed it, so these commits inherit the unresolved status
of the identities above rather than forming a separate class.

**Correction to an earlier observation.** A previous version of this register
noted that `pc-crop-governance-bot`, `pc-crop-auth-mail-checker` and
`pc-crop-auth-mail-fix` share the mail hash `785a16a1e5e89b92`, and concluded
that whoever controls that mailbox controls all three. The shared address is
`actions@users.noreply.github.com` — the default committer GitHub Actions uses
when a workflow commits without configuring an identity. It is not a mailbox
anybody controls, and the three display names are three workflows, not three
delegations of authority. The hash collision is expected, not a finding.

## CROWN_JEWEL position

The IP programme requires `UNRESOLVED_RIGHTS = 0` for CROWN_JEWEL.

Current state at the source SHA above: **636 of 636 CROWN_JEWEL files have
unproven first-party origin**, and every identity that touched them is
`UNRESOLVED`. The requirement is therefore **FAIL**, not partially met.

## HUMAN_LEGAL_ACTION_REQUIRED

Technical work cannot close these. Each needs a document the rights holder must
obtain or sign.

1. **Assignment from the third-party individual** (`Platon#af68b1a9b3724c86`,
   88 commits) — an instrument transferring exclusive rights in the authored
   material to the rights holder. Without it, exclusive ownership of the
   platform cannot be asserted. **Unchanged and unavoidable.**
2. **Owner identity confirmation** — a signed confirmation that the rights
   holder holds GitHub account `pachaninm-lab` (id `263435807`). The repository
   evidence above already ties all three `pachaninm-lab` identities to that one
   account, so this is a single confirmation rather than a three-way
   reconciliation.
3. **Confirmation of host `cv7660557`** — a statement that this cloud instance
   is the rights holder's infrastructure. The four commits are already traced to
   operational activity with no authored product material; only ownership of the
   host is open.
4. **Position on AI-assisted output** — a recorded decision on how the rights
   holder treats material produced with Claude and Codex, including the terms in
   force at the time of use. 1 141 commits, two vendors.

Store the resulting documents outside Git. Reference them here by identifier and
hash only, then move the corresponding rows to `RESOLVED`.
