# Data Classification and Protection Rules

**Status: approved by the owner for «Прозрачная Цена» + «ГЕКТА».**

This is the canonical source of truth for code, tests, masking and redaction, AI
minimization, Sentry and other outbound telemetry, the analytics boundary, the
secret inventory, ASVS evidence and policy documents.

The machine-readable form is [`data-classification.json`](./data-classification.json).
It is not a copy of this page — it is what the code is tested against, and a test
fails if the two disagree on the class list, on which classes are redacted
outbound, or on which classes may never appear in a query string.

## Why this exists

Before this decision the platform carried three separate, disagreeing notions of
what "sensitive" meant: eight value classes in log masking, eleven key names in
the AI assistant's context minimizer, and twenty-two secret names in the
cryptographic inventory. They disagreed because no rule existed. The rule exists
now, and the disagreement is caught by a test rather than by an audit.

## Regulatory basis (152-ФЗ)

- The production contour, where ordinary personal data of users, employees,
  counterparties and sole traders is processed, is **not below УЗ-2**.
- **Special categories and biometric personal data are out of scope.** Their
  collection, storage, processing and transfer are prohibited by default.
  Finding actual processing of them is a defect, or evidence of a separate
  isolated contour. If they are ever introduced deliberately, the level is not
  below УЗ-1 until a separate decision.
- **Business contacts published by the subject themselves** are permitted only
  in an isolated public-only contour, where minimal УЗ-4 handling applies.
- **Anonymised and aggregated data** that cannot identify a natural person
  directly or indirectly is not personal data.

This decision is a management decision about classification. It is **not**
authority to migrate or re-encrypt production data, to widen processing to
special or biometric personal data, or to weaken any security control.

## Canonical classes

| Class | What it is | Personal data |
|---|---|:---:|
| `C0_PUBLIC_NON_PD` | Public content, public pages, anonymised aggregates | — |
| `C1_INTERNAL_NON_PD` | Technical statuses, internal reference data, service metadata | — |
| `C2_BUSINESS_CONFIDENTIAL` | Non-public deal terms, prices, contract parameters, internal decisions, dispute material, legal-entity bank details with no link to a person | — |
| `C3_PD_BASIC` | Name, work email, phone, job title, organisation, role | ✔ |
| `C4_PD_ACCOUNT` | Sign-in identifier, email and phone confirmation, auth events, MFA enrollment metadata, session ownership, device linkage | ✔ |
| `C5_PD_IDENTITY` | Passport data, INN of a natural person, SNILS, driving licence | ✔ |
| `C6_PD_FINANCIAL` | Bank details and accounts of a natural person or sole trader, payment identifiers, billing records tied to a person | ✔ |
| `C7_PD_OPERATIONAL` | Routes and logistics tied to a driver, geolocation, staff and driver information, documents and metadata containing personal data | ✔ |
| `C8_PD_SPECIAL` | Special categories — **prohibited in the current scope** | ✔ |
| `C9_PD_BIOMETRIC` | Biometric data — **prohibited in the current scope** | ✔ |
| `C10_AUTH_SECRET` | Passwords and hashes, TOTP seeds, backup and recovery codes, session and refresh tokens, cookies, user API tokens | — |
| `C11_CRYPTO_SECRET` | Encryption keys, KEK and DEK, signing keys, Vault secrets, application secrets, service credentials, private keys | — |

## Handling rules

**C10 and C11** — never logged, never sent to analytics, never sent to Sentry or
breadcrumbs, never sent to an external AI contour, never carried in a query
string, and never re-displayed after a first one-time display where such a
display is permitted at all.

**C5, C6, C7, C8, C9** — never in session replay, never in external analytics,
redacted in logs, in outbound telemetry, and in breadcrumbs and error payloads;
no leakage through URL, query, headers, form values or document previews.

**C3 and C4** — permitted for the product's operational work, but redacted in
outbound telemetry and in every external channel where they are not required,
and never in session replay on private or authenticated pages.

**Analytics boundary** — analytics and session replay are permitted only on
public-only pages. Private, account, admin, deal, document, payment, MFA and
registration-sensitive surfaces are excluded fail-closed.

**Financial rule** — legal-entity bank and settlement data with no link to a
natural person is `C2_BUSINESS_CONFIDENTIAL`. The same data linked to a natural
person or sole trader is `C6_PD_FINANCIAL`.

## Extending the schema

A new data type must be mapped explicitly to one of `C0`–`C11`, or introduced as
a new canonical class with evidence and tests. More detailed internal
sub-categories are allowed; `C0`–`C11` remain mandatory as the top level of
correspondence. **No downstream control may drop a canonical class because its
own terminology differs** — a test asserts this per class and per outbound
surface.

## What this decision does not yet specify

Recorded rather than assumed, and each remains an owner decision. These lines are quoted verbatim from `data-classification.json`; a test fails if the two ever differ.

- Per-class retention periods are not specified by this decision.
- Database-level encryption requirements per class are not specified by this decision.
- Integrity-verification requirements per class are not specified by this decision.
- Per-class outbound rules for C2_BUSINESS_CONFIDENTIAL are not specified; it currently inherits protection from the analytics boundary only.
- The necessity carve-out for C3/C4 in outbound channels is not defined per field. User agent is currently redacted under the literal rule; relaxing it for diagnostics would be an owner decision.

These are why ASVS V14.1.2 is not yet fully satisfied — see the decision
register for the precise reading.
