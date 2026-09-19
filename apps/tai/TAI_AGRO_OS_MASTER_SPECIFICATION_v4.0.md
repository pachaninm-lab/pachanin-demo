# TAI Agro OS Master Specification v4.0 — repository execution control copy

**Status:** owner-approved final specification  
**Repository:** `pachaninm-lab/pachanin-demo`  
**Platform:** «Прозрачная Цена»  
**Infrastructure:** existing REG.RU only  
**New recurring cost:** 0 RUB  
**Primary model:** local Qwen3-8B  
**Languages:** RU / EN / ZH

The companion document `TAI Agro OS Master Specification v4.0` is the complete human-readable edition. This repository copy controls implementation order, authority boundaries and acceptance.

## 1. Product objective

TAI Agro OS is one commercial agricultural intelligence platform spanning land and soil, season planning, seeds and genetics, crop production, livestock, machinery, feed and resources, harvesting, storage and processing, laboratory and quality, logistics, trade, documents, money readiness, risk, disputes and management analytics.

TAI must support field, farm, livestock complex, greenhouse, elevator, laboratory, service centre, transport company, trader, bank, insurer, 1C/ERP/EDI/TMS/WMS/LIMS environments and executive management.

TAI must answer, analyse, calculate, detect deviations, compare scenarios, prepare plans and documents, and accompany work inside server-authorized permissions. It must not autonomously execute critical or financial actions.

## 2. Product composition

The single user-facing TAI consists of:

1. local models;
2. governed sector knowledge;
3. agricultural ontology;
4. specialized agents;
5. deterministic calculators;
6. safe tools;
7. integrations;
8. event monitoring;
9. quality evaluation;
10. commercial administration.

The UI must not expose model names, fallback labels, internal knowledge labels, reasoning, tool calls, infrastructure routes, technical codes or internal outage diagnostics.

## 3. Non-negotiable constraints

- No new server, paid LLM API, paid sector database, paid vector database, satellite subscription, SaaS subscription or enterprise-system licence without a separate written owner decision.
- No Netlify or Vercel.
- Preserve server-authoritative state, PostgreSQL authority, tenant isolation, RBAC, RLS, MFA for sensitive operations, audit, outbox, idempotency and optimistic concurrency.
- Role and tenant are never client-selected.
- No autonomous financial action and no access to another tenant’s data.
- Do not invent platform functions, machinery specifications, fault codes, agronomic regulations, veterinary medicines, doses or connected integrations.
- A prepared draft is not an executed action.
- Merge is not production evidence. Production PASS requires exact-main REG.RU live acceptance.

## 4. Product line

- TAI Core — models, orchestration, access policy, audit and metrics.
- TAI Crop — fields, technologies, yield and economics.
- TAI Livestock — herd, feeding, production and welfare.
- TAI Machinery — operation, maintenance, diagnostics, parts and fleet.
- TAI Expert — documents, tables, calculations and corporate knowledge.
- TAI Trade — Deal, quality, logistics, documents, money readiness and disputes.
- TAI Enterprise — 1C, ERP, CRM, EDI, TMS, WMS, LIMS and BI.
- TAI Field — mobile work in field, farm and production sites.
- TAI Connect — API, SDK and connector factory.
- TAI Admin — organizations, roles, sources, quality, quotas and audit.

## 5. Domain coverage

### Crop

Crops, soil and land resources, season planning, seed lots and planting material, plant nutrition, irrigation, plant protection with strict source and registration limits, field operations, yield, harvesting, post-harvest treatment, storage and economics.

### Livestock

Dairy and beef cattle, pigs, poultry, sheep, goats, horses, rabbits, bees, deer, fur animals, aquaculture, breeding, animal and herd registry, reproduction, feeding, feed production, productivity, health observations, biosecurity, microclimate, welfare, manure and product quality.

TAI may detect deviations and prepare data for a specialist. It may not make a final veterinary diagnosis, prescribe restricted medicine, invent dosage, replace a veterinarian, or independently decide slaughter, euthanasia or product restrictions.

### Machinery

Tractors, combines, loaders, tillage, seeding, spraying, fertilizing, forage, specialized harvest, irrigation, livestock equipment, storage equipment, transport, greenhouse, garden, lawn, municipal, forestry, attachments and autonomous platforms.

Canonical machine identity must include manufacturer, model, generation, variant, year, serial range and configuration. Specifications, fault codes, fluids, parts compatibility, firmware, CAN, ISOBUS and telematics require model-specific evidence. TAI must not bypass safety interlocks or provide unsafe instructions for a running machine.

### Agribusiness

Organization, counterparties, contracts, lots, offers, Deal, delivery, laboratory, quality, documents, payments, disputes, evidence, warehouse, route, vehicle, integration, users, roles and permissions.

## 6. Canonical ontology

The normative v4 entity registry is implemented in `tai/agro_ontology.py` and includes 90 canonical names across four domains:

- Crop: LandParcel through StorageLot.
- Livestock: Animal through AnimalMovement.
- Machinery: Manufacturer through TelematicsSignal.
- Agribusiness: Organization through Permission.

Unknown names fail closed. The registry does not itself prove operational capability.

## 7. Specialized agents

Required agent families:

- Crop: chief agronomist, agrochemist, seed, nutrition, irrigation, protection, field technology, yield and storage specialists.
- Livestock: chief livestock specialist, feeding, reproduction, veterinary analytics, biosecurity, microclimate, dairy, meat, poultry and pig specialists.
- Machinery: engineer, mechanic, service adviser, diagnostician, parts, fleet dispatch, ISOBUS, telematics and small-equipment specialists.
- Agribusiness: executive, economist, financier, buyer, logistician, trader, laboratory specialist, lawyer, dispute specialist, 1C integrator and data analyst.

Each agent must have explicit tools, sources, rights, restrictions, response contract, evaluation set and handoff rules.

## 8. Deterministic calculations

Critical values are calculated by versioned code, not by text generation.

Required calculator groups:

- Crop: seeding rate, density, seed requirement, nutrient balance, fertilizer and water demand, operation capacity, material use, operation cost, production cost, break-even, margin, storage, drying loss, settlement weight and blending.
- Livestock: feed requirement, dry matter, ration cost, feed conversion, daily gain, gain cost, milk per head, reproduction KPI, housing load, water, manure, bedding, production forecast, culling and replacement.
- Machinery: hectares/hour, field time, fuel, machine-hour cost, operation cost, fleet load, downtime, power selection, draft, soil pressure, hydraulic demand, calibrations, sprayer rate, combine and mower capacity, maintenance plan and ownership cost.

The first accepted implementation slice is `tai/agro_calculators.py`. Formula results must include calculator ID, formula version, inputs, unit, warnings and specialist-confirmation flag where required.

## 9. Documents and provenance

Required inputs include PDF, DOCX, XLSX, CSV, TXT, images, scans, manuals, service documents, laboratory protocols, technology maps, rations, veterinary logs, breeding documents, contracts, invoices, certificates, reports, telemetry and sensor data.

A critical conclusion must be traceable to source, document, page, table, row, cell, date and version. Document/vision operational acceptance remains a separate stage.

## 10. Event TAI

Required event families cover delayed crop operations, resource deficits, rate deviations, moisture and yield risk, storage capacity, livestock intake/productivity/microclimate/reproduction/feed/behaviour/veterinary/equipment deviations, and machinery maintenance, fuel, downtime, overheating, ECU, pressure, signal, load, capacity and parts deficits.

Initial authority: notify, explain, prepare an action and request confirmation. Current production release remains informational/read-only until separately authorized.

## 11. Integrations

Target protocols and systems: REST, OData, SOAP, webhooks, CSV, XLSX, JSON, XML, SFTP, read-only PostgreSQL, file exchange, telematics, sensors, LIMS, TMS, WMS, ERP, 1C, EDI, FMIS, herd, milking, feeding, microclimate, navigation and ISOBUS.

An integration is connected only after separate technical acceptance.

## 12. Quality system

Create one TAI Evaluation Corpus with at least 45,000 scenarios:

- Crop: 10,000.
- Livestock: 10,000.
- Machinery: 12,000.
- Agribusiness and trade: 5,000.
- Enterprise systems: 3,000.
- Safety and access rights: 3,000.
- RU/EN/ZH and UI: 2,000.

Evaluation must cover factual accuracy, formula correctness, provenance, freshness, object identity, non-fabrication, safety, abstention, tenant/role isolation, absence of reasoning exposure, languages and mobile behavior.

## 13. Implementation order

1. TAI Always-On Core.
2. Unified Agro Knowledge Core.
3. TAI Crop.
4. TAI Livestock.
5. TAI Machinery.
6. TAI Expert.
7. TAI Trade.
8. TAI Enterprise and Connect.
9. Event agents.
10. Commercial contour.

The machine-readable exact-main baseline is `governance/tai-agro-os-v4-capability-matrix.v1.json`.

## 14. Definition of Done

A capability is complete only when:

- code is in main and the branch was not behind at merge;
- required checks pass and review threads are closed;
- exact-main is deployed on REG.RU;
- live RU/EN/ZH and mobile acceptance pass;
- real streaming is confirmed;
- no new recurring cost exists;
- no cross-tenant leak or unsupported action exists;
- no invented machinery, veterinary or agronomic fact exists;
- critical calculations run in code;
- every critical fact has provenance;
- documentation matches implementation;
- rollback and evidence are prepared.

## 15. Execution command

Implement TAI Agro OS v4 sequentially from an exact-main audit. Do not declare a capability ready before exact-head merge, exact-main REG.RU deployment and live acceptance. Preserve truthfulness, safety, tenant isolation and zero autonomous critical actions.
