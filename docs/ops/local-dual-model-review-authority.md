# Dual local independent review authority

## Objective

Keep exact-head pull-request admission fail-closed without making a third-party review SaaS, its quota, or its billing state part of the release critical path.

## Providers

- Local Qwen: canonical `Qwen/Qwen3-8B`, revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`, Q4_K_M SHA-256 `107afd988cdbdcced3b8e76ebc3a8e83b5a18a5c796fca20778410cb9c47a814`.
- Local Mistral: `mistralai/Mistral-7B-Instruct-v0.3`, revision `c170c708c41dac9275d15a8fff4eca08d52bab71`, Q4_K_M SHA-256 `62f36c339b80c8849814f8a0fd4b04f94c7a758658f71d6aa86478e633d5764e`.
- Both use the pinned llama.cpp `b9637` / source commit `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3` and the same trusted semantic-review policy.

## Authority matrix

| PR scope | Local Qwen | Local Mistral |
| --- | --- | --- |
| Ordinary product/infrastructure change | Allowed | Allowed |
| Changes Local Qwen workflow | Forbidden | Allowed |
| Changes Local Mistral workflow | Allowed | Forbidden |
| Changes both local provider workflows | Forbidden | Forbidden |

A provider is never independent from a change to its own review workflow. The exact-head verifier enforces this from the live PR changed-path set; a self-provider PASS status cannot override the exclusion.

If both provider workflows change in one PR, neither local provider is sufficient. The PR must use another already-accepted independent authority or be split so each provider is changed under the other provider's authority.

## Mistral runtime contract

The Mistral workflow does not alter the product inference route. It validates the existing governed Q4_K_M artifact by exact byte size and SHA-256, resolves the pinned llama-server runtime, then starts an ephemeral loopback-only server for the review run.

The server uses a generated per-run API key, one parallel inference slot, bounded context, deterministic generation and strict JSON-schema output. The process is terminated at the end of the job. No model download, conversion, package installation, service restart, production route change or customer-data access is part of the review path.

## Evidence contract

A clean Local Mistral authority requires all of the following to agree on the same exact head:

1. exact PR head SHA and bounded full diff;
2. SHA-256-bound chunk manifest and prompt bundle;
3. exact Mistral source revision, Q4_K_M artifact SHA-256 and llama.cpp identity;
4. trusted review-policy SHA-256;
5. canonical response SHA-256 with zero findings;
6. structured GitHub review attestation;
7. latest `review-provider/local-mistral` success status;
8. immutable successful Actions run matching repository, PR number, exact head, workflow name and workflow path.

Any mismatch, missing evidence, model failure, malformed output, stale head or exhausted repair budget fails closed.

## External providers

Octopus, Codex and GitHub Copilot may remain optional additional review sources. They are not required for the dual local model design and must not be relied on to recover from a local provider's own workflow change when the other local provider is valid.

This authority introduces no recurring SaaS requirement and no production hosting change.
