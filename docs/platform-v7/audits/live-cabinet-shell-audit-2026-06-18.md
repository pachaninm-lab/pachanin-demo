# platform-v7 live cabinet shell audit — 2026-06-18

Status: controlled-pilot / pre-integration.

Scope: live Netlify/current main audit after PR #1887, #1888 and #1889.

## Confirmed repo state

- Public role cards were rerouted through `/platform-v7/login` in PR #1887.
- Mobile public process block was changed from horizontal scroll tiles to a single-column mobile layout in PR #1888.
- Header calculator widget was added in PR #1889 and mounted inside `PlatformV7LayoutClient`.
- Stale role-lock rewrite PRs #1874 and #1875 are closed and not merged.
- Stale trace/audit PR #1852 is closed and not merged.

## Static audit findings

### 1. AI entry is still too global

`apps/web/lib/platform-v7/shellRoutes.ts` still adds `AI_ITEM` to every role navigation.

Risk:
- User can feel that the AI button throws them out of the current cabinet.
- AI page has internal role filtering, but the shell entry is visually global and not clearly tied to the current role.

Required fix:
- Keep AI available, but make entry role-bound.
- Pass `from=<current pathname>` when opening AI from shell/nav.
- AI page must show clear “return to my cabinet” action.
- Driver AI must return only to driver route.

### 2. Command palette can still expose broad cross-role surfaces

`apps/web/components/v7r/CommandPalette.tsx` builds its index from `platformV7CommandSectionItems()` plus deals/lots/disputes.
`apps/web/lib/platform-v7/command.ts` still includes role switch, investor, bank, operator, seller, buyer and other broad section entries.

Risk:
- Even if public cards go through login, command palette may still expose role/cabinet migration paths.
- This contradicts single-entry and role-lock requirements.

Required fix:
- Filter command palette entries by active role.
- Remove `/platform-v7/roles` from command palette after login.
- Do not show role-inappropriate cabinet entries.
- Keep shared execution screens only where role contract allows them.

### 3. Current AppShellV4 does not include the closed PR #1874 role-owner guard

`AppShellV4` on current main still uses `usePathname` only and does not include a runtime redirect guard from the closed rewrite PR.

Risk:
- Direct URL access to another cabinet can still render wrong role/shell context unless middleware/client guards elsewhere catch it.
- Visual access leakage remains possible.

Required fix:
- Do not revive #1874 wholesale.
- Extract only narrow safe parts:
  - role-owned route map;
  - shared-route allowlist;
  - client redirect to current role home for foreign cabinet paths;
  - tests.

### 4. Header is now functional, but crowding risk increased

Calculator added one more icon into `.pc-v4-actions`.

Risk:
- On 390px mobile, header can become crowded: search + stage + theme + calc + notifications.
- Header crowding may reintroduce horizontal pressure.

Required fix:
- Add mobile shell test/static guard for header action count and no horizontal overflow.
- Consider hiding text label inside search on mobile if overflow appears.

## Next safe PR

Recommended PR title:
`fix(platform-v7): role-bound shell navigation and AI entry guard`

Allowed files:
- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/components/v7r/CommandPalette.tsx`
- `apps/web/lib/platform-v7/shellRoutes.ts`
- `apps/web/lib/platform-v7/command.ts`
- `apps/web/tests/unit/platformV7RoleRoutes.test.ts`
- new focused tests under `apps/web/tests/unit/`
- this audit doc if needed

Forbidden:
- no `apps/landing`
- no backend/DB/live integration
- no Netlify/Vercel config changes
- no fake-live or production-ready claims
- no broad rewrite from #1874/#1875

Acceptance criteria:

1. Public entry remains through `/platform-v7/login`.
2. Header calculator remains available only inside shell.
3. AI entry from shell keeps user inside role context and passes current screen as `from`.
4. AI allowed actions remain role-filtered.
5. Command palette does not show `/platform-v7/roles` after login.
6. Command palette does not show foreign role cabinets.
7. Direct foreign cabinet path returns to current role home or shows access boundary without cabinet migration.
8. Bottom nav keeps only role-safe primary destinations.
9. Driver bottom nav remains field-grade and does not expose bank/buyer/seller/operator cabinets.
10. Mobile 390px shell does not horizontally overflow.
11. Tests cover role leakage, AI entry, command palette filtering and calculator presence.
12. CI/typecheck/build/web-unit/autopilot guard pass.
