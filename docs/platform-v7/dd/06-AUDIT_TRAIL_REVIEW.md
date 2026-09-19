# Audit Trail Review — platform-v7

Дата: 2026-06-15. Зрелость: controlled-pilot. Связано с
`../audit/SOC2_READINESS.md`.

## Покрытие требований

| Поле | Статус | Источник |
|------|--------|----------|
| actor | EXISTS | `audit-trail.ts`, `audit-event-helper.ts` (`actorId`) |
| role | EXISTS | `actorRole` |
| object | EXISTS | `entityId`/`entityType` |
| action | EXISTS | `action`/`boundaryId` |
| before/after | PARTIAL | hash для status_changed; полный контент-hash — GAP (SOC2-003) |
| denied action | EXISTS | `auditDeniedAccess()`, `PlatformV7DeniedAccessAuditEvent` |
| timestamp | EXISTS | `occurredAt`/`createdAt` |
| export by deal | EXISTS | `audit-evidence-export.ts` (фильтр по dealId) |
| immutable-style | EXISTS (логически) | append-only, `userDeletable:false`; durable БД — GAP |

## Сильные стороны

- **Append-only дизайн:** `audit-event-helper.ts` — `userDeletable:false`,
  привязка append-only флага, эскалация severity для money-влияющих границ;
  `server-audit-boundary.ts` блокирует серверное действие без корректного
  audit-event.
- **Целостность evidence:** `evidence-ledger.ts` — `hash`/`prevHash`, детект
  broken-chain/duplicate; `evidence-retention.ts` — legal hold/expiry.
- **Экспорт для банка/спора/DD:** `audit-evidence-export.ts` собирает audit +
  evidence по сделке (purpose: bank_review/dispute/due_diligence/operator_archive).
- **Denied-access аудит:** отказы доступа логируются с auditCode (EXPLICIT_DENY,
  DENY_BY_DEFAULT и т.д.).

## Находки

- **AUD-001 / SOC2-001 (MEDIUM):** durable audit-sink отсутствует (порт `audit`
  в `db-persistence-adapter.ts` есть, БД — in-memory). До реальной БД аудит не
  переживает рестарт. **Fix:** реализовать `P7PersistenceDriver` поверх БД с
  append-only/WORM-таблицей. **Status:** owner-side.
- **SOC2-003 (LOW):** нет полного before/after контент-хеша. **Fix:** хешировать
  снапшоты сущности в audit-event (in-scope `lib/platform-v7/**`, но это правка
  логики аудита — отдельный аккуратный PR с тестом). **Status:** future-PR.

## Вердикт
Аудит-трейл спроектирован зрело (append-only, denied-аудит, экспорт по сделке,
chain-of-custody evidence). Для сертификации/банка нужен durable WORM-бэкенд
(owner-side, реальная БД).
