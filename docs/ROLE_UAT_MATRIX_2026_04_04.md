# Role UAT matrix · 2026-04-04

## Цель

Пройти продукт не по экранам, а по законченным ролям и объектам сделки.

## Роли

### 1. Farmer / seller
Путь:
- cabinet -> lots -> lot detail -> shortlist / auction -> deal -> documents -> payments.
Критерий PASS:
- нет dead-end;
- есть next step;
- документы и деньги не теряются после выбора buyer.

### 2. Buyer
Путь:
- market / lots -> bid -> award / deal -> receiving -> quality -> settlement -> release.
Критерий PASS:
- сделка не распадается после торгов;
- quality delta и payment readiness видны из одного контура.

### 3. Logistician
Путь:
- dispatch -> route -> slot -> incident -> receiving handoff.
Критерий PASS:
- рейс, slot и receiving живут как один execution contour.

### 4. Driver
Путь:
- driver-mobile -> accept -> checkpoints -> incident -> handoff.
Критерий PASS:
- offline не ломает критические этапы;
- incident не ведёт в тупик.

### 5. Lab
Путь:
- lab queue -> protocol -> retest -> dispute influence.
Критерий PASS:
- протокол сразу влияет на settlement/dispute.

### 6. Elevator / receiving
Путь:
- queue -> weighbridge -> unload -> acceptance -> release gate.
Критерий PASS:
- после приёмки есть money handoff, а не обрыв.

### 7. Accounting / finance
Путь:
- payments -> worksheet -> hold/release -> reconciliation.
Критерий PASS:
- release объясним reason codes;
- нет тихого bypass hold.

### 8. Executive
Путь:
- cabinet / executive -> deals -> payments -> disputes -> blockers.
Критерий PASS:
- руководитель видит деньги, blockers и owner без лишнего шума.

### 9. Support manager / operator
Путь:
- operator cockpit -> anti-fraud -> support -> disputes -> runtime ops.
Критерий PASS:
- escalation имеет owner, SLA и route.

### 10. Admin
Путь:
- connectors -> audit -> runtime ops -> policy surfaces.
Критерий PASS:
- system surfaces не смешаны с клиентскими.

## Обязательные сценарии для UAT

- lot -> match -> deal;
- deal -> docs;
- deal -> receiving -> lab -> settlement;
- hold / release;
- dispute;
- operator escalation;
- mobile offline replay.

## Стоп-критерии

UAT не считается пройденным, если:
- есть dead-end без next step;
- есть green status без owner;
- release не объяснён reason codes;
- offline ломает terminal stages;
- operator escalation не имеет SLA.
