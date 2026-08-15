# Production Acceptance — PC-CROP Federal Accounting

§U контракта: 100% только после доказанных journeys.
§S: только exact SHA, только governed release workflow, без ручных SSH-правок.

Статус: **НЕ НАЧАТО**. Ни один journey не выполнялся.

---

## 1. Блокер окружения

```
kind:   connect_rejected
detail: gateway answered 403 to CONNECT (policy denial or upstream failure)
host:   xn--80affnb9admdi3d.xn--p1ai:443
источник: $HTTPS_PROXY/__agentproxy/status
```

Из этой сессии недостижимы:
- `+10%` exact-SHA deployment каждого workstream;
- `+15%` production acceptance каждого workstream;
- весь workstream 17 (8%).

Итого потолок программы в этом окружении: **не более 75%** от каждого workstream,
даже при полностью снятых governance-блокерах.

## 2. Что означает «deployed» в этом репозитории

По `AGENTS.md` production-изменение завершено только когда одновременно:

1. виртуальный сервер REG.RU запускает целевой образ;
2. OCI-label `org.opencontainers.image.revision` совпадает с целевым Git-коммитом;
3. Caddy маршрутизирует домен на здоровый сервис;
4. live smoke на `https://процент-агро.рф` проходит.

Merge, зелёный CI и опубликованный GHCR-образ **не являются** доказательством деплоя.
Локальный маркер `apps/web/public/.well-known/pc-deploy.txt` содержит
`source_commit=22f6945d571ab715e33c37c47b23cf369c4c12d8`, но это файл в репозитории,
а не наблюдение живого сервера — как доказательство он не годится.

## 3. Seller journey (§69) — чек-лист, ни один пункт не выполнен

`registration` → `organization` → `MFA` → `invite accountant` → `accountant accepts` →
`Connection Center` → `1C` → `EDO` → `signer authority` → `deal` → `contract version` →
`shipments` → `weight` → `quality` → `SDIZ` → `EPD` → `final price` → `task` → `document` →
`deterministic validation` → `fraud/security preflight` → `signature` → `EDO` → `buyer` →
`seller 1C` → `prepayment/payment` → `services` → `reconciliation` → `period close` →
`closure snapshot`.

Предусловия отсутствуют начиная с шага 4: приглашение бухгалтера требует `job_profile`,
которого нет в схеме (EV-007).

## 4. Buyer journey (§70) — не выполнено

Требует `accounting_documents` и покупательскую проекцию — отсутствуют (EV-010).

## 5. Внешний бухгалтер (§71) — не выполнено

Требуется одна учётная запись в трёх организациях с нулевой утечкой по документам, платежам,
1С, ЭДО, ГЕКТЕ, задачам и секретам. Базовая изоляция тенантов существует (EV-008),
но сущности бух-контура ещё не созданы, поэтому проверять нечего.

## 6. Recovery (§76) — не выполнено

`RESTORE_PROVEN` требует реального упражнения. `autopilot-state.json` фиксирует restore как unproven.

## 7. Регрессии, обязательные перед любым production-релизом программы (§T)

- 9-ролевая регистрация #3785;
- отсутствие client-selected ролей;
- MFA/RLS не ослаблены;
- `/gekta` standalone isolation;
- runtime tuning #3896 не изменён.
