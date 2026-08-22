# Supply Chain Matrix — GitHub Actions

Status: **NOT_MET, ratcheted.** The programme requires every third-party action
pinned to an immutable commit SHA. That is not the current state, and this
document does not pretend otherwise.

Source SHA: `62c7a9ed683726e78b16d660888c7bb4dca9d644`
Enforced by: `scripts/security/verify-action-pinning.mjs`
Baseline: [`supply-chain-action-baseline.json`](./supply-chain-action-baseline.json)

## Current position

Across **323 workflow files**:

| Class | Unique | Occurrences |
|---|---:|---:|
| Pinned to commit SHA | 4 | **8** |
| Floating tag | 24 | **1028** |
| Floating branch | 0 | **0** |
| Local (`./…`) | — | 14 |

**8 of 1036 third-party references are pinned — 0.8%.**

All eight pins live in `sbom-scan.yml`. The claim of "immutable Action SHAs" in
#4443 was true for that pull request's scope and was never true of the
repository as a whole.

## Why this matters

An unpinned reference resolves at run time. Whoever controls the tag controls
what executes inside CI, and CI holds privileges the source tree does not:
repository write, registry push, and access to secrets. A compromised or
retagged action is therefore a direct path to the release pipeline.

Most-used unpinned references:

| Occurrences | Reference |
|---:|---|
| 507 | `actions/checkout@v4` |
| 174 | `actions/setup-node@v4` |
| 166 | `actions/upload-artifact@v4` |
| 47 | `pnpm/action-setup@v4` |
| 28 | `actions/github-script@v7` |
| 24 | `actions/setup-python@v5` |
| 13 | `aquasecurity/trivy-action@v0.36.0` |

## What was fixed

`aquasecurity/trivy-action@master` in `.github/workflows/security.yml` — two
occurrences — now references `@v0.36.0`.

A branch reference is the worst class: its contents can change with no change
in this repository and no signal to anyone. This one sat in the security
scanner itself. The replacement tag was already in use in
`security-quality-gate.yml` with the same parameters and passing CI, so the
change is compatible and moves that reference from "arbitrary branch" to
"fixed tag".

It is still not a SHA.

## Why the rest is not fixed

Two independent reasons, both stated plainly:

1. **Scope.** Rewriting 1028 references across 323 workflows in one change is
   the sweeping migration the programme forbids, and it could take the entire
   CI system down at once.

2. **It cannot be done honestly from here.** GitHub access in the working
   session is restricted to `pachaninm-lab/pachanin-demo`. The real commit SHAs
   for `actions/*`, `docker/*`, `github/codeql-action/*`, `aquasecurity/*`,
   `JetBrains/*` and the rest cannot be retrieved, and writing plausible-looking
   hashes would fabricate evidence. **No hash was invented.**

## The ratchet

Since the debt cannot be cleared safely today, it is prevented from growing.

`verify-action-pinning.mjs` runs in CI and fails when:

- any reference points at a floating **branch** (`@master`, `@main`, `@HEAD`) —
  always, regardless of the count; or
- the total number of floating references rises above the recorded baseline of
  **1028** — so a new workflow must pin its actions to a SHA.

When a slice genuinely reduces the count, the gate reports the slack and the
baseline is tightened with `--update-baseline`. The ceiling can fall; it cannot
rise.

Nine unit tests cover the passing case, both failure modes, `@main`/`@HEAD`
handling, SHA-pinned and local references, and a missing or malformed baseline.

## Remaining work

Clearing the debt needs an environment that can resolve upstream tags to commit
SHAs. Recommended order, smallest blast radius first:

1. `github/codeql-action/*`, `aquasecurity/trivy-action`, `gitleaks/gitleaks-action` — actions that read source and report security findings;
2. `docker/*` — actions that build and push production images;
3. `actions/checkout`, `actions/setup-*`, `actions/upload-artifact` — highest occurrence count, lowest per-use risk, best done mechanically.

Until then this control is **NOT_MET**, and no release provenance claim should
describe the build as running only pinned actions.
