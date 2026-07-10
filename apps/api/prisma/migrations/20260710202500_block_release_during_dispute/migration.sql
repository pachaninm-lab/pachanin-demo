CREATE OR REPLACE FUNCTION public.assert_no_active_dispute_hold(p_deal_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dispute_money_holds h
    JOIN public.disputes d ON d.id = h."disputeId"
    WHERE d."dealId" = p_deal_id
      AND h."releasedAt" IS NULL
      AND COALESCE(h."amountKopecks", 0) > 0
      AND d.status NOT IN ('RESOLVED', 'CLOSED')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_DISPUTE_HOLD:%', p_deal_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payment_release_against_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IN ('RELEASE_REQUESTED', 'RELEASED')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.assert_no_active_dispute_hold(NEW."dealId");
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_release_dispute_guard ON public.payments;
CREATE TRIGGER payment_release_dispute_guard
BEFORE UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_release_against_dispute();

CREATE OR REPLACE FUNCTION public.guard_bank_release_against_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.type = 'RELEASE' AND NEW.status IN ('PENDING', 'DONE') THEN
    PERFORM public.assert_no_active_dispute_hold(NEW."dealId");
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_release_dispute_guard ON public.bank_operations;
CREATE TRIGGER bank_release_dispute_guard
BEFORE INSERT OR UPDATE OF status ON public.bank_operations
FOR EACH ROW
EXECUTE FUNCTION public.guard_bank_release_against_dispute();
