-- IR-TOPOLOGY: dedicated outbox delivery principal.
--
-- The role itself is created by infrastructure or the acceptance harness so
-- credentials never enter migrations. When the role exists, this migration
-- removes inherited table authority and grants only the columns required by
-- claim, heartbeat, retry, dead-letter and SENT acknowledgement operations.

DO $outbox_worker_principal$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_outbox') THEN
    ALTER ROLE app_outbox
      NOINHERIT
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;

    GRANT USAGE ON SCHEMA public TO app_outbox;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_outbox;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_outbox;

    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth FROM app_outbox;
      REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth FROM app_outbox;
      REVOKE USAGE ON SCHEMA auth FROM app_outbox;
    END IF;

    GRANT SELECT ON TABLE public."outbox_entries" TO app_outbox;
    GRANT UPDATE (
      "status",
      "retryCount",
      "nextRetryAt",
      "lastError",
      "sentAt",
      "confirmedAt",
      "failedAt",
      "deadLetterAt",
      "leaseOwner",
      "leaseToken",
      "leaseExpiresAt",
      "heartbeatAt"
    ) ON TABLE public."outbox_entries" TO app_outbox;

    REVOKE INSERT, DELETE ON TABLE public."outbox_entries" FROM app_outbox;
    REVOKE ALL PRIVILEGES ON TABLE public."outbox_redrive_events" FROM app_outbox;
    REVOKE ALL PRIVILEGES ON TABLE public."deals" FROM app_outbox;
  END IF;
END
$outbox_worker_principal$;
