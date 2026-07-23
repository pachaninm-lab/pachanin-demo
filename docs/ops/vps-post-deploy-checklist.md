# VPS post-deploy checklist for platform-v7

Use this checklist only against the real production domain after the REG.RU virtual server has been updated.

## 1. Release identity

- Target Git SHA is a full 40-character revision reachable from `main`.
- Required checks passed.
- Exact GHCR image exists.
- Running `web` container exists on the protected production Compose contour.
- Container label `org.opencontainers.image.revision` exactly equals the target Git SHA.
- Active image reference/digest is recorded.
- Rollback SHA and immutable image ID are recorded.

A registry push, `latest` tag, local retag or automatic updater event is not sufficient without the running OCI revision check.

## 2. Hardened Compose runtime

- Docker Compose is version `2.24.4` or later.
- The protected base file, persistent hardening override and persistent exact-image override all validate.
- Merged `web` service has no fixed `container_name`.
- Merged `web.image` equals the requested immutable exact-SHA image.
- Exactly one Compose-managed `web` container exists.
- `com.docker.compose.project` label is present.
- `com.docker.compose.service=web` label is present.
- Docker reports the `web` container as `healthy`, not merely `running`.
- Watchtower is stopped.
- Any retained Watchtower container has restart policy `no`.
- API, PostgreSQL, Redis, MinIO and Caddy container IDs are unchanged for a web-only release.

## 3. Server and edge

- DNS for `процент-агро.рф` resolves to the expected REG.RU virtual server.
- Caddy is running and healthy.
- TLS is valid for the production domain.
- HTTP redirects to HTTPS according to the active policy.
- Caddy routes the domain to the intended Compose-managed `web` service.
- No unexpected 502/503 responses appear in recent Caddy logs.

## 4. Readiness and exact live revision

- `/api/health/ready` returns HTTP 200 for a hardened target.
- Readiness payload reports `status=ok`.
- Readiness payload contains the exact target revision.
- `/manifest-pc-deploy.json` contains the same exact target revision.
- Readiness and manifest are requested with cache busting.
- A mismatch fails the release even if `/platform-v7` returns HTTP 200.

## 5. Main public route

Check `https://процент-агро.рф/platform-v7`:

- returns 200 without a stale third-party-host redirect;
- renders the current public first screen;
- displays the canonical logo and header;
- contains the expected release-specific change;
- does not expose protected cabinet content before authentication;
- does not contain duplicate launchers or stale UI from a previous image;
- has no hydration, uncaught runtime or error-boundary failures in the browser console.

## 6. Required public routes and locales

Check at minimum:

- `/platform-v7?lang=ru`;
- `/platform-v7?lang=en`;
- `/platform-v7?lang=zh`;
- `/platform-v7/login`;
- `/platform-v7/forgot-password`;
- `/robots.txt`;
- `/sitemap.xml`.

For a broader release, also check every affected public and protected route named in the PR or release record.

## 7. Mobile acceptance

At real or browser-verified viewports `320`, `375`, `390` and `430` pixels, including a device with browser bottom chrome:

- no horizontal scrolling;
- fixed header does not cover content;
- primary CTA remains usable;
- bottom dock/navigation respects safe areas;
- dialogs hide or reposition fixed launchers correctly;
- changed UI appears after a clean page load;
- no stale service-worker-controlled page remains;
- text is readable without zoom;
- motion respects reduced-motion settings.

For visual changes, capture current screenshots from the production domain for mobile and desktop.

## 8. Contact dock acceptance

When the release affects the public contact dock:

- exactly one visible dock is present;
- actions are `ИИ`, `Поддержка`, `Позвонить` in Russian locale;
- the separate legacy support bubble is not visible;
- AI opens the public assistant;
- Support opens the support dialog;
- Call uses the approved `tel:` action without displaying the number in the collapsed dock;
- the dock hides while a modal dialog is open;
- mobile safe-area placement matches the approved design.

## 9. Cabinet boundary

Without a valid authenticated session, direct protected-route navigation must fail closed or redirect to the approved entry flow. Check representative routes such as:

- `/platform-v7/deals`;
- `/platform-v7/bank`;
- `/platform-v7/logistics`;
- `/platform-v7/driver/field`.

## 10. API and persistence

When API or data services changed:

- API container revision matches the target SHA;
- startup/readiness checks are healthy;
- required migration and provisioning jobs completed successfully;
- no production secret is printed in logs;
- representative read and write paths behave according to the release scope;
- server-side auth, RBAC, idempotency and audit boundaries remain active.

For a web-only release, no API/data service restart is permitted.

## 11. Cache, SEO and old runtime

- Production entry HTML is current.
- No retired provider URL is serving the canonical domain.
- Browser/CDN headers match the intended cache policy.
- Old CacheStorage/service-worker state does not preserve a previous release.
- A clean browser session and a returning browser session show the same release.
- Title, description, canonical and hreflang metadata are present.
- Sitemap contains the intended public route.
- Robots policy does not block the public page.

## 12. Release record

Record:

- Git SHA;
- exact image tag/digest;
- merged Compose web image from the persistent image override;
- running OCI revision;
- Docker health state;
- Compose project/service labels;
- affected services;
- deployment time;
- live RU/EN/ZH smoke result;
- mobile/desktop visual evidence when applicable;
- rollback SHA and image ID;
- Watchtower retirement state;
- operator or workflow run;
- unresolved limitations.

Only after this record is complete may the release be described as live.
