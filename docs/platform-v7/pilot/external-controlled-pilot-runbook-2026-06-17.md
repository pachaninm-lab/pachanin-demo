# External controlled pilot runbook — platform-v7

Дата: 2026-06-17
Контур: platform-v7 / «Прозрачная Цена»
Статус: external controlled pilot is blocked until fresh deploy is confirmed.

## 1. Founder decision

Do not distribute live links to external participants until the live deploy shows the latest main commit.

Required latest code checkpoint:

- role-lock PR merged: #1872
- merge commit: `a022621d6d6113039b510d30283c003c42556a4c`

Current rule:

- internal founder rehearsal: allowed;
- external participant run: blocked until deploy confirmation;
- production or fully live claim: forbidden.

## 2. Minimum go-live gate before sharing links

Before sending any link to a seller, buyer, elevator, carrier, lab, bank or observer, confirm all items below:

- [ ] live deploy commit is `a022621d6d6113039b510d30283c003c42556a4c` or newer;
- [ ] `/platform-v7` opens without stale UI;
- [ ] `/platform-v7/login` opens and shows one role selection entry;
- [ ] role selection locks current session;
- [ ] direct URL to another cabinet redirects back to the selected role home;
- [ ] driver role does not see bank/commercial control;
- [ ] bank role sees bank basis, not platform payment release;
- [ ] elevator role sees acceptance/weight/documents only;
- [ ] all visible copy avoids production-ready, fully live, bank connected, FGIS connected, EDO connected and payment guarantee claims.

## 3. Pilot participants

Minimum controlled pilot set:

1. Founder / operator — leads the run.
2. Seller — creates or validates the lot.
3. Buyer — creates or validates demand/RFQ.
4. Logistics coordinator — assigns route/vehicle.
5. Driver — confirms field events.
6. Elevator — fixes arrival, weight and acceptance status.
7. Lab — fixes quality result.
8. Bank observer — reviews bank basis only.
9. Arbitrator/observer — reviews dispute/evidence pack if deviation occurs.

Optional participants:

- compliance observer;
- region/agriculture observer;
- investor/bank product observer.

## 4. Data pack for pilot

Use one controlled transaction only.

Required fields:

- crop: wheat or another selected crop;
- volume: fixed test volume;
- seller organization;
- buyer organization;
- origin point;
- elevator/acceptance point;
- carrier/vehicle;
- expected quality indicators;
- expected weight tolerance;
- document list;
- payment/bank basis scenario;
- dispute trigger: quality or weight deviation.

Do not use confidential personal data unless consent and processing basis are confirmed.

## 5. Role links

Use the single entry first:

- public entry: `/platform-v7`
- role entry: `/platform-v7/login`

Do not send direct cabinet links to external users until the direct URL redirect behavior is verified on live deploy.

After verification, controlled direct role paths may be used only as operator-assisted links:

- seller: `/platform-v7/seller`
- buyer: `/platform-v7/buyer`
- logistics: `/platform-v7/logistics`
- driver: `/platform-v7/driver`
- elevator: `/platform-v7/elevator`
- lab: `/platform-v7/lab`
- surveyor: `/platform-v7/surveyor`
- bank: `/platform-v7/bank`
- compliance: `/platform-v7/compliance`
- arbitrator: `/platform-v7/arbitrator`
- operator: `/platform-v7/control-tower`
- executive: `/platform-v7/executive`

## 6. Pilot script

### Step 1 — operator opens the pilot

Operator explains:

- this is a controlled pilot run;
- external integrations are pre-integration/manual unless separately confirmed;
- platform does not guarantee payment;
- platform does not release money itself;
- bank basis is shown as a decision-support/evidence contour.

### Step 2 — seller enters

Seller validates:

- lot data;
- volume;
- quality expectation;
- documents;
- readiness blockers.

Pass criteria:

- seller understands what blocks the transaction;
- no bank/commercial functionality outside seller scope is exposed.

### Step 3 — buyer enters

Buyer validates:

- demand/RFQ;
- offer comparison;
- delivery basis;
- risk and payment conditions.

Pass criteria:

- buyer sees clean basis for decision;
- buyer does not bypass platform into off-platform negotiation during the run.

### Step 4 — logistics and driver

Logistics validates:

- route;
- carrier;
- vehicle;
- planned arrival;
- field events.

Driver validates:

- only own route and field actions;
- no money/bank/commercial data.

Pass criteria:

- driver role is field-grade and restricted.

### Step 5 — elevator and lab

Elevator validates:

- arrival;
- weight;
- acceptance;
- document status.

Lab validates:

- quality indicators;
- deviation;
- resulting blocker.

Pass criteria:

- quality/weight event changes transaction status and evidence pack.

### Step 6 — bank observer

Bank reviews:

- documents;
- weight;
- quality;
- dispute amount;
- bank basis;
- held amount.

Pass criteria:

- bank sees basis, not platform payment promise.

### Step 7 — dispute scenario

Trigger one controlled deviation:

- weight mismatch; or
- quality mismatch.

Arbitrator/observer reviews:

- issue amount;
- evidence pack;
- responsible party;
- next action.

Pass criteria:

- dispute is linked to money, documents, route, quality and evidence.

## 7. Pilot metrics

Measure during the run:

- number of manual operator actions;
- number of participant questions;
- pages where user got lost;
- time to understand role task;
- time to identify money blocker;
- time to find evidence;
- number of off-platform negotiation attempts;
- number of unclear terms;
- role leakage events;
- bank wording risk events.

## 8. Stop conditions

Stop the pilot if:

- live deploy is stale;
- participant enters wrong cabinet and stays there;
- bank/payment copy says or implies that the platform releases money;
- user can access another role without returning to login;
- confidential data is entered without agreed basis;
- participant believes this is a production financial guarantee;
- operator must manually explain every screen.

## 9. Result format

After the run, fill:

- pilot date;
- participants;
- deploy commit;
- scenario used;
- pass/fail by role;
- blockers found;
- manual actions count;
- legal/regulatory concerns;
- bank concerns;
- economic concerns;
- next code fixes;
- next partnership steps.

## 10. Current external blocker

As of this runbook creation, external sharing remains blocked until the fresh live deploy is confirmed.

Known infrastructure blockers:

- Vercel deployment is blocked externally;
- Deno deploy is failing;
- Railway deploy is failing;
- Netlify direct deploy tool returned a CLI command instead of completing a deploy.

Do not treat these as closed until a live URL proves the latest commit is running.
