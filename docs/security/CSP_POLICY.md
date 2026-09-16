# Content Security Policy

OWASP ASVS 5.0 **V3.4.3** names three minimums for a global policy:
`object-src 'none'`, `base-uri 'none'`, and *either an allowlist or nonces or
hashes*. Two are met. The third is not, and this file records why, because the
reason is a measurement rather than an opinion.

## Where the policy comes from

Two places define a CSP, and only one of them is ever served to a document.

| Defined in | Governs |
| --- | --- |
| `apps/web/middleware.ts` (`applySecurityHeaders`) | every document response |
| `apps/web/next.config.js` (`securityHeaders`, `source: '/(.*)'`) | only the paths the middleware matcher skips — `_next/static`, `_next/image`, `favicon.ico` |

Measured against a production build of Next 15.5.21 with a deliberately
different policy configured in each: the middleware header is the one served,
and exactly one `Content-Security-Policy` header comes back. The two are
nevertheless kept consistent on the three minimums, so that reading either one
does not give a false picture of what the application enforces.

## What is enforced

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:;
frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'
```

- **`object-src 'none'`** — added. Its absence was not neutral: the directive
  fell back to `default-src 'self'`, which still permits an `<object>` loading
  plugin content from this origin.
- **`base-uri 'none'`** — added, replacing `'self'`. This is the one that earns
  its place quietly. Under `base-uri 'self'` an injected `<base href="/x/">`
  silently re-points every **relative** script `src` on the page, so one
  injected tag reroutes scripts the rest of the policy trusts. `'none'` stops
  the element having any effect.
- **`'unsafe-eval'`** — removed. Measured in Chromium against a production
  build: with it gone, both a statically prerendered page and a dynamically
  rendered one render, hydrate and remain interactive, with zero policy
  violations. It cost nothing, and it removes `eval()` and `new Function()` as
  a payload sink.

## Why `'unsafe-inline'` is still there, and what it would take to remove it

`'unsafe-inline'` permits arbitrary inline script, which is what an XSS payload
is — so while it is present, `script-src 'self'` is not meaningfully an
allowlist and **V3.4.3 remains FAIL**. It is not left in place for convenience.

Next.js injects inline bootstrap scripts, and the supported way to permit those
without `'unsafe-inline'` is a per-request nonce. Next applies a nonce only to a
page it renders **per request**. Measured on a production build with one policy
and two pages:

| page | policy | hydrates | violations |
| --- | --- | --- | --- |
| statically prerendered | `'unsafe-inline'`, `'unsafe-eval'` | yes | 0 |
| statically prerendered | nonce, no `unsafe-*` | **no** | 2 — the webpack chunk and the inline bootstrap both refused |
| dynamically rendered | nonce, no `unsafe-*` | yes | 0 |

A prerendered page's HTML is produced at build time, so there is no per-request
value to put in it: the nonce is absent, every script is refused, and hydration
never happens. This is not a degradation, it is a dead page.

This application has **249** `page.tsx` files, of which 12 opt into dynamic
rendering explicitly and about 34 are dynamic by consequence of reading cookies,
headers or search params. Removing `'unsafe-inline'` therefore means giving up
prerendering across roughly two hundred pages.

That is an architecture and performance decision about how this application
renders, with a cost that is paid on every request. It is **not** a header
change, and it is not one to make silently on security grounds alone. It needs
the owner's decision. Until then the two achievable minimums are enforced, the
third is not, and the verdict says so.

## Reproducing the measurements

The harness is a minimal Next application of the same version with one page
prerendered and one forced dynamic, a middleware that selects a policy per
request, and Chromium driven through Playwright recording
`securitypolicyviolation` events and whether a click handler still fires. What
it establishes is the two tables above: which definition wins, and what each
policy does to each kind of page.
