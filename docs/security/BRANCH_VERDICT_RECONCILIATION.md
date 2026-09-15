# What the outstanding branches would do to the ASVS register

The register on `main` is not the sum of the work. Assessments live on branches
that have not merged, so a requirement can read FAIL on `main` while a branch
already closes it — and, less obviously, a branch can still carry an older
reading that would take an earned verdict away.

Regenerate this picture with:

```
RECONCILE_MARKER='<commit trailer>' node scripts/security/report-branch-verdicts.mjs
```

It reports only what each branch's **own commits** changed, measured against
that branch's merge-base. A branch cut before a requirement was assessed carries
no opinion about it; a branch cut after carries `main`'s. Counting the file's
contents rather than the branch's diff credits a branch for work it did not do —
which is exactly the mistake that produced the first version of this note.

## Three groups

**1. Already closed, waiting to merge — 32 requirements.** `main` counts these
against the programme while a branch resolves them. The headline FAIL count on
`main` therefore overstates what is actually outstanding.

**2. Spent leftovers — 13 branches, 38 verdicts.** Every one of the early
`sec/asvs-v*` chapter branches would revert a PASS on `main` back to the FAIL it
recorded at the time. That is not a stricter re-reading: their work reached
`main` already, and `main` improved afterwards through the fix branches. For
nine of the thirteen, every non-register file they touch is byte-identical to
`main` today. Four — `v2-business-logic`, `v5-file-handling`, `v7-sessions`,
`v9-tokens` — still differ in one to three files and need a per-file read before
being written off.

Merging one of these now would silently undo later work. They should be closed
or rebuilt, not merged.

**3. Two genuine disagreements.** `security/prototype-safe-aggregation`
(PR #5102) assesses two requirements differently from the later evidence. Both
of its notes are careful; both reach a conclusion a later measurement
contradicts, and in each case the specific fact it missed is identifiable.

| Requirement | That branch | Later verdict | The fact that decides it |
| --- | --- | --- | --- |
| V3.7.3 | NOT_APPLICABLE — "the application never sends the user outside", zero matches for an absolute external address | FAIL→PASS on `security/asvs-v373-outbound-navigation-notice-4459` | The scan looked for absolute addresses **written as literals**. The assistant's citation links are runtime values, and `ai-assistant-stream.contract.ts` requires every `citation.uri` to match `^https?://`. `GektaSourceList` and `AiAssistantPanel` render them. Destinations are external; the scan could not see them. |
| V3.5.4 | PASS — two hostnames, a 308 redirect in `middleware.ts`, no cookie `Domain` attribute | NOT_ASSESSED on `security/asvs-v375-browser-capability-gate-4459` | All of that enforcement sits inside `if (controlHostEnabled())` at `middleware.ts:399`, which reads `PC_CONTROL_HOST_ENABLED`. Unset, `requiresCanonicalControlHost` returns false and there is no separation. Whether it is set is a deployed fact, not a repository one. |

Neither is offered as "newer therefore right". In both cases the earlier note is
sound about what it measured, and the later one measured something the first
could not see.

## Why this matters for the count

Reporting `main`'s figure alone overstates what is left. Reporting the branch
figure alone claims credit for work nobody can review. The honest statement is
both numbers and the gap between them, which is what the report prints.
