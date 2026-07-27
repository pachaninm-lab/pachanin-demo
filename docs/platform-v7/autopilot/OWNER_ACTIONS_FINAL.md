# OWNER_ACTIONS_FINAL

Единый список действий, которые **не может выполнить ни один коммит в этом
репозитории**. Их выполняет владелец во внешних системах или отдельным
governance-решением.

Дата составления: 2026-07-26.

---

## 1. Отключить внешнюю интеграцию Netlify — открыто

**Почему это не чинится кодом.** Netlify-бот продолжает создавать deploy
previews и check-runs, потому что GitHub App и два проекта Netlify подключены
к репозиторию **снаружи**. В самом репозитории после удаления Netlify не
осталось ни `netlify.toml`, ни build-плагина, ни deploy-workflow, ни
`@netlify/plugin-nextjs` — сборке Netlify не из чего собирать, но App
по-прежнему подписан на события и продолжает отмечаться в PR.

**Что сделать (любой из двух путей):**

1. Отключить Git-интеграцию у обоих проектов Netlify:
   - `gleaming-mandazi-bb9856`
   - `vermillion-kitsune-0e7b97`

   Netlify → проект → *Site configuration* → *Build & deploy* → *Continuous
   deployment* → *Unlink repository*.

2. Либо удалить Netlify GitHub App из репозитория целиком:
   GitHub → *Settings* → *Integrations* → *GitHub Apps* → Netlify →
   *Configure* → убрать `pachaninm-lab/pachanin-demo` из доступа.

**Как проверить, что подействовало.** Открыть любой новый PR и убедиться,
что в списке checks больше нет:

- `Header rules - gleaming-mandazi-bb9856`
- `Header rules - vermillion-kitsune-0e7b97`
- `Redirect rules - gleaming-mandazi-bb9856`
- `Redirect rules - vermillion-kitsune-0e7b97`
- `Pages changed - gleaming-mandazi-bb9856`
- `Pages changed - vermillion-kitsune-0e7b97`
- `deploy-preview` / `netlify/*` статусов

**Блокирует ли это merge.** Нет, пока эти checks не являются required branch
checks. Они возвращают `neutral` или `pending` и не входят в repository-owned
gates. Merge после полного PASS собственных гейтов репозитория задерживать
из-за них не нужно. Если же какой-то из них окажется в required-списке —
убрать его оттуда: он не может стать зелёным, потому что собирать больше
нечего.

---

## 2. Устаревший комментарий в `automerge.yml` — открыто

`.github/workflows/automerge.yml`, строки 25–26:

```
# Production is deployed by the Netlify Git integration on push to main
# (see netlify.toml). No CI-driven deploy job is required here.
```

Оба утверждения уже неверны: Netlify выведен, `netlify.toml` удалён,
production разворачивается exact-SHA релизом на виртуальный сервер REG.RU.

Исправление было подготовлено, но **откачено** из PR #3247 по требованию
ревью: путь `.github/workflows/automerge.yml` не входил в зарегистрированный
scope ветки, а расширять PR ради комментария нельзя. Нужен отдельный
governance-authorized PR с этим путём в scope.

Изменение косметическое: комментарий, не исполняемый код. Задерживать из-за
него ничего не нужно.

---

## 3. Проверка `health/ready` в `check-production-web-hardening.mjs` — открыто

`scripts/check-production-web-hardening.mjs` требует в
`apps/web/app/api/health/ready/route.ts` литеральную подстроку:

```
'Cache-Control': 'no-store, max-age=0'
```

Роут отдаёт заголовок строже:

```
'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
```

Семантически это надмножество требуемого, но подстроковое сравнение
разъехалось, и `Production Hosting Authority` падает на любом push в main,
который затрагивает её trigger paths.

Воспроизведено на чистом worktree `origin/main` — байт в байт тот же вывод.
Предсуществующий дефект, не связанный ни с удалением Netlify, ни с TAI.
Требует отдельного узкого PR: либо привести литерал проверки в соответствие
с роутом, либо сделать проверку семантической (`no-store` **и** `max-age=0`
присутствуют), а не подстроковой.

---

## Что закрыто и подтверждено в коде

Эти пункты действий владельца не требуют — они выполнены и защищены
проверками:

- `netlify.toml`, `scripts/netlify-ignore.sh`, Netlify runtime/hotfix workflow
  и dual-hosting smoke удалены;
- `@netlify/plugin-nextjs` снят из `package.json` и `pnpm-lock.yaml`;
- production smoke, playwright и `next.config.js` направлены только на
  `процент-агро.рф`;
- `FORBIDDEN_PRODUCTION_PROVIDERS = {VERCEL, NETLIFY}` в
  `apps/tai/tai/industrial_gap_report.py`;
- `scripts/check-production-hosting-authority.mjs` запрещает stale-утверждения
  о Netlify и требует записей об отставке;
- `seo-live-smoke` и `indexnow-submit` запускаются только после принятого
  exact-SHA релиза, а не на push в main;
- датированные audit- и DD-записи не переписаны.
