# Local Qwen policy-repair admission

## Purpose

The Local Qwen independent-review provider rejects findings whose reason still contains speculative hedge language after generation. A policy-inadmissible candidate is not accepted as review evidence.

## Bounded repair rule

The provider may ask the same pinned model to repair a policy-inadmissible candidate no more than the trusted workflow `MAX_POLICY_REPAIRS` bound. Each repair reuses the exact same review chunk and unchanged trusted system policy, explicitly requires a concrete reproducible mechanism, and forbids the configured speculative hedge words in the finding reason.

If any repair becomes policy-admissible, that response continues through the existing canonical validator. If every bounded attempt remains policy-inadmissible, the provider fails closed with `POLICY_REPAIR_INVALID_*`. No failed candidate is converted to PASS and no finding is silently dropped.

## Repair evidence provenance

Every repaired chunk records the ordered SHA-256 chain for each rejected candidate and each corresponding repair prompt, together with the one-based successful repair-attempt number. The successful attempt must equal the evidence-chain length, the candidate and prompt chains must have identical positive length no greater than `MAX_POLICY_REPAIRS`, and every entry must be a lowercase SHA-256 digest. A chunk that required no repair must carry empty chains and no success-attempt value.

The runner distinguishes repaired items from repair attempts: `QWEN3_POLICY_REPAIR_OK` counts chunks that entered repair and `QWEN3_POLICY_REPAIR_ATTEMPTS_OK` counts bounded model repair calls. The canonicalization step independently revalidates the complete repair-evidence schema and hashes against the same trusted `MAX_POLICY_REPAIRS` authority before binding it into the canonical review response.

## Self-modifying provider admission

A pull request that changes `.github/workflows/local-qwen-independent-review.yml` must not depend on the modified Local Qwen provider as its independent bootstrap authority. The repository's pinned Octopus exact-head provider is used for that self-modifying reviewer change. `verify-pr-review-gate.mjs` independently binds the Octopus attestation to the exact PR head, pinned action SHA, provider status, and matching Actions run.

After the reviewer change is merged to `main`, ordinary product pull requests return to Local Qwen exact-head review under the updated base workflow.
