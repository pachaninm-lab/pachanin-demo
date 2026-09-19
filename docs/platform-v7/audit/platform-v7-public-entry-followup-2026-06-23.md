# platform-v7 public entry follow-up — 2026-06-23

Follow-up PR target:

- File: `apps/web/app/platform-v7/page.tsx` only.

Fix:

- Convert Help icon to a real help/docs route or a disabled control with visible reason.
- Convert Menu icon to a real section/menu behavior or a disabled control with visible reason.

Keep:

- role cards route to `/platform-v7/login`;
- controlled-pilot wording;
- external integration caveat;
- mobile overflow guard.

Do not change:

- apps/landing;
- backend, DB, auth, session, API;
- package or lockfiles.
