-- IR-10.4 callback invariant visibility hardening.
--
-- The callback and payment-transition trigger functions enforce exact operation,
-- actor, tenant, amount and fingerprint binding themselves. They must inspect the
-- authoritative Settlement rows independently of the caller's RLS visibility;
-- otherwise a valid BANK_CALLBACK transaction can observe a false "no exact
-- pending operation" result while the protected row exists.
--
-- SECURITY DEFINER does not grant a mutation bypass: both functions retain the
-- strict app.current_role / transaction-local callback binding checks installed
-- by the previous migration, and their search_path is already pinned.

ALTER FUNCTION settlement.validate_callback_insert() SECURITY DEFINER;
ALTER FUNCTION settlement.validate_payment_transition() SECURITY DEFINER;

REVOKE ALL ON FUNCTION settlement.validate_callback_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION settlement.validate_payment_transition() FROM PUBLIC;

COMMENT ON FUNCTION settlement.validate_callback_insert() IS
  'Trigger-only exact callback-to-PENDING-operation validator; SECURITY DEFINER prevents RLS visibility from weakening or falsely rejecting the invariant.';
COMMENT ON FUNCTION settlement.validate_payment_transition() IS
  'Trigger-only payment counter transition validator; confirmed money still requires exact transaction-local verified callback binding.';
