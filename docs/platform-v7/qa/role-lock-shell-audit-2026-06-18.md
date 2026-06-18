# platform-v7 role-lock / shell audit — 2026-06-18

Status: controlled-pilot / pre-integration.

Scope checked after merge #1884 (`347a30573037d063fbd6ac3d0d3ddb41b3a947c0`):

- GitHub post-merge workflow runs for the merge commit were not present through the commit workflow endpoint.
- External statuses on the merge commit show Railway web success, Vercel blocked-account failures, and Deno deploy failure. Vercel was not touched.
- Current `main` still contains `AppShellV4` URL-based role inference (`setRole(inferred)`), which can visually/factually migrate a user into another cabinet after direct route entry.
- Current drawer still exposes `Сменить кабинет` from role-scoped shell.
- Current role navigation still has cross-cabinet entries for buyer → bank, logistics → driver/elevator/lab, bank → disputes, compliance → connectors/deals.
- `RbacCabinetGuard` and `cabinet-access-policy` are already present and strict by default, but shell navigation and URL inference must be normalized so runtime and UI policy match.

Do not merge stale draft PRs #1874/#1875 blindly: they target the same problem but are based on an older base and were marked red/draft.

Required next PR: `fix(platform-v7): lock role cabinets and normalize shell`.

Allowed scope: platform-v7 app/components/lib/tests/docs only. No landing, no Vercel, no live integrations, no production/live claims.
