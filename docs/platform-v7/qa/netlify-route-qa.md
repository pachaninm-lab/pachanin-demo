# Netlify / Live Route QA — Master-ТЗ 3+ §40

Активный host (baseline §9): `https://vermillion-kitsune-0e7b97.netlify.app`
Вторичный (исторический): `https://gleaming-mandazi-bb9856.netlify.app`
Primary (заблокирован, non-fatal): Vercel `https://pachanin-web.vercel.app`

## Автоматический гейт

Workflow `.github/workflows/platform-v7-dual-hosting-smoke.yml` на каждый push в `main`:
- **Жёсткий гейт** — новый Netlify-хост проверяется по ключевым маршрутам (curl `--fail`):
  - `/platform-v7/`
  - `/platform-v7/control-tower`
  - `/platform-v7/buyer`
  - `/platform-v7/bank`
  - `/platform-v7/driver/field`
  - `/platform-v7/register`
  - `/platform-v7/login`
- Вторичный Netlify и Vercel — некритичный пинг (warning), пока аккаунт Vercel заблокирован.

## DoD §40

| Критерий | Статус |
|----------|--------|
| Netlify deploy green | ✓ (deploy-preview + production на каждом PR) |
| Маршруты открываются | ✓ (жёсткий smoke-гейт по списку выше) |
| UI соответствует роли | ✓ (RBAC + role lens, см. матрицу вопросов §A) |
| Нет demo/pilot/mock/sandbox в UI | ✓ (copy-гарды + M3-1 убрал «демо» из /login) |
| Нет fake-live claims | ✓ (honesty-гарды §3) |
| Нет длинных скроллов с мусором | partial (UX-gate сквозной — M3-3) |
| Mobile 390×844 | partial (mobile e2e; финальный field QA — M3-6) |
| Control Tower = target visual reference | ✓ (премиум KPI-band + radar; полировка по мокапам в визуальной полосе) |

## Ручная проверка (выполняет владелец на живом deploy)

Открыть каждый маршрут из списка на `vermillion-kitsune-0e7b97.netlify.app`, проверить:
роль видна, деньги/блокер/действие читаются за 5–10 секунд, нет визуального мусора,
на мобильном нет горизонтального скролла.
