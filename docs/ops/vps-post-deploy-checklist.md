# VPS post-deploy checklist for platform-v7

Use this checklist only against the real production domain after the REG.RU virtual server has been updated.

## 1. Release identity

- Target Git SHA is recorded.
- Required checks passed.
- Running `web` container exists on the production Compose contour.
- Container label `org.opencontainers.image.revision` exactly equals the target Git SHA.
- Active image reference/digest is recorded.
- Rollback SHA is recorded.

A registry push, `latest` tag or automatic Watchtower event is not sufficient without the running revision check.

## 2. Server and edge

- DNS for `процент-агро.рф` resolves to the expected virtual server.
- Caddy is running and healthy.
- TLS is valid for the production domain.
- HTTP redirects to HTTPS according to the active policy.
- Caddy routes the domain to the intended `web` service.
- No unexpected 502/503 responses appear in recent Caddy logs.

## 3. Main public route

Check `https://процент-агро.рф/platform-v7`:

- returns 200 without a stale third-party-host redirect;
- renders the current public first screen;
- displays the canonical logo and header;
- contains the expected release-specific change;
- does not expose protected cabinet content before authentication;
- does not contain duplicate launchers or stale UI from a previous image.

## 4. Required public routes

Check at minimum:

- `/platform-v7`;
- `/platform-v7/login`;
- `/platform-v7/forgot-password`;
- `/robots.txt`;
- `/sitemap.xml`.

For a broader release, also check the affected public and protected routes named in the PR.

## 5. Mobile acceptance

At a real mobile viewport, including a device with browser bottom chrome:

- no horizontal scrolling;
- fixed header does not cover content;
- primary CTA remains usable;
- bottom dock/navigation respects safe areas;
- dialogs hide or reposition fixed launchers correctly;
- changed UI appears after a clean page load;
- no stale service-worker-controlled page remains;
- text is readable without zoom.

For visual changes, capture a current screenshot from the production domain.

## 6. Contact dock acceptance

When the release affects the public contact dock:

- exactly one visible dock is present;
- actions are `ИИ`, `Поддержка`, `Позвонить` in Russian locale;
- the separate legacy support bubble is not visible;
- AI opens the public assistant;
- Support opens the support dialog;
- Call uses the approved `tel:` action;
- the dock hides while a modal dialog is open;
- mobile safe-area placement matches the approved design.

## 7. Cabinet boundary

Without a valid authenticated session, direct protected-route navigation must fail closed or redirect to the approved entry flow. Check representative routes such as:

- `/platform-v7/deals`;
- `/platform-v7/bank`;
- `/platform-v7/logistics`;
- `/platform-v7/driver/field`.

## 8. API and persistence

When API or data services changed:

- API container revision matches the target SHA;
- startup/readiness checks are healthy;
- required migration and provisioning jobs completed successfully;
- no production secret is printed in logs;
- representative read and write paths behave according to the release scope;
- server-side auth, RBAC, idempotency and audit boundaries remain active.

## 9. Cache and old runtime

- Production entry HTML is current.
- No retired provider URL is serving the canonical domain.
- Browser/CDN headers match the intended cache policy.
- Old CacheStorage/service-worker state does not preserve a previous release.
- A clean browser session and a returning browser session show the same release.

## 10. Release record

Record:

- Git SHA;
- image tag/digest;
- running OCI revision;
- affected services;
- deployment time;
- live smoke result;
- mobile screenshot/evidence when applicable;
- rollback SHA;
- operator and unresolved limitations.

Only after this record is complete may the release be described as live.
