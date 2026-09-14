# PC-CROP Federal Accounting — honest manual fallback

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## Purpose

Section 62 requires a real fallback when a provider or 1C route is unavailable, unsupported or not yet connected. The fallback must keep business moving **without converting manual evidence into fictional provider success**.

This slice fixes that evidence boundary in code.

Allowed artifact formats are exactly:

- XML
- PDF
- CSV
- XLSX
- canonical JSON
- evidence ZIP

Each export artifact is bound to the exact source document version and a SHA-256 payload hash. That proves what was exported; it proves nothing about delivery by itself.

## Honest status rules

The projection intentionally does no helpful inference:

- `EXPORTED` ≠ `SENT`;
- manual send/evidence ≠ `PROVIDER_CONFIRMED`;
- `CREATED_IN_1C` ≠ `POSTED`.

Each fact has its own timestamp/evidence slot. A UI can therefore say exactly what is known without promoting a weaker proof to a stronger one.

The strongest display key is selected only from facts that actually exist:

`NO_EVIDENCE → EXPORTED → SENT_EVIDENCE → MANUAL_EVIDENCE → PROVIDER_CONFIRMED`

1C evidence is kept separately: `CREATED_IN_1C` and `POSTED_IN_1C` are not aliases for provider delivery.

## Security / data minimization

This pure slice accepts document/version identifiers, format, file name, hash and evidence timestamps only. It introduces no provider credential, password, private key, database dump or broad export permission.

Actual file storage/upload authorization remains for a later storage/API slice and must respect the existing document/tenant controls.

## What remains

1. Server-authoritative export endpoint for authorized accounting document versions.
2. Storage/evidence object with retention/legal-hold rules.
3. Manual import with deterministic format/schema validation.
4. Malware/file-safety checks for uploaded evidence.
5. Audit trail: who exported/imported/attached evidence and when.
6. Task projection so the accountant sees “manual fallback required” rather than a technical integration error.
7. Reconciliation when a provider later comes back, without duplicating a business effect.

## Claims deliberately not made

- no file was actually exported or uploaded;
- no manual evidence is provider-confirmed;
- no created 1C document is assumed posted;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
