-- Deal.version: оптимистическая блокировка переходов state machine.
-- Переход выполняется как UPDATE ... WHERE id = $1 AND version = $2 (+ version = version + 1);
-- 0 затронутых строк = проигранная гонка, транзакция откатывается.
ALTER TABLE "deals" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Финансовые инварианты живут в БД, а не только в коде приложения:
-- баг в сервисе или ручной SQL не должны уметь записать отрицательное
-- или удержание больше резерва.

-- Леджер: сумма проводки строго положительна (знак несёт entryType, не число).
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive"
  CHECK ("amountKopecks" > 0);

-- Платежи: суммы неотрицательны.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_non_negative"
  CHECK ("amountKopecks" IS NULL OR "amountKopecks" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_hold_non_negative"
  CHECK ("holdAmountKopecks" IS NULL OR "holdAmountKopecks" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_refunded_non_negative"
  CHECK ("refundedKopecks" IS NULL OR "refundedKopecks" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_commission_non_negative"
  CHECK ("commissionKopecks" IS NULL OR "commissionKopecks" >= 0);

-- Удержание не может превышать зарезервированную сумму (reserved >= hold >= 0).
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_hold_within_reserved"
  CHECK (
    "holdAmountKopecks" IS NULL
    OR "amountKopecks" IS NULL
    OR "holdAmountKopecks" <= "amountKopecks"
  );

-- Возврат не может превышать зарезервированную сумму.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_refund_within_reserved"
  CHECK (
    "refundedKopecks" IS NULL
    OR "amountKopecks" IS NULL
    OR "refundedKopecks" <= "amountKopecks"
  );
