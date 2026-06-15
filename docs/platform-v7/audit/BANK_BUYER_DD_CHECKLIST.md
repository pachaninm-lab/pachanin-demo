# BANK_BUYER_DD_CHECKLIST — platform-v7

Дата: 2026-06-15. Чеклист due diligence для банка/стратегического покупателя.
Зрелость: controlled-pilot / pre-integration. **Ни одно поле не заявляет
live/bank-connected** — любой «боевой» статус защищён honesty-gate.

## Что банк видит (EXISTS)

| Требование | Статус | Где |
|------------|--------|-----|
| Money basis (основание выплаты) | EXISTS | `app/platform-v7/bank/page.tsx`, `P7BankPaymentBasisRuntimePanel.tsx`, `BankCleanView.tsx` |
| Blockers (СДИЗ/ЭТрН/УПД/акт/качество) | EXISTS | bank releaseSummary, operator blockers |
| Documents | EXISTS | document matrix + document-access-control |
| Dispute hold | EXISTS | `getDisputes`, `disputeTotalHeldRub`, hold через runtime |
| Reconciliation | EXISTS | `bank-callback.ts` (`p7ReconcileBankCallback`) |
| Audit | EXISTS | `audit-evidence-export.ts` (по сделке), append-only trail |
| No fake release | EXISTS | honesty-копии + `doesNotConfirmExternally:true` |

## Anti-fake-release (подтверждено в коде)

- Текст банковского кабинета: «Сделка есть, но основание банку не передаётся без
  закрытых условий», «резерв ожидает банковского подтверждения», «Нет заявления о
  выплате без банковского подтверждения». Кнопка — «Передать основание банку», не
  «выпустить деньги».
- `BankCleanView.tsx` (docstring): запрещено показывать лоты/маркетинг/детали
  водителя; запрещено писать «платформа выпускает деньги»/«гарантировано».
- `P7BankPaymentBasisRuntimePanel.tsx`: «Платформа не выпускает деньги сама и ждёт
  внешнее банковское событие… до банковского события это не является выпуском
  денег, оплатой или гарантией расчёта».
- Reconciliation отвергает в `manual_review`: дубликат (no double release),
  deal/currency/amount mismatch, не-терминальный статус. Идемпотентность по
  `bankEventId`.
- Honesty-gate `canClaimProviderLive` (8 условий: live-статус, контракт,
  credentials, callbacks, подтверждённые операции) — иначе «боевой» статус
  показать нельзя.

## 115-ФЗ / AML

- EXISTS: `onboarding-kyc.ts` (ИНН/ОГРН/бенефициар/sanctions/aml-флаги, статусы
  not_started…approved/restricted/rejected), `bank-compliance-pilot.ts`
  (115-ФЗ identifications со статусами `manual_review`/`requires_contract_and_access`),
  `onboarding-risk-score.ts` (sanctions/aml hit → авто-стоп), compliance-queue.
- GAP (честно): это НЕ полный AML-движок — нет транзакционного мониторинга, нет
  генерации СОЭС/STR. **Полный bank AML не клеймится без банка** (CMP-004).

## 152-ФЗ (персональные данные)

- EXISTS: контроль доступа к чувствительным полям (`deal-access-gate.ts`,
  `contact-vault.ts`), маскирование, reveal-политика с аудитом.
- GAP: нет consent-полей (CMP-001), нет export/delete по субъекту (CMP-002), нет
  заметки о локализации хранения (CMP-003) — owner-side/future-PR.

## DD-находки (резюме; детали в доменных отчётах)

| ID | Severity | Кратко | Статус |
|----|----------|--------|--------|
| SEC-001 | HIGH→CRITICAL@go-live | актор из body, не из сессии | owner-side/api-PR — **блокер go-live** |
| SEC-003 | HIGH | field-masking клиентский | server-side при API |
| UX-001 | HIGH | money/bank экраны: сырой hex, тёмная тема | fixable-in-scope |
| CMP-001 | HIGH | нет consent (152-ФЗ) | owner-side/future-PR |
| CMP-004 | HIGH | full AML — только с банком | owner-side (не клеймить) |
| AUD-001/SOC2-001 | MEDIUM | durable audit sink (нужна БД) | owner-side |
| SEC-007 | MEDIUM | подпись bank-callback (HMAC) | owner-side (live) |

## Вердикт для покупателя

- **Code-ready для controlled pilot:** да — внутренний контур денег/документов/
  споров, RBAC, аудит, honesty-гарды работают на симуляции.
- **Pre-integration partner onboarding:** да — банковский adapter + callback +
  reconciliation + shells включаются за ENV/credentials без переписывания.
- **Остаётся owner-side до go-live:** server-side identity/сессия (SEC-001),
  IdP+MFA, enforced серверный RBAC, реальная БД с WORM-аудитом, договоры/
  credentials банка/ФГИС/ЭДО/ЭПД, номинальный счёт, security/legal review
  (152-ФЗ/115-ФЗ), первая controlled-pilot сделка.
