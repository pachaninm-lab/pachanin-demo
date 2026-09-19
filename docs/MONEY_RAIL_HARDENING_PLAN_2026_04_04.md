# Money rail hardening plan · 2026-04-04

## Цель

Довести money contour из demo/pilot-safe состояния до bank-grade execution discipline.

## P0

### 1. Insurance clearance inside release
- release gate проверяет не только docs / lab / dispute, но и insurance clearance;
- claim event должен уметь держать release;
- insurance artifacts входят в evidence pack.

### 2. Bank provider parity
- Сбер остаётся основным rail;
- РСХБ добавляется как второй provider в тот же canonical release engine;
- reserve / hold / release / statement callback / credit session должны работать одинаково по semantics.

### 3. Callback reconciliation
- все bank callbacks должны логироваться как canonical money events;
- mismatch не должен завершаться green статусом;
- нужен явный retry / reconciliation owner.

### 4. Fail-closed
- если нет bank confirmation, no release;
- если есть open dispute, no final release;
- если нет final docs / quality clearance, no final release.

## P1

### 5. Partial release policy
- uncontested amount платится отдельно;
- disputed amount живёт в hold до decision / claim clearance.

### 6. Money reason codes
- каждый hold/release имеет reason code;
- reason code виден finance, operator и executive.

### 7. RSHB adapter delivery
- сначала read-model и callbacks;
- потом reserve / release;
- потом credit.

## P2

### 8. Insurance partner routing
- SberInsurance / Ingosstrakh как основные rails;
- Rosgosstrakh как резервный / manual.

### 9. Export release blockers
- export corridors должны держать release, пока не закрыт export-doc package.

## Done in repo already

- canonical bank integration layer;
- hold/release flow;
- commercial expansion domain module;
- runtime read-model for expansion;
- connected expansion UI board.

## Что считать PASS

Money rail считается bank-grade, когда:
- callback reconciliation подтверждён живым smoke;
- release объясняется reason codes;
- fail-closed подтверждён в runtime;
- второй bank rail поднят без дублирования логики;
- insurance clearance реально влияет на release.
