# Platform V7 QA report

## Status

Platform V7 is at controlled-pilot finish level for the current simulation scope.

The current contour is not presented as live-integrated. External systems are represented as named simulation contours that follow the intended transaction logic.

## Current production commit

`280ec267884679e7358a50733d93afff94277e8b`

Vercel status checked: `pachanin-canonical-web = success`.

## Covered execution chain

`LOT-2403 → bid → DL-9106 → reserve → LOG-REQ-2403 → TRIP-SIM-001 → receiving → documents → payout gates → dispute/evidence`

## Role coverage

### Seller

- sees lots;
- sees buyer bids in anonymized form;
- sees buyer ratings as numeric values;
- sees winner and deal chain;
- sees when money can be received;
- sees why payout is stopped.

### Buyer

- sees available lots;
- sees own bid status;
- sees reserve readiness;
- sees Sber Credit as buyer financing only;
- does not create a false seller credit line.

### Logistics

- sees orders, driver, vehicle, route, ETA and incidents;
- sees ETRN, GIS EPD and SDIZ transport gates;
- does not see grain bids, grain price, bank reserve or buyer financing.

### Driver

- sees only trip, route, map, trip documents and field actions;
- sees ETRN, GIS EPD, seal and loading photo;
- does not see money, bids, bank, reserve or buyer analytics.

### Receiving

- sees trip, cargo, declared weight, received weight, deviation, quality and acceptance act;
- sees COK APK quality protocol state;
- does not see bids, bank, reserve or buyer financing.

### Bank

- sees reserve, payout waterfall, holding, payout gates and reasons for stop;
- does not get a direct payout button without guard conditions.

### Operator

- sees blockers, affected amount, source, responsible party and next action;
- has quick links to Deal 360, documents, logistics, receiving and disputes.

### Disputes

- shows why money is not released;
- shows holding amount, responsible party, next action and evidence pack;
- requires decision, amount, basis and journal record for closure.

## Named integration contours

- Sber Safe Deals;
- Sber Credit;
- FGIS Grain;
- Kontur Diadoc;
- Saby ETRN;
- GIS EPD;
- CryptoPro DSS;
- ATI.SU;
- Wialon;
- Yandex Maps;
- COK APK.

All listed contours remain simulation/pilot representations unless real contracts, credentials and live access are provided.

## Smoke route list

The web smoke script now checks the current controlled-pilot surface:

- `/platform-v7`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`
- `/platform-v7/driver`
- `/platform-v7/elevator`
- `/platform-v7/bank`
- `/platform-v7/operator`
- `/platform-v7/disputes`
- `/platform-v7/documents`
- `/platform-v7/connectors`
- `/platform-v7/deals/DL-9106/clean`
- `/platform-v7/lots/LOT-2403`

## Risk status

### Closed inside current simulation

- seller payout logic is not shown as instant after bid;
- Sber Credit is kept on buyer side;
- driver does not see money or bids;
- logistics does not see bids or bank reserve;
- receiving does not see bank, bids or buyer financing;
- named provider contours are visible without live claims;
- seller bid grid is adaptive for mobile.

### Still outside this scope

- live Sber Safe Deals integration;
- live FGIS Grain integration;
- live Diadoc integration;
- live Saby ETRN / GIS EPD integration;
- live Wialon integration;
- real KEP signing;
- real COK APK protocol exchange;
- real payments and reconciliation;
- real user authentication, permissions and audit hardening.

## Final assessment

The platform now behaves as a coherent controlled-pilot simulation of grain transaction execution rather than a disconnected marketplace demo.

The remaining work is not UI assembly; it is live integration, contracts, credentials, operational pilot validation and production-grade security/audit hardening.
