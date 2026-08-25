# PC-CROP Federal Accounting — 1C extension outbound transport source

Date: 2026-08-25
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: `feat/one-c-durable-runtime-4321` / `1e84e2650870e00e42ae44ff3e1df3126a938f61`
Operational status: `SOURCE_ONLY / NOT_ATTESTED`

## Why this slice exists

The server-side protocol and machine-credential contracts are not enough for the master requirement “real 1C synchronizes without our team visiting the customer”. A real client-side source boundary is needed too.

This slice introduces source modules intended for a 1C extension. They use the platform's standard outbound HTTP/HTTPS and JSON mechanisms; no inbound publication of the customer's information base is required.

## Security direction

The reference source is intentionally narrower than a generic integration client:

- one compile-time pinned production host;
- port 443 only;
- TLS server certificate verification through the OS trust store;
- a path is accepted only when it is exactly `/connector/v1` or a slash-delimited child of it;
- absolute URL, traversal and backslash are refused;
- unsafe job ids are refused before path interpolation;
- correlation-id and bearer header values use bounded safe alphabets, so CR/LF/space header injection is refused before request creation;
- machine and lease bearers must match the exact `UUID.43-char-base64url` wire shape;
- the one-time lease is sent only in `X-One-C-Job-Lease: Bearer …`, never in JSON;
- redirects are refused;
- only GET and POST are representable;
- response body is bounded;
- pairing code and terminal metadata are bounded;
- machine bearer is attached only after host/path/header security gates;
- no BSL logging call receives secrets/provider bodies;
- POST network failure becomes `UNKNOWN_RESULT` because the far side may have committed before the connection broke.

The transport does not persist the machine credential. That is deliberate: a source-only module must not invent a plaintext fallback just to appear complete. A real compatibility build needs a reviewed secure-secret provider (BSP safe storage where available, or another accepted protected mechanism).

## Self-discovery

`TransparentPriceConnectorDiscovery.bsl` now builds the exact server discovery shape:

- `platformVersion`;
- `configurationName`;
- `configurationVersion`;
- opaque `databaseInstanceId`;
- explicit `organizations[]` with GUID/INN/KPP/name;
- exact seven command capabilities;
- `connectorVersion`;
- `protocolVersion`.

The platform version is read from standard `СистемнаяИнформация.ВерсияПриложения`.

Configuration-specific facts are **not guessed**. The reference `TransparentPriceConfigurationAdapter` returns `CONFIGURATION_DISCOVERY_NOT_IMPLEMENTED` until an exact accepted profile supplies configuration name/version, an opaque stable database id and legal entities. This prevents a hidden “all 1C configurations have the same Organizations object” assumption.

Discovery does not use or transmit the information-base connection string. Legal-entity count is bounded, GUIDs must be unique, INN/KPP are validated, and pairing remains closed until discovery is ready.

## Pairing and runtime

The source contains calls for:

- `POST /connector/v1/pair` using a one-time human code and validated discovery payload;
- `POST /connector/v1/heartbeat`;
- `GET /connector/v1/jobs`;
- `POST /connector/v1/jobs/:id/ack`;
- `POST /connector/v1/jobs/:id/result`;
- `POST /connector/v1/jobs/:id/fail`.

A valid job is ACKed before a business operation starts.

The leased response includes the canonical server `payloadHash`. Every ACK,
result and fail report echoes the exact `{ idempotencyKey, payloadHash,
revision, attempt }` receipt envelope. Result adds only `resultState`,
`resultCode`, `externalEvidenceId`; fail adds only `failureClass`, `effectState`,
`resultCode`. Receipt idempotency keys are deterministically derived from the
lease UUID, and an ambiguous report is retried with the same key and lease.

The source dispatcher contains exactly the same seven commands as the server protocol. It uses static branches and static adapter calls; no command text can become arbitrary code/method/SQL.

## Compatibility is still honest

The configuration adapter included here is a fail-closed seam. Every business operation returns:

`UNKNOWN_RESULT / CONFIGURATION_ADAPTER_NOT_IMPLEMENTED`

and discovery returns not-ready until an exact configuration profile implements and passes acceptance.

That means this PR is real transport/discovery source but is **not** evidence that BP 3, KFH, ERP, KA or UT is already supported.

## Success semantics

`HTTP_OK` never becomes business success by itself.

A configuration adapter may report `REPORTED_SUCCESS` only with a non-empty
bounded `externalEvidenceId` corresponding to a real 1C object/fact and an
exact `CREATED_IN_1C` or `POSTED` state. The server-side lease contract still
treats that as connector-reported success, not automatically as Connection
Center `CONFIRMED_LIVE`.

## Official 1C basis checked for this implementation

The implementation direction was checked against official 1C materials on 2026-08-18:

- 1C platform integration supports work with external HTTP/HTTPS services;
- JSON can be used as an HTTP request body;
- `HTTPСоединение`, `HTTPЗапрос` and arbitrary HTTP method calls are platform mechanisms;
- official security guidance shows `ЗащищенноеСоединениеOpenSSL` with OS trusted CA certificates and HTTPS server validation;
- official security guidance requires secrets to use protected storage and documents the BSP safe-storage API;
- embedded language can read configuration metadata;
- configuration extensions can add integration functionality without rewriting the supported base configuration.

References:

- https://v8.1c.ru/platforma/integraciya/
- https://v8.1c.ru/platforma/rabota-s-http-i-ftp/
- https://v8.1c.ru/platforma/json/
- https://v8.1c.ru/platforma/rasshireniya/
- https://its.1c.ru/db/content/v8std/src/600/i8100669.htm
- https://its.1c.ru/db/content/v8std/src/600/i8100740.htm
- https://its.1c.ru/db/content/metod8dev/src/developers/platform/demo/i8105574.htm
- https://its.1c.ru/db/content/metod8dev/src/developers/platform/metod/other/i8102318.htm

## Remaining before ADAPTER_READY

1. 1C must confirm the exact baseline configuration/release in correspondence #1097.
2. Reproducible extension project/`.cfe` build with checksum/provenance.
3. Secure credential provider accepted for that exact configuration/runtime family.
4. Exact discovery and typed-command adapter for that same configuration.
5. 1C-side syntax/lint/EDT validation and a licensed isolated test information base.
6. Contract, multi-org leakage, offline/retry/reconciliation and upgrade tests.
7. Submission package and formal 1C expert review; paid rechecks require separate authorization.
8. Only then may Connection Center advance to `ADAPTER_READY`, later `TEST`, and only external live evidence may reach `CONFIRMED_LIVE`.

## Claims deliberately not made

- no compiled extension artifact exists from this slice alone;
- no customer information base was contacted;
- no live provider response exists;
- no universal 1C compatibility;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
