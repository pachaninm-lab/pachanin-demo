# Proprietary Core Boundary

The protected core is defined machine-readably in
`docs/ip/proprietary-core-boundary.json`.

This boundary protects the concrete implementation of the platform's domain,
settlement, ledger, deal/contract execution, risk/compliance, accounting and
financial workflow logic. It does **not** claim exclusive rights in generic
concepts such as state machines, double-entry accounting, REST, RBAC, KYC or
other public techniques and standards.

At the current revision, pricing logic is distributed through `domain-core`,
`settlement-engine` and `accounting`; there is no standalone server `pricing`
module. Likewise, contract rules are distributed through domain/deal/settlement
logic rather than a standalone `contract-rules` module. The boundary therefore
follows the real code instead of inventing directories that do not exist.

## Controls

- Protected paths are listed in `.github/CODEOWNERS`.
- Internal packages are `private` and `UNLICENSED`.
- CI checks the no-publish rule.
- Full-history provenance and license/header candidates are generated from
  `git log --all` and current tracked files.
- CycloneDX and SPDX SBOMs cover Node/pnpm and the Python TAI service.
- Similarity screening is offline-only against an explicitly approved, locally
  mounted corpus. Exact, normalized-token and winnowing candidates require
  human/legal review and are not treated as infringement findings automatically.

Qwen weights, tokenizer and license remain outside this boundary as immutable,
replaceable `THIRD_PARTY_INFRASTRUCTURE`. The proprietary boundary covers our
Gekta orchestration, retrieval, context, memory, tools, safety/business policy,
agricultural logic and product UI—not the Qwen foundation model.

## Separate-repository extraction

No extraction helper or external history-rewrite tool is approved by this
baseline. A future two-repository architecture requires a separate authorized
scope, dependency/security review of the exact migration tool, authenticated
private-target transport proof, access-control verification, dry-run evidence
and an application build/import contract before any history is copied or
production imports are changed.
