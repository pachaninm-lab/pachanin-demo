\set ON_ERROR_STOP on

TRUNCATE TABLE
  public."commodity_profile_transitions",
  public."commodity_profile_versions",
  public."commodity_profiles"
CASCADE;

INSERT INTO public."commodity_profiles" (
  "id", "canonicalCode", "archetype", "authoritativeNameRu",
  "classification", "createdByUserId", "updatedByUserId"
) VALUES (
  'profile-dry-bulk', 'PC.DRY_BULK', 'DRY_BULK', 'Сыпучая продукция',
  'INTERNAL', 'user-admin', 'user-admin'
);

INSERT INTO public."commodity_profile_versions" (
  "id", "profileId", "sequence", "status", "content", "contentHash",
  "sourceStatus", "createdByUserId", "updatedByUserId"
) VALUES (
  'version-dry-bulk-1', 'profile-dry-bulk', 1, 'DRAFT',
  '{"canonicalCode":"PC.DRY_BULK","qualityIndicators":[]}'::jsonb,
  repeat('a', 64), 'REVERIFY_REQUIRED', 'user-admin', 'user-admin'
);

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-dry-bulk-created', 'profile-dry-bulk', 'version-dry-bulk-1',
  NULL, 'DRAFT', 'user-admin', 'ADMIN', 'CREATE_PROFILE',
  'Создан первый промышленный черновик профиля', 'command-create-dry-bulk',
  'idempotency-create-dry-bulk', 'correlation-dry-bulk', repeat('a', 64),
  NULL, repeat('b', 64)
);

UPDATE public."commodity_profile_versions"
SET
  "content" = '{"canonicalCode":"PC.DRY_BULK","qualityIndicators":["MOISTURE"]}'::jsonb,
  "contentHash" = repeat('c', 64),
  "version" = 1,
  "updatedByUserId" = 'user-admin',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-dry-bulk-1';

UPDATE public."commodity_profile_versions"
SET
  "status" = 'REVIEW',
  "version" = 2,
  "updatedByUserId" = 'user-quality',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-dry-bulk-1';

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-dry-bulk-review', 'profile-dry-bulk', 'version-dry-bulk-1',
  'DRAFT', 'REVIEW', 'user-quality', 'LAB', 'QUALITY_REVIEW',
  'Показатели качества направлены на проверку', 'command-review-dry-bulk',
  'idempotency-review-dry-bulk', 'correlation-dry-bulk', repeat('c', 64),
  repeat('b', 64), repeat('d', 64)
);

DO $test$
BEGIN
  BEGIN
    UPDATE public."commodity_profile_versions"
    SET
      "content" = '{"canonicalCode":"PC.DRY_BULK","tampered":true}'::jsonb,
      "contentHash" = repeat('e', 64),
      "version" = 3,
      "updatedAt" = clock_timestamp()
    WHERE "id" = 'version-dry-bulk-1';
    RAISE EXCEPTION 'expected immutable content rejection';
  EXCEPTION WHEN SQLSTATE '23000' THEN
    IF SQLERRM NOT LIKE 'PC_PROFILE_VERSION_IMMUTABLE:%' THEN
      RAISE;
    END IF;
  END;
END
$test$;

UPDATE public."commodity_profile_versions"
SET
  "status" = 'APPROVED',
  "approvalReason" = 'Качество и документы проверены ответственными ролями',
  "approvedByUserId" = 'user-compliance',
  "approvedAt" = clock_timestamp(),
  "version" = 3,
  "updatedByUserId" = 'user-compliance',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-dry-bulk-1';

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-dry-bulk-approved', 'profile-dry-bulk', 'version-dry-bulk-1',
  'REVIEW', 'APPROVED', 'user-compliance', 'COMPLIANCE', 'LEGAL_APPROVAL',
  'Утверждена версия с обязательной повторной проверкой источников',
  'command-approve-dry-bulk', 'idempotency-approve-dry-bulk',
  'correlation-dry-bulk', repeat('c', 64), repeat('d', 64), repeat('e', 64)
);

UPDATE public."commodity_profile_versions"
SET
  "status" = 'EFFECTIVE',
  "effectiveFrom" = '2030-01-01T00:00:00Z',
  "version" = 4,
  "updatedByUserId" = 'user-compliance',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-dry-bulk-1';

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-dry-bulk-effective', 'profile-dry-bulk', 'version-dry-bulk-1',
  'APPROVED', 'EFFECTIVE', 'user-compliance', 'COMPLIANCE', 'ACTIVATE_PROFILE',
  'Включение после отдельного confirmation; дата находится в тестовом будущем',
  'command-effective-dry-bulk', 'idempotency-effective-dry-bulk',
  'correlation-dry-bulk', repeat('c', 64), repeat('e', 64), repeat('f', 64)
);

DO $test$
BEGIN
  BEGIN
    DELETE FROM public."commodity_profile_versions"
    WHERE "id" = 'version-dry-bulk-1';
    RAISE EXCEPTION 'expected published version deletion rejection';
  EXCEPTION WHEN SQLSTATE '23000' THEN
    IF SQLERRM NOT LIKE 'PC_PROFILE_VERSION_DELETE_DENIED:%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public."commodity_profile_transitions"
    SET "reason" = 'tampered'
    WHERE "id" = 'transition-dry-bulk-effective';
    RAISE EXCEPTION 'expected append-only transition rejection';
  EXCEPTION WHEN SQLSTATE '23000' THEN
    IF SQLERRM NOT LIKE 'PC_PROFILE_TRANSITION_IMMUTABLE:%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public."commodity_profile_versions" (
      "id", "profileId", "sequence", "status", "content", "contentHash",
      "approvalReason", "approvedByUserId", "approvedAt",
      "createdByUserId", "updatedByUserId"
    ) VALUES (
      'version-invalid-initial', 'profile-dry-bulk', 99, 'APPROVED', '{}'::jsonb,
      repeat('9', 64), 'invalid direct approval', 'user-admin', clock_timestamp(),
      'user-admin', 'user-admin'
    );
    RAISE EXCEPTION 'expected initial-state rejection';
  EXCEPTION WHEN SQLSTATE '23000' THEN
    IF SQLERRM NOT LIKE 'PC_PROFILE_INITIAL_STATE_INVALID:%' THEN
      RAISE;
    END IF;
  END;
END
$test$;

INSERT INTO public."commodity_profile_versions" (
  "id", "profileId", "sequence", "status", "content", "contentHash",
  "sourceStatus", "createdByUserId", "updatedByUserId"
) VALUES (
  'version-race-a', 'profile-dry-bulk', 2, 'DRAFT', '{"race":"a"}'::jsonb,
  repeat('1', 64), 'REVERIFY_REQUIRED', 'user-admin', 'user-admin'
), (
  'version-race-b', 'profile-dry-bulk', 3, 'DRAFT', '{"race":"b"}'::jsonb,
  repeat('2', 64), 'REVERIFY_REQUIRED', 'user-admin', 'user-admin'
);

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES
  ('transition-race-a-created', 'profile-dry-bulk', 'version-race-a', NULL, 'DRAFT',
   'user-admin', 'ADMIN', 'CREATE_PROFILE_VERSION', 'Создан race A',
   'command-race-a-created', 'idempotency-race-a-created', 'correlation-race',
   repeat('1', 64), NULL, repeat('3', 64)),
  ('transition-race-b-created', 'profile-dry-bulk', 'version-race-b', NULL, 'DRAFT',
   'user-admin', 'ADMIN', 'CREATE_PROFILE_VERSION', 'Создан race B',
   'command-race-b-created', 'idempotency-race-b-created', 'correlation-race',
   repeat('2', 64), NULL, repeat('4', 64));

UPDATE public."commodity_profile_versions"
SET "status" = 'REVIEW', "version" = 1, "updatedAt" = clock_timestamp()
WHERE "id" IN ('version-race-a', 'version-race-b');

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES
  ('transition-race-a-review', 'profile-dry-bulk', 'version-race-a', 'DRAFT', 'REVIEW',
   'user-quality', 'LAB', 'QUALITY_REVIEW', 'Race A review',
   'command-race-a-review', 'idempotency-race-a-review', 'correlation-race',
   repeat('1', 64), repeat('3', 64), repeat('5', 64)),
  ('transition-race-b-review', 'profile-dry-bulk', 'version-race-b', 'DRAFT', 'REVIEW',
   'user-quality', 'LAB', 'QUALITY_REVIEW', 'Race B review',
   'command-race-b-review', 'idempotency-race-b-review', 'correlation-race',
   repeat('2', 64), repeat('4', 64), repeat('6', 64));

UPDATE public."commodity_profile_versions"
SET
  "status" = 'APPROVED',
  "approvalReason" = 'Prepared for concurrent activation acceptance',
  "approvedByUserId" = 'user-compliance',
  "approvedAt" = clock_timestamp(),
  "version" = 2,
  "updatedAt" = clock_timestamp()
WHERE "id" IN ('version-race-a', 'version-race-b');

INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES
  ('transition-race-a-approved', 'profile-dry-bulk', 'version-race-a', 'REVIEW', 'APPROVED',
   'user-compliance', 'COMPLIANCE', 'LEGAL_APPROVAL', 'Race A approved',
   'command-race-a-approved', 'idempotency-race-a-approved', 'correlation-race',
   repeat('1', 64), repeat('5', 64), repeat('7', 64)),
  ('transition-race-b-approved', 'profile-dry-bulk', 'version-race-b', 'REVIEW', 'APPROVED',
   'user-compliance', 'COMPLIANCE', 'LEGAL_APPROVAL', 'Race B approved',
   'command-race-b-approved', 'idempotency-race-b-approved', 'correlation-race',
   repeat('2', 64), repeat('6', 64), repeat('8', 64));

SELECT CASE
  WHEN count(*) = 3 THEN 'PASS: base invariant acceptance prepared'
  ELSE pg_catalog.set_config('pc_crop.failure', 'unexpected version count', false)
END
FROM public."commodity_profile_versions";
