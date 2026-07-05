# Platform V7 i18n rollout status — 2026-07-05

## Scope

This note tracks the current i18n rollout for `/platform-v7` after the public-page and protected-shell translation work.

## Confirmed implemented

- Public hero intelligence block: localized client component.
- Login and role selection: localized client component.
- Contact page: localized client component.
- Register page: localized client component and route attachment.
- Demo page: localized client component and route attachment.
- Docs page: localized client component and template attachment.
- Protected shell: scoped role-cockpit i18n guard attached in platform layout.
- Dictionary guard: English and Chinese dictionary consistency check exists.

## Build status

The web build check `@pc/web` passed on commit `861b6a407a0de1de918327103e66a0daa9acef45`.

Legacy Vercel and Deno checks are not considered valid platform-v7 gates because those deployment circuits are blocked or deprecated for this project.

## Remaining work

1. Replace the scoped role-cockpit guard with direct localized copy modules per role cockpit.
2. Start with seller, buyer, bank, elevator, lab, logistics.
3. Add a route-level i18n verification gate after each role cockpit is converted.
4. Keep DOM translation only as a temporary fallback for legacy fragments.

## Rule

Do not claim full i18n completion until every role cockpit has direct localized copy and the fallback layer can be removed.
