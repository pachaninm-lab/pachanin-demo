# AP-13B.3c human model legal review runbook

## Boundary

This procedure records a human legal decision for the exact Qwen and Mistral revisions accepted by source-acquisition evidence. Automation validates the decision but never creates, changes or infers it.

A valid `APPROVED` record authorizes only the next controlled conversion stage. A valid `REJECTED` record blocks conversion. Neither outcome is a benchmark, model admission or production-readiness decision. `production_operational_status` remains `NOT_ATTESTED`.

Tracking issue: #2877. Parent: #2835. Program: #2726.

## Accepted source evidence

Use only:

- authority: `model-legal-review-authority.v1.json`;
- source acceptance: `model-source-acquisition-acceptance.v1.json`;
- Qwen exact revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`;
- Mistral exact revision `c170c708c41dac9275d15a8fff4eca08d52bab71`;
- exact Apache-2.0 text SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.

Do not review a mutable branch, tag, community GGUF or substituted license text.

## 1. Validate the authority

```bash
cd apps/tai
python -m tai.model_legal_review_cli validate-authority \
  model-artifacts/model-legal-review-authority.v1.json \
  model-artifacts/model-source-acquisition-acceptance.v1.json \
  --output /tmp/tai-legal-authority-validation.json
```

The command must return exit `0`, status `VALID`, an `authority_sha256` and an `intended_use_sha256`. Copy those exact digests into the attestation envelope. Do not edit them.

## 2. Inspect the exact evidence

For the selected model, inspect:

- exact model identity and 40-character revision;
- exact model card and its SHA-256;
- exact Apache-2.0 text and its SHA-256;
- accepted source manifest and source-files digests;
- intended use in the authority;
- conditions or restrictions relevant to commercial local inference, conversion, quantization, storage and operation on controlled infrastructure.

The source metadata saying `apache-2.0` is not itself the human decision.

## 3. Create the human review record

Create exactly one of the authority-declared paths:

- `model-artifacts/legal-reviews/qwen3-8b.review-record.v1.json`;
- `model-artifacts/legal-reviews/mistral-7b-instruct-v0.3.review-record.v1.json`.

The file must conform to `model-legal-review-record.schema.v1.json`:

```json
{
  "schema_version": "tai.model-legal-review-record.v1",
  "decision": "APPROVED",
  "reviewer_type": "HUMAN",
  "reviewer_id": "legal:stable-human-identifier",
  "reviewer_name": "Full reviewer name",
  "reviewed_at": "2030-01-01T12:00:00+03:00",
  "license_spdx": "Apache-2.0",
  "decision_basis": "Human-authored basis covering the exact revision and intended use.",
  "conditions": [],
  "record_type": "SIGNED_RECORD",
  "attestation_reference": "storage://legal/review/versionId=immutable-version",
  "license_text_sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
}
```

Use decision `REJECTED` when required. Do not use `PENDING` inside a completed record; absence of both files is the pending state.

Allowed reviewer ID namespaces are fixed by the authority: `github:`, `employee:`, `contractor:` or `legal:`. Bot/service identities are rejected.

For `ATTRIBUTED_RECORD`, the immutable reference must bind a human-authored record in issue #2877 and include a SHA-256 marker. For `SIGNED_RECORD`, use a versioned or digest-bound signed-document locator.

## 4. Create the attestation envelope

Create the matching authority-declared attestation path. The file must conform to `model-legal-review-attestation.schema.v1.json` and bind:

- the legal authority SHA-256;
- exact model, revision and role;
- accepted-main SHA `7439ed17c94b173da1bb0c37e0d74ffdfb848d49`;
- accepted source-evidence Git blob `9d5390d2592c707a1ce995ce15cccf8df58c6a70`;
- model-card, license, legal-packet, source-manifest and source-files SHA-256 values from the authority;
- intended-use SHA-256;
- exact review-record relative path, byte size and SHA-256;
- the same decision, reviewer ID, review timestamp and immutable attestation reference as the review record.

No field is optional. Unknown or duplicate JSON keys are rejected.

## 5. Verify locally

```bash
python -m tai.model_legal_review_cli verify-model \
  model-artifacts/model-legal-review-authority.v1.json \
  model-artifacts/model-source-acquisition-acceptance.v1.json \
  . \
  '<EXACT_MODEL_ID>' \
  '<EXACT_REVISION>' \
  --output /tmp/tai-model-legal-review.json
```

Expected outcomes:

- `APPROVED_FOR_CONVERSION`, exit `0`: valid human approval; conversion may be proposed separately;
- `REJECTED`, exit `0`: valid human rejection; conversion is blocked;
- `PENDING_HUMAN_DECISION`, exit `2`: no completed pair exists;
- `INVALID`, exit `2`: malformed, incomplete, automated, stale or mismatched evidence.

Evaluate both models:

```bash
python -m tai.model_legal_review_cli evaluate-all \
  model-artifacts/model-legal-review-authority.v1.json \
  model-artifacts/model-source-acquisition-acceptance.v1.json \
  . \
  --output /tmp/tai-model-legal-review-all.json
```

## 6. Publish a decision PR

A decision PR may add one model pair at a time. It must contain both the review record and its attestation envelope. The dedicated legal-review workflow verifies all present pairs and emits a small evaluation artifact.

Do not include model weights, tokenizer files, license credentials, private signing keys, GGUF files or conversion outputs. The human decision must be separately reviewed and accepted in exact-main before any conversion workflow is enabled.
