# Exact task: fix stale live Chromium branding acceptance

Exact current main: `72d1a6ad7c277615430a58a9d357485ae34f6f5c`.

Create a new non-draft PR from exact current main. Restrict the diff to exactly:

- `.github/workflows/tai-restricted-qwen-reg-ru-activation.yml`
- `apps/web/next.config.js`
- `docs/platform-v7/autopilot/scopes/fix-qwen-live-ui-acceptance-v2.json`

Required corrections:

1. In the live Chromium acceptance, replace stale exact title `ИИ в агробизнесе` with `ИИ для агробизнеса`.
2. Replace stale exact subtitle `разработан Прозрачной Ценой` with `Разработан Прозрачной ценой для сельского хозяйства.`.
3. Update UI evidence JSON and issue comments to the same exact approved strings.
4. Verify exactly one visible `[data-pc-public-assistant-ai-mark="true"]`.
5. Preserve the existing checks for one native fullscreen control, no duplicate fullscreen control, empty state, quick actions, functional `Новый диалог`, successful answers, no fake platform citations, no alerts, no overflow and no page errors.
6. Add one runtime-neutral release comment to `apps/web/next.config.js` so merge triggers exact API/web/migration images and the accepted REG.RU activation path.
7. Rebind the source-controlled scope to the new branch and exact base, keeping status active and the same three-path allow-list.
8. No UI/runtime/model/API/RBAC/tenant/business logic changes. REG.RU remains the only production contour.

Run YAML parsing/workflow syntax, exact diff check and scope guard. Open the PR. Do not claim success until exact images, private-model authentication, RU/EN/ZH SSE and Chromium acceptance all pass.