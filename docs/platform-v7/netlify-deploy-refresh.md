# Netlify deploy refresh

Purpose: safe docs-only marker to force the active Netlify production chain to rebuild `main` after the mobile login hierarchy and human-copy corrections.

Latest verified main commit before this refresh: `10a09ba484114c6361da6cd4830842e2a1e6fb2e`.

Active production host: `https://процент-агро.рф/platform-v7/`.
Netlify project: `vermillion-kitsune-0e7b97`.

Refresh marker timestamp: 2026-07-12T14:07:00Z.

Scope:
- no additional runtime changes in this marker;
- no API, DB, RBAC, MFA or live-integration changes;
- deploy trigger only;
- production must include PR #2394 and PR #2398.

Expected production content:
- decorative security cards and field icons are absent from the login task;
- the mobile form hierarchy is compact and the primary action is reachable without decorative obstruction;
- the focused field has one visible focus treatment, not a nested double ring;
- RU uses `Войти`, `Электронная почта` and `Забыли пароль?`;
- EN and ZH use the corresponding direct, familiar wording;
- server-authoritative authentication, MFA continuation, session handling and role resolution remain unchanged.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up commit `10a09ba484114c6361da6cd4830842e2a1e6fb2e` instead of the previous production commit `98d20bbe3eddfb7ca5d65a766678bc1177118a24`.
