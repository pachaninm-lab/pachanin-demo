-- IR-10.2: atomically consume the normalized logistics admission after the
-- canonical Shipment row has passed the BEFORE INSERT authority validation.
--
-- The trigger function is SECURITY DEFINER and derives the exact admission from
-- the inserted Shipment plus transaction-local app.current_command_id. The
-- application principal cannot author or update shipment_bindings directly.

DROP TRIGGER IF EXISTS shipments_bind_assignment ON public."shipments";
CREATE TRIGGER shipments_bind_assignment
AFTER INSERT ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_bind_assignment();

COMMENT ON TRIGGER shipments_bind_assignment ON public."shipments" IS
  'Consumes one ACTIVE normalized logistics admission and creates one immutable shipment binding in the same canonical Deal transaction.';
