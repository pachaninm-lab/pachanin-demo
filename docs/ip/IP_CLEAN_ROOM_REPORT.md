# IP Clean Room Report

Report baseline date: 2026-08-21  
Repository: `pachaninm-lab/pachanin-demo`

## Executive status

This repository is treated as proprietary application software that incorporates
third-party open-source dependencies. The source code must not be represented as
"100% written without open source"; the defensible claim is that the original
application/domain implementation is proprietary while identified third-party
components retain their own licenses.

### Controls established by this change

- proprietary `LICENSE` and `NOTICE`;
- explicit software/IP and contribution policies;
- no-publish metadata for internal npm workspace packages;
- CODEOWNERS and a machine-readable proprietary-core boundary;
- full-history provenance generation (`file → origin commit → author → license/header → status`);
- CycloneDX + SPDX SBOM generation for pnpm/Node and Python/TAI;
- normalized transitive license map with blocked/review classifications;
- current/history scan for copyright/SPDX/license markers and vendor/generated paths;
- public GitHub code-match screening for high-value proprietary-core source.

## Baseline findings before the evidence run

1. The GitHub repository was `public` at the start of this hardening work.
2. The root, API, web, `domain-core`, design-system and design-token packages were
   already marked `private`; `packages/integration-sdk` was the identified
   internal npm package missing the no-publish flag.
3. No `SPDX-License-Identifier` or generic `Copyright` header was returned by the
   repository code index search at the baseline revision. This is a useful
   screening result, not a substitute for the full-history workflow.
4. A pre-existing SBOM workflow generated CycloneDX only for `apps/api` and
   `apps/web`; it did not cover SPDX, the full workspace, TAI/Python, normalized
   license classification or provenance.
5. Historical public visibility must remain disclosed in any investor/buyer IP
   due-diligence package. Making the repository private is prospective access
   control, not retroactive erasure of public copies.

## Canonical generated evidence

The `IP Clean Room & Full SBOM` workflow uploads one immutable artifact bundle per
run containing:

- `file-provenance.csv`
- `authors.csv`
- `current-header-candidates.csv`
- `history-header-candidates.txt`
- `history-vendor-candidates.csv`
- `license-map.csv`
- `license-summary.json`
- Node/pnpm CycloneDX and SPDX SBOMs
- Python/TAI CycloneDX and SPDX SBOMs
- `public-code-match-candidates.json`
- `clean-room-summary.json`

The generated `file-provenance.csv` is the requested per-file clean-room table.
It is kept as a CI artifact rather than committed on every change so that the
report stays tied to an exact immutable commit and does not create large noisy
diffs.

## Interpretation rules

- `PROPRIETARY_NO_EXTERNAL_HEADER`: no external license/copyright marker was
  detected in the current file header; contractual chain-of-title still must be
  confirmed separately.
- `REVIEW_EXTERNAL_LICENSE_HEADER`: a license/copyright marker requires review.
- `REVIEW_VENDOR_OR_GENERATED`: path/history indicates possible vendored,
  external or generated material.
- `POLICY_OR_METADATA`: repository policy/build metadata, not proprietary
  business logic.

A clean automated result is evidence, not a legal opinion. Exclusive-rights
ownership still requires employment/contractor assignment evidence for every
material contributor.
