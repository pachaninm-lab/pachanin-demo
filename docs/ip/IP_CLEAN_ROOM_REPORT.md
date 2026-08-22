# IP Clean-Room Baseline Report

Baseline authority: owner issue [#4459](https://github.com/pachaninm-lab/pachanin-demo/issues/4459)

Baseline date: 2026-08-21

Repository: `pachaninm-lab/pachanin-demo`

## Executive status

**BLOCKED — baseline controls exist; final proprietary-clean status is not proven.**

The defensible current statement is limited: the repository contains original
application work plus third-party infrastructure/dependencies, and a technical
program now records the origin, license, similarity and chain-of-title evidence
needed to separate them. No absence-of-match, Git author record, proprietary
license file, SBOM or repository visibility setting alone proves exclusive
ownership or uniqueness.

The repository was public at the baseline. `HISTORICAL_SOURCE_DISCLOSURE = TRUE`.
Future private access control cannot erase copies or rights lawfully acquired
before the cutover.

## Controls established in the baseline slice

- proprietary license/notice and contribution/open-source policies;
- internal npm package no-publish validation with complete root/apps/packages discovery;
- explicit final-blocking register for metadata that the current scope cannot edit;
- CODEOWNERS plus a machine-readable proprietary/crown-jewel boundary;
- full-history inventory for tracked, deleted, renamed, vendored, archived,
  generated-candidate, symlink, submodule, branch and tag evidence;
- conservative file provenance with every required field and explicit `UNKNOWN`;
- contributor identifiers with hashed emails; contracts remain outside Git;
- exact Node/pnpm and Python/TAI CycloneDX + SPDX SBOM sets;
- normalized transitive dependency-license map;
- internal-component status only from an exact SBOM `SrcFile` match to a local
  private manifest with matching name/version; package-name prefixes alone are
  never first-party evidence;
- offline-only exact/normalized/winnowing similarity tooling;
- baseline and bounded strict verification modes: baseline may expose blockers,
  while strict mode fails until every blocker represented by this slice is
  resolved. Strict-mode success is not the full-program legal/security finish.

## Canonical exact-SHA workflow evidence

The `Canonical SBOM Generation & IP Clean Room` workflow uploads an exact-commit bundle
containing at least:

- `REPOSITORY_INVENTORY.json`;
- `FILE_PROVENANCE.csv` and `FILE_PROVENANCE.json`;
- `CONTRIBUTORS.csv`;
- current/history license-header candidates;
- historical vendor, deleted-file and rename registers;
- `PROVENANCE_SUMMARY.json`;
- `license-map.csv` and `license-summary.json`;
- Node/pnpm CycloneDX and SPDX SBOMs;
- Python/TAI CycloneDX and SPDX SBOMs;
- hash-only offline similarity fingerprints, `SIMILARITY_FINDINGS.csv` and summary.

The full per-file outputs are exact-SHA artifacts rather than tracked generated
files. Committing a file that records its own blob SHA creates a self-reference
and immediately makes the snapshot stale. Repository policy and schemas are
tracked; immutable evidence is attached to the exact workflow revision.

## Similarity boundary

No source text or distinctive source phrase is sent to GitHub code search, a
public scanner or other SaaS. Final similarity status requires an explicitly
approved, non-empty external corpus mounted locally into the controlled runner.
Approval must be a regular JSON evidence file with authority, rights basis,
scope, date and the exact aggregate corpus digest. Without that corpus and
matching approval evidence the result remains blocked, not a false PASS.
The path is supplied through `IP_SIMILARITY_CORPUS_APPROVAL`; the JSON contract
requires `schemaVersion: 1`, `status: APPROVED`, `approvedAt`,
`authorityReference`, `rightsBasis`, `scope` and `corpusDigestSha256`.

Similarity hits are review candidates, not automatic proof of copying. No hit
is screening evidence, not absolute proof of originality.

## Known final blockers at baseline

- most historical files have repository provenance but not adjudicated origin,
  rights basis, AI involvement or material contributors;
- contractual chain of title is not stored in Git and remains human/legal work;
- the approved offline external similarity corpus has not yet been supplied;
- historical public exposure remains true;
- repository visibility is still public;
- Qwen model/tokenizer hash and license evidence must be verified independently;
- full dependency, asset, dataset, RAG, secret-history, ASVS, tenant, abuse,
  backup/restore and release-provenance acceptance remains outside this slice.

Until those items are closed, the final formulation from issue #4459 is forbidden.
