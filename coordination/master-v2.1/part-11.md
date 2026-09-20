Capability: MKT-06. Проверка: BYOD E2E. Evidence: External-origin deal evidence.

**MASTER53:REQ-ECO-001** — Net/landed price is reproducible from snapshots

Capability: ECO-01. Проверка: Landed economics regression. Evidence: Deal evidence package.

**MASTER53:REQ-ECO-002** — Customer ROI never fabricated

Capability: ECO-02. Проверка: Value ledger provenance test. Evidence: Customer-confirmed baseline/metrics.

**MASTER53:REQ-CMP-001** — External authority success only from external receipt

Capability: CMP-01. Проверка: FGIS/EPD negative/retry tests. Evidence: External IDs/receipts.

**MASTER53:REQ-OPS-002** — Offline/degraded does not duplicate or fake completion

Capability: OPS-04. Проверка: Reconnect/idempotency tests. Evidence: Mobile production evidence.

**MASTER53:REQ-GTM-001** — Scale requires repeat + known CM2

Capability: GTM-02. Проверка: Commercial gate review. Evidence: CRM/cohort finance evidence.

**MASTER53:REQ-MKT-002** — Open marketplace remains strategic P0 origin, but first paid non-marketplace workflow is not blocked by open-market liquidity

Capability: MKT-09/GTM-03. Проверка: Marketplace E2E + Private/BYOD first-revenue gate separation tests. Evidence: Marketplace liquidity evidence + first paid workflow evidence.

**MASTER53:REQ-INV-001** — Same physical/forecast volume cannot be double-committed beyond policy

Capability: INV-01/CROP-03. Проверка: Concurrent reservation + split/merge + blocked inventory. Evidence: Inventory/Deal evidence.

**MASTER53:REQ-REG-002** — Required FGIS/SDIZ event cannot be inferred from HTTP success

Capability: REG-04. Проверка: Provider success/unknown/correction/retry. Evidence: External receipt.

**MASTER53:REQ-OTC-001** — Applicable OTC reporting is deadline/version/receipt controlled

Capability: REG-05. Проверка: Applicability/deadline/reject/reconcile. Evidence: NTB/external receipt.

**MASTER53:REQ-ECO-003** — Time-to-cash is measured by explicit state timestamps

Capability: ECO-03. Проверка: Accepted→eligible→bank→received/reconciled. Evidence: Deal+bank evidence.

**MASTER53:REQ-RISK-001** — Counterparty adverse conclusion is explainable and appealable

Capability: RISK-01. Проверка: Source expiry/correction/tenant leakage/AI-score abuse. Evidence: Evidence graph + audit.

**MASTER53:REQ-COMM-002** — Scale decision includes channel CAC + CM2 + support intensity

Capability: COMM-03. Проверка: Cohort/channel gate review. Evidence: Finance/CRM evidence.

**MASTER53:REQ-SET-001** — Every irreversible settlement instruction references APPROVED non-superseded SettlementBasis

Capability: DEAL-04/FIN-04. Проверка: Missing/superseded/evidence-incomplete basis negative tests. Evidence: Deal+ledger+bank evidence.

**MASTER53:REQ-QUAL-002** — Commercial quality, regulatory safety and phytosanitary/route status cannot collapse into one boolean

Capability: QUAL-02. Проверка: Conflicting-axis scenario tests. Evidence: RulePack + Deal evidence.

**MASTER53:REQ-QUAL-003** — Quality adjustment traceable to exact sample custody and lab result version

Capability: QUAL-03/QUAL-01. Проверка: Wrong sample/retest/tamper cases. Evidence: Sample/Lab/EvidencePackage.

**MASTER53:REQ-GEK-003** — High-impact Gekta answer returns evidence contract and never self-authorizes money/legal action

Capability: GEK-06. Проверка: Missing evidence/tool escalation/approval flag tests. Evidence: AI acceptance/eval corpus.

**MASTER53:REQ-GTM-003** — First paid controlled workflow may close through Private/BYOD/Partner origin before marketplace liquidity PASS

Capability: GTM-03/MKT-09. Проверка: Origin-separated E2E and revenue gate. Evidence: CRM/deal/CM2 evidence.

## 17 5 Полнота трассировки перед началом кода

R0 создаёт machine-readable реестр из каждого REQ v2.1, каждой capability и строки RTM MASTER, A01–A24, P0-01–P0-15, G0–G11 и исходных требований UX/ФГИС. Для каждого source item обязательны target requirement, applicability/disposition и проверка. Дубли допускаются только с явным many-to-one mapping; сиротские требования блокируют закрытие R0.

Публичный рынок, защищённые деньги, 1С/ЭДО/ФГИС, все режимы Гекты, корпоративные и коммерческие gates не удаляются из полного scope из-за узкого first-money сценария. Для conditional возможностей фиксируются trigger и безопасный выключенный UX; появление применимости открывает задачу и review процента. Нет внешнего доступа — EXTERNAL_BLOCKER, а не NOT_APPLICABLE.

Составление и проверка этого документа не является выпуском платформы. Перед выполнением Codex обязан установить фактический main и production, затем работать по единому serial plan с постоянным честным процентом.
