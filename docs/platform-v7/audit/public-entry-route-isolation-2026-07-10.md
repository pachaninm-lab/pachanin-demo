# Public entry route isolation — 2026-07-10

## Decision

The landing, login and password-recovery routes now live under the App Router route group:

`apps/web/app/(platform-public)/platform-v7`

The URL surface is unchanged:

- `/platform-v7`;
- `/platform-v7/login`;
- `/platform-v7/forgot-password`;
- `/platform-v7/reset-password`.

The route group gives these pages a minimal layout instead of inheriting the legacy `apps/web/app/platform-v7/layout.tsx` and `template.tsx` stack.

## Root cause removed

Before this change, the public entry inherited:

- the protected platform shell switch;
- route template guards before and after every page;
- more than forty platform-specific stylesheet imports;
- runtime viewport and blank-screen guards;
- post-render header/logo replacement;
- public entry cleanup;
- hero and registration patches;
- the legacy support widget.

These layers could independently mutate layout, styles or content after hydration. Hiding individual symptoms with another override would not provide a stable public entry.

## What changed

- moved landing, login, forgot-password and reset-password into a dedicated route group;
- deleted the duplicate page/layout files under the legacy platform directory;
- added a minimal public layout with only the canonical support widget;
- removed the dead canonical-public branch and support import from `PlatformV7TemplateGuards`;
- added explicit bounded loading and error states;
- added a correlation reference without exposing internal errors;
- retained the same URLs and public business flow;
- updated static gates that previously required role query parameters or client role handoff.

## Runtime layers no longer mounted on the isolated routes

- `PlatformV7ShellSwitch`;
- `PlatformV7TemplateGuards`;
- `PlatformV7UniversalAdaptiveStyle`;
- `PlatformV7ViewportRuntimeGuard`;
- `PlatformV7BlankScreenGuard`;
- `PublicEntryCleanup`;
- `PublicRegistrationEntryPatch`;
- `PublicHeroWeightPatch`;
- `PublicHeaderFinalLock`;
- `PublicBrandLogoFinal`;
- `LoginHeaderLogoGuard`;
- legacy `ChatSupportWidget`.

They remain available only for routes that have not yet been migrated. This PR does not claim that the whole protected platform is free of legacy patches.

## CSS exception register

The landing CSS module currently contains two narrow `!important` declarations on the primary and secondary CTA text colour. They compensate for the higher-specificity shared `.page a` colour rule inside the same CSS Module. They are not global overrides and do not participate in the legacy cascade. They must be removed when the landing module is moved wholly into the route group and its link selector is narrowed. No other new public-route stylesheet uses `!important`.

## Evidence established by code and tests

- physical absence of the old landing/login/recovery page files;
- isolated route layout contains no shell switch or template guards;
- legacy guards contain no reference to the isolated entry paths or public support widget;
- login contains no role query parsing, local/session storage role handoff or client role store;
- loading and error states are visible and bounded;
- RU/EN/ZH system-state catalogs have structural parity;
- authentication pages remain `noindex`/`nofollow`.

## Evidence not yet established

This change alone does not prove:

- production build success;
- Lighthouse or 75th-percentile Core Web Vitals;
- real-device Safari/Chrome behaviour;
- VoiceOver or TalkBack completion;
- external auth, email delivery or production MFA;
- production smoke or rollback execution.

Those checks belong to the final QA and deployment acceptance stage. Until they pass, the correct status is **implemented in an open PR, not production-confirmed**.
