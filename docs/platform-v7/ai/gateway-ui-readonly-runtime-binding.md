# TAI Gateway: read-only runtime binding

How the assistant stream is switched on, what it refuses when it is not, and why
the refusal is the correct behaviour rather than a gap to be filled in later.

## The one contract

`apps/api/src/modules/ai-insights/ai-assistant-stream.contract.ts` is the only
description of the wire. It is dependency-free and knows nothing about Nest,
Next or sockets, which is what lets the private API and the public boundary
share it instead of maintaining two implementations that resemble each other.

Both contours emit through `GatewayStreamWriter`, which validates every frame
before it reaches the socket. A frame the contract refuses does not get skipped —
skipping would leave the tokens already sent looking like a finished answer once
`done` arrived. It seals the stream with `error` + `done{complete:false}`.

| Contour | Endpoint | Mode |
|---|---|---|
| Private, session-authenticated | `POST /ai-assistant/stream` | `private` |
| Public, no account data | `POST /api/public-platform-assistant?stream=1` | `public` |

The existing non-streaming paths — `POST /ai-assistant/chat` and the public JSON
answer — are unchanged. The public JSON answer is a verified knowledge-base
lookup and says so (`dataMode: "public_knowledge"`); it has never claimed to be a
model answer, and it is not one.

## Flags

All four default to off or unset, so a deployment that sets nothing streams
nothing. They are documented here rather than in `.env.example` because the
governance guard forbids changes to any `.env*` path.

| Variable | Contour | Meaning |
|---|---|---|
| `TAI_GATEWAY_STREAM_ENABLED` | private | `true` enables the endpoint. Anything else → `FEATURE_DISABLED`. |
| `TAI_GATEWAY_MODEL_IDENTITY` | private | Exact identity of the admitted model. Blank counts as absent. |
| `TAI_GATEWAY_MODEL_ADMISSION` | private | Must be exactly `ADMITTED`. `CANDIDATE`, empty or missing → `MODEL_NOT_ADMITTED`. |
| `TAI_GATEWAY_PUBLIC_STREAM_ENABLED` | public | As above, for the public boundary. |
| `TAI_GATEWAY_PUBLIC_MODEL_IDENTITY` | public | As above. |
| `TAI_GATEWAY_PUBLIC_MODEL_ADMISSION` | public | As above. |
| `PUBLIC_APP_BASE_URL` | private | Base address used to make cited platform paths openable. |
| `NEXT_PUBLIC_SITE_URL` | public | Same, for the public boundary. |

Admission is read from the environment on **every** request. Caching it would
keep a deployment generating after admission was withdrawn.

## What happens without admission

Nothing is generated. `chat()` is not called, no canned reply is substituted,
and no mock is served. The stream carries `meta{modelIdentity:null}`, then
`error` with `FEATURE_DISABLED` or `MODEL_NOT_ADMITTED`, then
`done{complete:false}`.

This is deliberate. A fallback would make an unadmitted model indistinguishable
from an admitted one to anyone reading the UI, which is exactly the false
readiness this contour exists to prevent.

The refusal travels **inside** the stream, with HTTP 200. A non-200 would leave
the client showing a transport failure instead of the reason the assistant
declined — and the reason is the one thing the reader needs.

## Refusals

| Refusal | When |
|---|---|
| `FEATURE_DISABLED` | The stream is not enabled in this deployment. |
| `MODEL_NOT_ADMITTED` | No model, a blank identity, or an admission record that is not `ADMITTED`. |
| `ABSTAINED_NO_DATA` | The question cannot be grounded, or asks for data this contour does not hold. |
| `CANCELLED` | The reader went away mid-answer. |
| `UPSTREAM_ERROR` | The generator failed, or a frame failed the contract. |

`ABSTAINED_NO_DATA` is used for a request for other users' Deals or account data
in the public contour. That is the accurate statement: public mode holds none of
it. "Denied" would imply the data is here and merely withheld.

An upstream failure message is never forwarded. A connection string or a model
host's error text is not something the browser needs, and it is the usual way
internals reach a public contour.

## Citations

A citation whose URI cannot be resolved to an absolute `http(s)` address is
dropped, not reshaped. A citation nobody can open is indistinguishable from an
invented one, so the contract refuses it and both contours drop it rather than
emit something that merely looks openable.

## Truncation

`resolveOutcome` returns text only for a stream that completed. A cancelled,
failed or unfinished stream yields no text at all — "keep what we got" is not
representable. A partial answer is one the model never finished and nobody
vouched for; showing it is how an assistant appears to state a conclusion it did
not reach.

## What this does not claim

TAI is not the source of truth for Deals, roles, organizations, money,
documents, bids, signatures, quality, logistics, disputes or execution status.
It reads and explains; it does not act. There is no prepared action, no
confirmation step and no execution path, and the contract refuses the vocabulary
of one at any nesting depth.

Enabling these flags is not a production-readiness claim. A green CI run, a
merge, or a published image is not evidence that anything changed in production.
