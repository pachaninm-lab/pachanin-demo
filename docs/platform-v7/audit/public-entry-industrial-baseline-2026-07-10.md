# Public entry industrial baseline — 2026-07-10

## Scope

Audited current `main` for:

- `/platform-v7`;
- `/platform-v7/login`;
- public shell and header;
- locale selection and translation runtime;
- authentication entry boundary;
- CSS/runtime layers affecting the public surface;
- overlapping open pull requests.

This document records code-level facts. It is not proof of production readiness, real-device browser coverage, Core Web Vitals at the 75th percentile, or live external integrations.

## Actual entry points

| Surface | Entry point | Rendering boundary |
| --- | --- | --- |
| Public landing | `apps/web/app/platform-v7/page.tsx` | Server component using `next-intl/server` |
| Login | `apps/web/app/platform-v7/login/page.tsx` | Client component |
| Platform layout | `apps/web/app/platform-v7/layout.tsx` | Server layout wrapping `PlatformV7ShellSwitch` |
| Route template | `apps/web/app/platform-v7/template.tsx` | Server template mounting client runtime guards before and after every route |
| Public/protected split | `apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx` | Client pathname switch |
| Public header | `apps/web/components/platform-v7/PublicSiteHeader.tsx` | Shared component, previously with runtime `<style>` injection |
| Language control | `apps/web/components/platform-v7/HeaderLanguageSwitch.tsx` | Client portal + DOM translation runtime |
| Request locale | `apps/web/i18n/request.ts` | Server locale from `x-pc-locale`, then locale cookie |
| Route middleware | `apps/web/middleware.ts` | Locale persistence, legacy role resolution and security headers |

## Confirmed critical findings

### Public UX and single-entry violations

1. Landing role cards linked to `/platform-v7/login?role=...` for all 12 roles.
2. The hero exposed three primary actions, including a full-size question CTA.
3. Landing copy explicitly instructed the user to choose a role before login.
4. Login rendered a different header and a wheat icon instead of the canonical brand mark.
5. Login language was read from `localStorage`, while the landing used server `next-intl` messages.
6. Password recovery linked to the contact/support flow rather than a dedicated recovery route.

### Runtime localisation violations

`HeaderLanguageSwitch.tsx` confirmed all prohibited mechanisms:

- `createPortal` into whichever header node exists after render;
- `MutationObserver` for target discovery;
- `applyTranslationToDom` after hydration;
- a second translation observer;
- direct mutation of `<html>`, `<body>` and `<head>`;
- forced full-route replacement with cache-busting query parameters;
- runtime `<style>` injection with broad `!important` selectors.

Repository search also found `MutationObserver` usage in multiple public and shell patches, including `PlatformTranslator`, `PublicHeroCopyNormalizer`, `PublicEntryCleanup`, `LoginHeaderExitButton`, `OpenLoginShellPatch`, `PublicDealPathCtaGuard`, `PlatformV7BlankScreenGuard` and others.

### CSS and runtime layer inventory

The platform-v7 layout imports 26 style sheets after its component imports. The platform-v7 template imports another 21 style sheets. The root layout additionally imports global platform-v7 fixes. The effective surface therefore has at least 47 platform-v7 stylesheet imports before component-level styles and runtime-injected styles are counted.

The template mounts runtime guards on both sides of route content. Public routes can receive:

- universal adaptive runtime styles;
- viewport runtime guard;
- blank-screen guard;
- public entry cleanup;
- registration patch;
- hero weight patch;
- header final lock;
- brand logo final replacement;
- login logo guard;
- support widget;
- placeholder cleanup using animation frame, timers and `MutationObserver`.

This confirms that the public surface is not controlled by one canonical styling and rendering boundary.

### Authentication boundary findings

1. The login response role is mapped on the client, written to `sessionStorage`, and copied into a Zustand store.
2. Middleware still contains legacy role resolution from path, `pc-role` cookie and query parameter `as`, then persists `pc-role`.
3. The web login route can create a gated demo session by deriving a role from the email prefix.
4. A dedicated signed cabinet session exists and prefers the verified access-token role, but direct body-role issuance is still available behind controlled-pilot/dev flags.
5. Open PR #2275 changes the API identity/session/MFA boundary and does not overlap the public web files modified by PR-1. It must be integrated before the final authentication acceptance pass.

## Open PR conflict assessment

| PR | Status at audit | Assessment |
| --- | --- | --- |
| #2275 Persistent identity, session rotation and MFA foundation | Open | Active auth work; do not overwrite. Required input for auth PR. |
| #2199 Unify platform v7 header across all pages | Open, non-mergeable, 50 commits | Stale overlapping implementation. Do not merge as-is. Supersede with the canonical shell branch. |
| #2206 Fix mobile logout hang | Open, non-mergeable | Explicit local hotfix using capture-phase interception. Root cause must be addressed in the later shell cleanup; do not stack it onto the new public shell. |
| #2144 Public demo/contact | Open | Contains obsolete three-CTA/demo terminology relative to the current target. Preserve only still-valid contact functionality. |

## PR-1 changes

- Introduced a canonical public locale button rendered in the header tree, not portalled into the DOM.
- Locale navigation now uses the existing middleware/server `next-intl` request boundary.
- Removed the public `HeaderLanguageSwitch` mount from `PlatformV7ShellSwitch`.
- Rebuilt `PublicSiteHeader` with CSS Modules and the canonical `BrandMark`.
- Rebuilt login visual shell with the same header and CSS Modules.
- Rebuilt the landing hero and product-proof surface with CSS Modules.
- Removed the third hero CTA.
- Removed role-specific login URLs and made role cards informational only.

## Explicitly deferred to controlled follow-up PRs

- complete removal of DOM translation runtime from protected cabinets;
- migration of all login copy into the central `next-intl` message catalog;
- dedicated forgot/reset password backend flow;
- removal of client role/session storage and legacy middleware role fallbacks;
- MFA UI wired to the persistent auth boundary;
- consolidation and deletion of the remaining CSS/guard patch layers;
- real-device browser matrix, production Lighthouse and Core Web Vitals evidence;
- production smoke test and rollback exercise.

## Baseline evidence limitations

Code inspection and repository history are confirmed. Visual screenshots, Lighthouse, VoiceOver/TalkBack, real iPhone testing and production percentile metrics require a running preview/production deployment and are not claimed by this document.
