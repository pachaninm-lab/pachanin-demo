ALTER TABLE dispute.money_instructions
  ADD COLUMN seller_operation_id text,
  ADD COLUMN buyer_operation_id text,
  ADD CONSTRAINT dispute_instruction_seller_operation_fkey
    FOREIGN KEY (seller_operation_id) REFERENCES settlement.bank_operations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT dispute_instruction_buyer_operation_fkey
    FOREIGN KEY (buyer_operation_id) REFERENCES settlement.bank_operations(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX dispute_instruction_seller_operation_key
  ON dispute.money_instructions (seller_operation_id) WHERE seller_operation_id IS NOT NULL;
CREATE UNIQUE INDEX dispute_instruction_buyer_operation_key
  ON dispute.money_instructions (buyer_operation_id) WHERE buyer_operation_id IS NOT NULL;
