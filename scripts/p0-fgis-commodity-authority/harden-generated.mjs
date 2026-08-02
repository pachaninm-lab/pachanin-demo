import { readFileSync, writeFileSync } from 'node:fs';

const migrationPath =
  'apps/api/prisma/migrations/20260802210000_fgis_commodity_authority/migration.sql';
const schemaPath = 'apps/api/prisma/schema.prisma';

let migration = readFileSync(migrationPath, 'utf8');
let schema = readFileSync(schemaPath, 'utf8');

const fkMarker = 'CONSTRAINT "fgis_grain_sync_run_org_fk"';
if (!migration.includes(fkMarker)) {
  const anchor =
    '-- ── Scope and immutability triggers ───────────────────────────────────────────';
  const foreignKeys = `-- ── Actor and organization foreign-key authority ────────────────────────────

ALTER TABLE public."fgis_grain_organization_connections"
  ADD CONSTRAINT "fgis_grain_org_connection_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_grain_org_connection_updated_user_fk"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_sync_runs"
  ADD CONSTRAINT "fgis_grain_sync_run_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_grain_sync_run_initiated_user_fk"
    FOREIGN KEY ("initiatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_party_snapshots"
  ADD CONSTRAINT "fgis_grain_party_snapshot_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_party_current"
  ADD CONSTRAINT "fgis_grain_party_current_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."commodity_reservations"
  ADD CONSTRAINT "commodity_reservation_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "commodity_reservation_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_lot_passports"
  ADD CONSTRAINT "fgis_grain_lot_passport_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_grain_lot_passport_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_reconciliation_cases"
  ADD CONSTRAINT "fgis_grain_reconciliation_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_grain_reconciliation_owner_user_fk"
    FOREIGN KEY ("ownerUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public."fgis_grain_commodity_commands"
  ADD CONSTRAINT "fgis_grain_commodity_command_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_grain_commodity_command_actor_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT;

`;
  if (!migration.includes(anchor)) {
    throw new Error('FGIS_FK_INSERTION_ANCHOR_MISSING');
  }
  migration = migration.replace(anchor, foreignKeys + anchor);
}

const replacements = new Map([
  [
    '@relation("FgisCommodityConnectionCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityConnectionCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_org_connection_created_user_fk")',
  ],
  [
    '@relation("FgisCommodityConnectionUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityConnectionUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_org_connection_updated_user_fk")',
  ],
  [
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  connection      FgisGrainOrganizationConnection',
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sync_run_org_fk")\n  connection      FgisGrainOrganizationConnection',
  ],
  [
    '@relation("FgisCommoditySyncInitiatedBy", fields: [initiatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommoditySyncInitiatedBy", fields: [initiatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sync_run_initiated_user_fk")',
  ],
  [
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  connection            FgisGrainOrganizationConnection',
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_snapshot_org_fk")\n  connection            FgisGrainOrganizationConnection',
  ],
  [
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  connection      FgisGrainOrganizationConnection @relation(fields: [connectionId]',
    'Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_current_org_fk")\n  connection      FgisGrainOrganizationConnection @relation(fields: [connectionId]',
  ],
  [
    'Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  partyCurrent',
    'Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "commodity_reservation_org_fk")\n  partyCurrent',
  ],
  [
    '@relation("FgisCommodityReservationCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityReservationCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "commodity_reservation_created_user_fk")',
  ],
  [
    'Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  partyCurrent   FgisGrainPartyCurrent  @relation(fields: [partyCurrentId]',
    'Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_lot_passport_org_fk")\n  partyCurrent   FgisGrainPartyCurrent  @relation(fields: [partyCurrentId]',
  ],
  [
    '@relation("FgisCommodityPassportCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityPassportCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_lot_passport_created_user_fk")',
  ],
  [
    'Organization            @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  partyCurrent     FgisGrainPartyCurrent',
    'Organization            @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_org_fk")\n  partyCurrent     FgisGrainPartyCurrent',
  ],
  [
    '@relation("FgisCommodityReconciliationOwner", fields: [ownerUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityReconciliationOwner", fields: [ownerUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_owner_user_fk")',
  ],
  [
    'Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)\n  actorUser',
    'Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_commodity_command_org_fk")\n  actorUser',
  ],
  [
    '@relation("FgisCommodityCommandActor", fields: [actorUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)',
    '@relation("FgisCommodityCommandActor", fields: [actorUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_commodity_command_actor_user_fk")',
  ],
]);

for (const [from, to] of replacements) {
  if (schema.includes(to)) continue;
  if (!schema.includes(from)) {
    throw new Error(`PRISMA_FK_ANCHOR_MISSING:${from.slice(0, 80)}`);
  }
  schema = schema.replace(from, to);
}

writeFileSync(migrationPath, migration);
writeFileSync(schemaPath, schema);
