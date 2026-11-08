# Company OS v1.0 — Truth Audit F2A

Date: 2026-08-15
Parent: #4152
Boundary: #4159
F2A authority baseline: `a15bcd994788d081eb15f83a1296ea3091e4cc78`
Production authority: REG.RU VPS only
New recurring cost: 0 ₽

## 1. Existing topology reused

The canonical production contour already uses the REG.RU Ubuntu VPS, Caddy on ports 80/443, Docker Compose and the Next.js web service behind Caddy. Exact protected production working paths, SSH identity and environment values are intentionally not source-controlled.

F2A does not create a second web application or authentication stack. It reuses the existing platform identity, MFA, staff assignment, capability, JIT, SoD and break-glass authorities.

## 2. Existing security reused

Before F2A the web middleware already emitted HSTS, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, noindex headers for private surfaces and no-store for protected responses. Authentication BFF mutations already used the existing CSRF boundary.

The remaining gap was not basic header hardening. It was **host separation**: the staff UI and staff BFF lived on the same public host as external business cabinets.

## 3. Canonical control authority

F2A introduces one exact canonical host:

`control.xn----8sbjf4befbjgs9b.xn--p1ai`

which is the ASCII authority for `control.процент-агро.рф`.

Host parsing:

- uses the actual `Host` authority only;
- rejects whitespace, commas, userinfo, malformed ports and IPv6-style ambiguity for this DNS-only authority;
- strips only a valid numeric port and an optional terminal DNS dot;
- never uses `X-Forwarded-Host` as a privilege signal;
- never uses office IP, CIDR, VPN location or source network as authentication/authorization authority.

## 4. Default-off cutover

The application control realm is gated by `PC_CONTROL_HOST_ENABLED=true`.

The feature is disabled by default. F2A source merge alone therefore does not move staff traffic or mutate production routing. DNS/Caddy/environment enablement remains F2B.

When enabled:

- parent-host `/platform-v7/staff` becomes an absolute HTTPS redirect to the canonical control host;
- parent-host `/api/staff/*` returns a fail-closed control-host-required response;
- unrelated hosts cannot expose either staff surface;
- the two staff BFFs independently enforce the canonical control host as defense in depth.

## 5. Control-realm route boundary

After enablement the control host serves only the bounded internal/authentication set:

- `/platform-v7/staff` and descendants;
- login, password recovery/reset and MFA recovery pages;
- the exact auth BFFs required for login, MFA, membership selection, refresh, logout, recovery and step-up;
- `/api/staff/*`;
- Next/static presentation assets.

It does not serve business cabinets, role preview, demo, Gekta, public assistant, lead capture, public registration or other external platform surfaces.

`/platform-v7/register` is never rendered in the control realm; it may only leave the realm by an HTTPS redirect to the primary public host.

## 6. No presentation-role authority in the control realm

The control middleware path does not call the public/business `resolveRole()` authority-presentation helper. It removes incoming `x-pc-role` and `x-pc-owner-key` request headers and supplies only a server-generated `x-pc-control-realm` marker.

Actual staff authority still comes from the F1/F1.1 server contracts:

- authenticated user;
- MFA;
- durable active staff assignment;
- `GET /staff/capabilities/me`;
- endpoint classification;
- access session/mode/permission where required.

A query parameter, cookie presentation role or direct URL cannot increase staff permission.

## 7. Control-host cookie isolation

The existing cookie helpers never set a Domain attribute, so browser cookies are host-only.

F2A adds a control-plane mode to authenticated session issuance:

- access token: HttpOnly, Secure in production, SameSite=Strict, host-only;
- refresh token: HttpOnly, Secure in production, SameSite=Strict, host-only;
- signed cabinet context: HttpOnly, Secure in production, SameSite=Strict, host-only;
- session marker: Secure in production, SameSite=Strict, host-only;
- CSRF token: intentionally readable for the existing double-submit mechanism, Secure in production, SameSite=Strict, host-only.

The privileged staff access token and metadata cookies were already HttpOnly + SameSite=Strict and scoped to `/api/staff`; F2A additionally makes that BFF inaccessible from non-control hosts after cutover.

No parent-domain cookie is introduced.

## 8. Authentication lifecycle

The login, membership selection and MFA completion BFFs now recognize an enabled exact control host and:

- issue strict control-plane session cookies;
- force successful navigation to `/platform-v7/staff` rather than any business cabinet;
- retain correlation IDs in responses/log evidence.

Refresh preserves the same strict control-plane session mode.

Logout revokes the upstream refresh session where possible, always clears the local host-only control cookies, and records control-realm correlation evidence for success/failure.

Password/MFA recovery remain authentication surfaces only; successful staff entry is still denied unless the staff capabilities contract passes.

## 9. Middleware and BFF defense in depth

The middleware is the first host boundary. The generic privileged staff BFF and the read-only capabilities BFF repeat the canonical-host requirement when the cutover gate is enabled.

Therefore a middleware bypass, alternate route mapping or direct BFF invocation cannot intentionally preserve the public parent host as an alternate staff API boundary.

## 10. What F2A does not claim

F2A does **not** prove that the DNS record exists, a certificate is live, Caddy routes the new host, or production has enabled the feature. Those are F2B production acceptance items.

F2A performs no:

- DNS mutation;
- Caddy mutation;
- Docker Compose mutation;
- production environment mutation;
- database migration;
- production deployment.

## 11. F2A acceptance

F2A can merge only after exact-head tests prove:

1. exact host parsing and forwarded-host spoof rejection;
2. disabled-by-default behavior;
3. strict control route allowlist;
4. parent staff route/API cutover logic;
5. strict host-only control credentials;
6. control-aware auth landing/refresh/logout;
7. defense-in-depth BFF host checks;
8. no office-network trust shortcut;
9. full relevant web/Node/security CI pass.

After merge, proceed immediately to F2B read-only production topology/DNS evidence, then protected edge cutover. Merge/build is not production evidence.
