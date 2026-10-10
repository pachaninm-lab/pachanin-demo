# Proprietary Software & Copyright Policy

Effective: 2026-08-21

## 1. Default rule

All original source code, schemas, business rules, tests, documentation, design
assets and other original material in this repository are **proprietary / all
rights reserved** unless a file is expressly identified as third-party material
or is governed by a separate written license.

The repository is not to be described as open source merely because it uses
open-source dependencies. Third-party components retain their own licenses; the
repository does not attempt to relicense them.

## 2. Package publication

Internal application and workspace packages must have both:

- `"private": true`
- `"license": "UNLICENSED"`

Publication is forbidden unless the package is explicitly approved through a
separate IP/legal review and removed from the no-publish guard by an authorized
change.

## 3. Third-party intake

Every new dependency or copied third-party artifact must have a traceable source,
version (or immutable commit), license and purpose. Runtime dependencies with
AGPL/GPL/SSPL or other strong/copyleft or source-available obligations require
explicit legal approval before introduction. Unknown/custom licenses require
review; they are not silently treated as permissive.

No contributor may remove, suppress or rewrite a third-party copyright or
license notice in order to make third-party material appear internally authored.

## 4. Source provenance

For each tracked file, the IP evidence workflow records the earliest observed
commit/author in repository history, rename lineage, detected license/copyright
headers and review status. Git authorship is provenance evidence only: it is not
by itself proof of an employment invention assignment or transfer of exclusive
rights. Contracts/assignments must be retained outside Git and mapped during due
diligence.

## 5. AI-assisted code

AI-assisted contributions are allowed only when the contributor has the right to
submit the resulting material and does not knowingly request or paste protected
third-party source code. Generated code must pass the same provenance, license,
security and review controls as human-authored code. AI generation never changes
the license of third-party material embedded in an output.

## 6. Proprietary core

High-value server-side business logic is defined by
`docs/ip/proprietary-core-boundary.json` and receives CODEOWNERS review plus
no-publication controls. The boundary is a governance/security control and does
not claim ownership of generic techniques, standards or third-party components.

## 7. Evidence formats

The canonical IP evidence workflow produces:

- CycloneDX SBOM(s), including transitive dependencies;
- SPDX SBOM(s);
- normalized third-party license map;
- current and historical copyright/license-header candidates;
- current and historical vendor/generated-path candidates;
- commit-author inventory;
- per-file clean-room provenance CSV and JSON;
- offline-only exact, normalized-token and winnowing similarity evidence for the protected core.

An SBOM identifies components and licenses; it does not establish ownership of
original application code. Similarity scanning must use an approved corpus
mounted into a controlled runner. Proprietary source or source phrases must not
be sent to public scanners or SaaS. The clean-room report and contractual rights
evidence serve the separate ownership purpose.

## 8. Rights-holder identity

Git repository ownership or a Git author name is not sufficient evidence of the
legal owner of exclusive rights. Before an investment, software registration,
license transaction or sale, the legal rights-holder name and the chain of title
(employment clauses, contractor assignments and other transfers) must be
confirmed and retained in the transaction data room.

## 9. Historical public exposure

Changing a repository from public to private stops ordinary future public access
but cannot erase copies or forks made while the repository was public. Historical
public exposure therefore must be recorded as an IP-risk fact; it does not, by
itself, convert unlicensed original code into open-source software.
