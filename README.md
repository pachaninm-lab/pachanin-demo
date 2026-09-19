# Pachanin

## Production smoke

Production URL:

- Web: `https://процент-агро.рф`

After every meaningful production deploy run these GitHub Actions manually if the automatic schedule has not run yet:

1. `Production Smoke`
   - `web_url`: `https://процент-агро.рф`
   - `api_url`: optional. Leave empty if no stable public API URL is configured.
   - Checks critical `platform-v7` routes through `pnpm smoke:web`.

2. `Mobile Smoke`
   - `web_url`: `https://процент-агро.рф`
   - Checks critical `platform-v7` routes at 375px and verifies no horizontal overflow.
   - Also runs visual smoke checks for visible brand/header and broken visible images.

Current critical web routes:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/deals`
- `/platform-v7/deals/DL-9102`
- `/platform-v7/buyer`
- `/platform-v7/compliance`
- `/platform-v7/field`
- `/platform-v7/disputes/DK-2024-89`

Red signals:

- HTTP status is not 2xx.
- Rendered body is empty or suspiciously small.
- Horizontal overflow exists on 375px viewport.
- Header or `Прозрачная Цена` brand is not visible.
- Any visible image is broken.

Response rule:

- Do not merge new runtime work on top of a red production smoke.
- Fix the failing route first.
- Keep each fix as a small PR.
- Confirm the exact-SHA release is live on the virtual server before the next deploy.
  A merge or a green CI run is not evidence that production changed.
