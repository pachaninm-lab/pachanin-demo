# platform-v7 shell persistence root cause

Observed defect:
- Protected operator/control-tower screen can appear without the platform header and bottom role dock after navigation from the public entry/login flow.
- The same route can look correct after a hard reload.

Root cause:
- `apps/web/app/platform-v7/layout.tsx` selected between a public no-shell tree and a protected `AppShellV4` tree using the request pathname from server headers.
- In the Next.js app router, a layout is persistent across client-side navigation inside the same segment.
- If the user enters through a public route, the no-shell layout tree can remain mounted while a protected child route is rendered underneath it.
- Result: protected content appears without `.pc-v4-header`, `.pc-v7-role-dock` / bottom navigation and shell actions.

Fix direction:
- Keep a single stable platform-v7 shell boundary mounted for the whole segment.
- Hide the shell only for explicit public routes from a client controller using the live pathname.
- Protected routes must never depend on the initial server pathname to receive header, tools and bottom navigation.

Safety:
- No live-readiness claim.
- No backend/API/DB/package/lockfile change.
