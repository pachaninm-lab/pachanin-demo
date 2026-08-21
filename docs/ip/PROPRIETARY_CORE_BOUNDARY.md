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
- Public-code similarity screening is performed against GitHub for protected
  source fingerprints; candidates require human/legal review and are not treated
  as infringement findings automatically.

## Separate-repository extraction

If the organization later chooses a two-repository architecture, run the
provided `scripts/ip/export-proprietary-core.sh` only after an empty **private**
target repository has been created and access controls are verified. Extraction
is deliberately not automatic: moving production imports across repository
boundaries without a target registry/build contract would be a release risk.
