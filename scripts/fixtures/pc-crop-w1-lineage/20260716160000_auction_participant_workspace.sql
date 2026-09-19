-- Рабочий экран торгов для допущенного участника из другого tenant
-- (PHASE1_BACKLOG №1, продолжение 20260716150000). Участник с действующим
-- допуском ADMITTED видит ставки и награду лота — этого требует честный экран
-- торгов (лучшая ставка, счётчик, итог). Идентичность других участников в
-- витрину не попадает; вопрос обезличивания ставок внутри рабочего экрана —
-- отдельное продуктовое решение (см. бэклог).

DROP POLICY IF EXISTS auction_bids_participant_select ON auction.bids;
CREATE POLICY auction_bids_participant_select ON auction.bids FOR SELECT USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.lot_id = bids.lot_id
      AND admission.tenant_id = bids.tenant_id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now()
  )
);

DROP POLICY IF EXISTS auction_awards_participant_select ON auction.awards;
CREATE POLICY auction_awards_participant_select ON auction.awards FOR SELECT USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.lot_id = awards.lot_id
      AND admission.tenant_id = awards.tenant_id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now()
  )
);
