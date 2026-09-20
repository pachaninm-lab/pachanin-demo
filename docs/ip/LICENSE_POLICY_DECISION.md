# Dependency licence policy — decision required

Status: **PREPARED — 29 components await one owner policy decision. No component
of unknown licence remains.**

Source: [`license-map.csv`](../../artifacts/ip-clean-room/license-map.csv),
[`registry-license-evidence.json`](./registry-license-evidence.json)
Regenerate with:
```
node scripts/ip/build-license-map.mjs artifacts/ip-clean-room/sbom artifacts/ip-clean-room \
  docs/ip/third-party-license-overrides.json docs/ip/registry-license-evidence.json
```

## What changed

Of 1 193 components, 57 previously carried no resolvable licence. They were not
obscure: they are platform-specific prebuilt binaries for operating systems and
architectures this machine does not install, so the build could not read a local
manifest, and the tooling correctly refused to guess from package names.

Their licences were read instead from the registry-published manifest for the
exact version, recorded with the registry URL and the published dist integrity so
the claim can be re-checked. That refusal to guess was worth keeping: **21 of the
57 turned out to carry copyleft terms**, which a name-based guess would have
recorded as permissive.

| Classification | Before | After |
|---|---:|---:|
| `PERMISSIVE_OR_APPROVED` | 1 124 | 1 160 |
| `PERMISSIVE_OR_APPROVED_DUAL_LICENSE` | 4 | 4 |
| `LEGAL_REVIEW` | 8 | 29 |
| `UNKNOWN_REVIEW` | **57** | **0** |

`UNKNOWN_DEPENDENCY_LICENSES` is now zero. What remains is a decision, not a gap.

## What needs deciding

29 components, four upstream projects, **none of them in the product runtime**:

| Scope | Count |
|---|---:|
| `RUNTIME_OR_REQUIRED` | **0** |
| `DEV` | 3 |
| `OPTIONAL` | 26 |

### 1. libvips native binaries — LGPL-3.0-or-later (14 components)

`@img/sharp-libvips-*` and the Windows/wasm `@img/sharp-*` builds. These are the
native image-processing library behind `sharp`, shipped as prebuilt binaries for
platforms other than this one.

LGPL permits use of an unmodified library without imposing its terms on the
calling program, provided the library is replaceable and its licence and source
availability are conveyed. The binaries are consumed as published, unmodified,
through `sharp`'s public interface.

**Recommendation: APPROVE for use, unmodified, with attribution.** Record that no
modification is made and that the licence text and upstream source location are
conveyed in third-party notices.

### 2. lightningcss — MPL-2.0 (12 components)

A CSS build tool and its platform binaries. `DEV` and `OPTIONAL` only; it runs at
build time and no part of it is linked into the shipped application.

MPL-2.0 is file-level copyleft: obligations attach to modified MPL files, not to
separate works that merely use the tool. No MPL file is modified.

**Recommendation: APPROVE, build-time use, unmodified.**

### 3. axe-core and @axe-core/playwright — MPL-2.0 (2 components)

Accessibility testing libraries. `DEV` only; used by the test suite, never shipped.

**Recommendation: APPROVE, test-time use, unmodified.**

### 4. caniuse-lite — CC-BY-4.0 (1 component)

Browser-support data consumed by the build toolchain. CC-BY-4.0 requires
attribution; it is a data set, not code linked into the product.

**Recommendation: APPROVE with attribution in third-party notices.**

## Why this is not decided here

Each of the four is a standard, well-understood case, and the exposure is limited
by the fact that none of them is a runtime dependency. But approving a copyleft
licence for use in a commercial product is the rights holder's decision, not the
tooling's. Recording it as approved without that decision would be exactly the
substitution of documentation for a result that this programme is meant to
prevent.

So the analysis is prepared and the decision is left open.

## How to record the decision

On approval, add one entry per component to
[`third-party-license-overrides.json`](./third-party-license-overrides.json) with
`classification` set to `PERMISSIVE_OR_APPROVED` and `evidenceUrl` pointing at the
recorded decision, then regenerate. The mechanism already exists and carries four
reviewed overrides today.

Do not mark them approved before the decision exists. The remaining
`UNRESOLVED_DEPENDENCY_LICENSE_REVIEWS: 29` is an honest blocker, and an honest
blocker is more useful than a cleared one that nobody decided.

## Limits

This is a classification of declared licences, not a licence audit. It records
what each package declares for the exact version the build resolves. It does not
verify that package contents match the declaration, does not analyse patent or
trademark terms, and is not legal advice.
