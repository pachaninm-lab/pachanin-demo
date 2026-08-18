# PC-CROP Federal Accounting — 1C extension outbound transport source

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: `claude/pc-crop-onec-machine-identity-20260818` / `38df8b818e1050ff6595ed2a25079d89f459ceff`
Operational status: `SOURCE_ONLY / NOT_ATTESTED`

## Why this slice exists

The server-side protocol and machine-credential contracts are not enough for the master requirement “real 1C synchronizes without our team visiting the customer”. A real client-side source boundary is needed too.

This slice introduces source modules intended for a 1C extension. They use the platform's standard outbound HTTP/HTTPS and JSON mechanisms; no inbound publication of the customer's information base is required.

## Security direction

The reference source is intentionally narrower than a generic integration client:

- one compile-time pinned production host;
- port 443 only;
- TLS server certificate verification through the OS trust store;
- paths must stay under `/connector/v1`;
- absolute URL, traversal and backslash are refused;
- unsafe job ids are refused before path interpolation;
- redirects are refused;
- only GET and POST are representable;
- response body is bounded;
- machine bearer is attached only after host/path selection;
- no BSL logging call receives secrets/provider bodies;
- POST network failure becomes `UNKNOWN_RESULT` because the far side may have committed before the connection broke.

The transport does not persist the machine credential. That is deliberate: a source-only module must not invent a plaintext fallback just to appear complete. A real compatibility build needs a reviewed secure-secret provider (BSP safe storage where available, or another accepted protected mechanism).

## Pairing and runtime

The source contains calls for:

- `POST /connector/v1/pair` using a one-time human code and discovery payload;
- `POST /connector/v1/heartbeat`;
- `GET /connector/v1/jobs`;
- `POST /connector/v1/jobs/:id/ack`;
- `POST /connector/v1/jobs/:id/result`;
- `POST /connector/v1/jobs/:id/fail`.

A valid job is ACKed before a business operation starts.

The source dispatcher contains exactly the same seven commands as the server protocol. It uses static branches and static adapter calls; no command text can become arbitrary code/method/SQL.

## Compatibility is still honest

The configuration adapter included here is a fail-closed seam. Every operation returns:

`UNKNOWN_RESULT / CONFIGURATION_ADAPTER_NOT_IMPLEMENTED`

until an exact configuration profile implements and passes acceptance.

That means this PR is real transport source but is **not** evidence that BP 3, KFH, ERP, KA or UT is already supported.

## Success semantics

`HTTP_OK` never becomes business success by itself.

A configuration adapter may report `REPORTED_SUCCESS` only with a non-empty `externalEvidenceId` corresponding to a real 1C object/fact. The server-side lease contract still treats that as connector-reported success, not automatically as Connection Center `CONFIRMED_LIVE`.

## Official 1C basis checked for this implementation

The implementation direction was checked against official 1C materials on 2026-08-18:

- 1C platform integration supports work with external HTTP/HTTPS services;
- JSON can be used as an HTTP request body;
- `HTTPСоединение`, `HTTPЗапрос` and arbitrary HTTP method calls are platform mechanisms;
- official security guidance shows `ЗащищенноеСоединениеOpenSSL` with OS trusted CA certificates and HTTPS server validation;
- configuration extensions can add integration functionality without rewriting the supported base configuration.

References:

- https://v8.1c.ru/platforma/integraciya/
- https://v8.1c.ru/platforma/rabota-s-http-i-ftp/
- https://v8.1c.ru/platforma/json/
- https://v8.1c.ru/platforma/rasshireniya/
- https://its.1c.ru/db/content/v8std/src/600/i8100669.htm
- https://its.1c.ru/db/content/metod8dev/src/developers/platform/demo/i8105574.htm

## Remaining before ADAPTER_READY

1. Durable server-side installation/binding/pairing/credential state.
2. Guarded runtime `/connector/v1/*` routes.
3. Reproducible extension project/`.cfe` build with checksum/provenance.
4. Secure credential provider for each supported runtime/configuration family.
5. Discovery implementation in 1C (platform/configuration version, database instance, legal entities, capabilities).
6. Exact compatibility adapter, starting with one selected configuration family.
7. 1C-side tests/lint/EDT validation and a real test information base.
8. Server contract acceptance, multi-org leakage negative test, offline/retry/reconciliation test.
9. Only then may Connection Center advance to `ADAPTER_READY`, later `TEST`, and only external live evidence may reach `CONFIRMED_LIVE`.

## Claims deliberately not made

- no compiled extension artifact exists from this slice alone;
- no customer information base was contacted;
- no live provider response exists;
- no universal 1C compatibility;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
