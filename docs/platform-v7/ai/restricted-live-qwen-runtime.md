# Restricted live Qwen runtime

Issue: #3365  
Hosting: REG.RU only  
Maturity boundary: `RESTRICTED_LIVE_READ_ONLY_QWEN_ACTIVE_PUBLIC_AND_ROLE_SCOPED_PENDING_EXTERNAL_IMMUTABILITY_AND_ADMISSION`

## Purpose

The already proven Qwen3-8B Q4_K_M llama.cpp service is reused by two isolated platform contours:

1. **Public contour** — homepage and approved public platform routes. The model receives only the verified public knowledge response produced by the existing deterministic public assistant. It never receives account, tenant, membership, role, Deal, document, money, logistics, laboratory, dispute, staff or internal integration data.
2. **Authenticated contour** — every platform role inside its real server-authorized organization, membership and accessible Deal scope. The client cannot select tenant, role or membership. Existing PostgreSQL access checks and read-only contracts remain authoritative.

The model is not the source of truth and has no mutation authority. Permanent AP-13D admission and platform-wide operational attestation remain `NOT_ATTESTED`.

## Network and secret boundary

- `llama-server` listens only on the dedicated model host private RFC1918 address.
- The browser never calls the model host.
- The API container is the only holder and user of the model Bearer key.
- The public Next.js route calls the API over the internal Compose network with a separate HMAC signature covering method, path, timestamp and canonical body digest.
- HMAC timestamps older than 90 seconds are rejected.
- Raw questions, private context, model key and HMAC secret must not be written to Git, issues, PRs or workflow logs.

## Protected production variables

These values belong only in the root-owned production environment on the REG.RU VPS. Values are intentionally omitted here.

### API container

```text
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=<private model base ending in /v1/>
AI_ASSISTANT_MODEL=tai-qwen3-8b-q4km
AI_ASSISTANT_API_KEY=<model-host Bearer key>
AI_ASSISTANT_ALLOWED_HOSTS=<exact private model host>
AI_ASSISTANT_TIMEOUT_MS=120000
AI_ASSISTANT_MAX_TOKENS=500
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_PUBLIC_GATEWAY_HMAC_SECRET=<independent random secret, minimum 32 characters>
```

### Web container

```text
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_RESTRICTED_QWEN_MODEL_IDENTITY=tai-qwen3-8b-q4km
TAI_PUBLIC_GATEWAY_HMAC_SECRET=<same internal HMAC secret as API>
TAI_INTERNAL_API_BASE_URL=<internal Compose API base ending in /api/>
TAI_INTERNAL_API_ALLOWED_HOSTS=<exact internal API hostname>
TAI_PUBLIC_MODEL_TIMEOUT_MS=130000
NEXT_PUBLIC_SITE_URL=https://процент-агро.рф
```

No model secret may use a `NEXT_PUBLIC_` prefix.

## Public request path

```text
Browser
  → /api/public-platform-assistant?stream=1
  → Next before-files rewrite
  → restricted public route
  → existing deterministic public knowledge answer
  → HMAC-authenticated internal API request
  → API-only Bearer request to private llama-server
  → validated read-only SSE frames
```

If verified public grounding is insufficient, the route abstains before model generation. If the restricted model is disabled or unavailable, the UI may show the existing public knowledge response only when it remains truthfully labelled as public knowledge rather than model output.

## Authenticated request path

```text
Authenticated browser
  → /api/proxy/ai-assistant/chat
  → API authentication and role guard
  → server-resolved membership and accessible Deals
  → minimized authorized context
  → API-only Bearer request to private llama-server
  → read-only structured response and audit
```

The existing ten Safe Tools remain read-only. No draft, acknowledgement, support-case, signature, settlement, banking or privileged write path is enabled by this runtime.

## Activation acceptance

Activation is accepted only when all of the following pass on the exact merged `main` SHA:

- exact API and web OCI revisions are running on REG.RU;
- model service is active after restart and bound only to the private address;
- production API reaches model health and authenticated inference without revealing the key;
- RU, EN and ZH public questions return grounded model answers;
- public prompts cannot obtain private/account data;
- RU, EN and ZH authenticated questions work for platform roles inside their rights;
- inaccessible Deal, cross-tenant and revoked-membership requests fail closed;
- all write-shaped attempts are denied;
- browser responses and HTML contain neither model key nor private host address;
- rollback disables both model contours and recreates only API/web cleanly.

A merge, image publication or green CI run alone is not live-production evidence.

## Rollback

1. Set `TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=false` for API and web.
2. Set `AI_ASSISTANT_PROVIDER=local` for API.
3. Remove the model Bearer key and internal HMAC secret from the active container environment without logging them.
4. Recreate API and web through the protected REG.RU Compose release contour.
5. Verify public knowledge fallback, authenticated deterministic fallback and absence of direct model traffic.
6. Stop `tai-qwen3-8b.service` only when the model service itself must be withdrawn.
