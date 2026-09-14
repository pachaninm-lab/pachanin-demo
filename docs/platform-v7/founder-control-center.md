# Founder / CEO Control Center

## Purpose

The Founder Control Center moves the audited v11.2 management workbook into the private PLATFORM_OWNER cabinet without deleting or weakening the workbook. The workbook remains a frozen reference artifact; PostgreSQL plus server-authoritative calculations become the operational authority.

## Authority boundary

- Surface: `/platform-v7/staff`, visible only after the existing verified staff-owner/MFA gate.
- API read: durable `PLATFORM_OWNER` staff assignment plus MFA-verified live session.
- API write: the same authority plus MFA verified within the last 15 minutes.
- Database: `auth.founder_control_*` tables have no direct `pc_staff_runtime` table privilege.
- Runtime access: fixed `SECURITY DEFINER` functions only, owned by `pc_staff_authority`.
- Mutation safety: idempotency, advisory serialization, optimistic version, append-only event stream and SHA-256 hash chain.

## Workbook parity

`FOUNDER_CONTROL_WORKBOOK_PARITY` is the canonical mapping for every sheet in `Prozrachnaya_Cena_v11_2_CEO_Control_Center_MAX.xlsx`. A web unit test enumerates the full sheet list so a future refactor cannot silently delete a workbook contour.

The exact frozen workbook identity is pinned in code by file name, byte size and SHA-256. It is not a runtime dependency of the platform. The audited artifact remains independently retained and can be compared byte-for-byte against the pinned checksum.

## Operational modules

1. Today / Company Health / P0-P1 exception queue.
2. Cash and 13-week confirmed treasury calendar.
3. Sales pipeline, weighted MRR and closed-qualified win rate.
4. Clients: contract gate, proof groups, actual launch economics and Client P&L.
5. Forecast: base plan, approved rolling forecast, actual periods and forecast accuracy.
6. AR/DSO with payment evidence and aging.
7. Retention GRR/NRR from client-period MRR.
8. Evidence Register with fixed required item sets for legal/live, 2% USN, team and infrastructure.
9. Monthly Close with nine independent checks plus owner/date/evidence.
10. Assumption and Decision Logs.
11. Hiring, Tranche B and scale gates.
12. Excel 1:1 parity and frozen reference identity (filename / byte size / SHA-256).

## Non-negotiable facts

- Empty values do not become zero or PASS.
- Pipeline never becomes cash.
- Two companies under one canonical control group count as one commercial-proof group.
- Scale cannot unlock from the calendar alone.
- 2% USN is a 2026 BASE assumption only when the complete evidence gate passes; the reference model returns to 6% in 2027 absent a new legal act.
- Client funds/transaction principal are not platform operating cash or platform revenue.
- Excel reference numbers are not silently overwritten by live facts; plan, forecast and actual remain separate.
