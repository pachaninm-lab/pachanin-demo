import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import {
  RlsTransactionService,
  TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { Role } from '../../common/types/request-user';
import {
  LogisticsCommand,
  RecordCheckpointCommand,
  RecordGpsCommand,
  ShipmentCheckpointRecord,
  ShipmentGpsPointRecord,
  ShipmentMutationResult,
  ShipmentRecord,
  ShipmentRepository,
  ShipmentWorkspace,
  VerifyPinCommand,
} from './shipment.repository';

type NormalizedCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  expectedVersion: bigint;
  correlationId?: string;
}> & Record<string, unknown>;

type ShipmentAuthorityRecord = ShipmentRecord & Readonly<{ driverPinHash: string | null }>;

type MutationArtifacts = Readonly<{
  shipment: ShipmentAuthorityRecord;
  checkpoint?: ShipmentCheckpointRecord;
  gpsPoint?: ShipmentGpsPointRecord;
  valid?: boolean;
  eventPayload: Prisma.InputJsonObject;
}>;

const CHECKPOINT_ROLES = new Set<string>([
  Role.DRIVER,
  Role.LOGISTICIAN,
  Role.ELEVATOR,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<ShipmentRecord[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<ShipmentAuthorityRecord[]>(Prisma.sql`
        SELECT s.*
        FROM public."shipments" s
        ORDER BY s."updatedAt" DESC, s."id" ASC
        LIMIT 500
      `);
      return rows.map(publicShipment);
    });
  }

  async getById(id: string, user: RequestUser): Promise<ShipmentRecord> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const shipment = await this.findShipment(tx, shipmentId);
      if (!shipment) throw scopedNotFound();
      return publicShipment(shipment);
    });
  }

  async workspace(id: string, user: RequestUser): Promise<ShipmentWorkspace> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const shipment = await this.findShipment(tx, shipmentId);
      if (!shipment) throw scopedNotFound();
      const [checkpoints, gpsTrack] = await Promise.all([
        tx.$queryRaw<ShipmentCheckpointRecord[]>(Prisma.sql`
          SELECT c.*
          FROM public."checkpoints" c
          WHERE c."shipmentId" = ${shipmentId}
          ORDER BY c."completedAt" ASC NULLS LAST, c."createdAt" ASC, c."id" ASC
          LIMIT 1000
        `),
        this.findGpsTrack(tx, shipmentId),
      ]);
      return { shipment: publicShipment(shipment), checkpoints, gpsTrack };
    });
  }

  async recordCheckpoint(
    id: string,
    command: RecordCheckpointCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult> {
    if (!CHECKPOINT_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot record shipment checkpoints.');
    }
    const normalized: NormalizedCommand = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      type: requiredCheckpointType(command.type),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      lat: optionalCoordinate(command.lat, 'lat', -90, 90),
      lng: optionalCoordinate(command.lng, 'lng', -180, 180),
      note: optionalText(command.note, 'note', 1000),
    };
    if ((normalized.lat === undefined) !== (normalized.lng === undefined)) {
      throw new BadRequestException({ code: 'COORDINATE_PAIR_REQUIRED' });
    }

    return this.executeMutation(
      normalized.shipmentId as string,
      normalized,
      user,
      'shipment.checkpoint.record',
      'shipment.checkpoint.recorded',
      async (tx, shipment, context) => {
        if (user.role === Role.DRIVER && shipment.driverUserId !== context.userId) {
          throw new ForbiddenException('Driver is not assigned to this shipment.');
        }
        const persistentKey = this.persistentKey(context, normalized.idempotencyKey);
        const checkpointId = `checkpoint-${randomUUID()}`;
        const checkpoints = await tx.$queryRaw<ShipmentCheckpointRecord[]>(Prisma.sql`
          INSERT INTO public."checkpoints" (
            "id", "shipmentId", "tenantId", "type", "completedAt", "lat", "lng",
            "note", "actorId", "commandId", "idempotencyKey", "correlationId", "createdAt"
          ) VALUES (
            ${checkpointId}, ${shipment.id}, ${context.tenantId}, ${normalized.type as string},
            ${normalized.occurredAt as Date}, ${nullableNumber(normalized.lat)}, ${nullableNumber(normalized.lng)},
            ${nullableString(normalized.note)}, ${context.userId}, ${normalized.commandId},
            ${persistentKey}, ${nullableString(normalized.correlationId)}, now()
          )
          RETURNING *
        `);
        const checkpoint = checkpoints[0];
        if (!checkpoint) throw new ConflictException('Checkpoint insert did not return an authoritative row.');
        const updated = await this.casPositionUpdate(
          tx,
          shipment,
          normalized.expectedVersion,
          normalized.lat as number | undefined,
          normalized.lng as number | undefined,
          normalized.occurredAt as Date,
        );
        return {
          shipment: updated,
          checkpoint,
          eventPayload: {
            checkpointId: checkpoint.id,
            checkpointType: checkpoint.type,
            occurredAt: checkpoint.completedAt?.toISOString() ?? null,
          },
        };
      },
    );
  }

  async recordGps(
    id: string,
    command: RecordGpsCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult> {
    if (user.role !== Role.DRIVER && user.role !== Role.SUPPORT_MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only the assigned driver or an explicit control role may record GPS facts.');
    }
    const normalized: NormalizedCommand = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      lat: requiredCoordinate(command.lat, 'lat', -90, 90),
      lng: requiredCoordinate(command.lng, 'lng', -180, 180),
      speedKmh: optionalRange(command.speedKmh, 'speedKmh', 0, 250),
      headingDeg: optionalRange(command.headingDeg, 'headingDeg', 0, 360),
      accuracyM: optionalRange(command.accuracyM, 'accuracyM', 0, 10000),
      recordedAt: requiredDate(command.recordedAt, 'recordedAt'),
    };

    return this.executeMutation(
      normalized.shipmentId as string,
      normalized,
      user,
      'shipment.gps.record',
      'shipment.gps.recorded',
      async (tx, shipment, context) => {
        if (user.role === Role.DRIVER && shipment.driverUserId !== context.userId) {
          throw new ForbiddenException('Driver is not assigned to this shipment.');
        }
        const persistentKey = this.persistentKey(context, normalized.idempotencyKey);
        const gpsId = `gps-${randomUUID()}`;
        const rows = await tx.$queryRaw<ShipmentGpsPointRecord[]>(Prisma.sql`
          INSERT INTO public."shipment_gps_points" (
            "id", "shipmentId", "tenantId", "actorUserId", "lat", "lng",
            "speedKmh", "headingDeg", "accuracyM", "recordedAt", "commandId",
            "idempotencyKey", "correlationId", "createdAt"
          ) VALUES (
            ${gpsId}, ${shipment.id}, ${context.tenantId}, ${context.userId},
            ${normalized.lat as number}, ${normalized.lng as number},
            ${nullableNumber(normalized.speedKmh)}, ${nullableNumber(normalized.headingDeg)},
            ${nullableNumber(normalized.accuracyM)}, ${normalized.recordedAt as Date},
            ${normalized.commandId}, ${persistentKey}, ${nullableString(normalized.correlationId)}, now()
          )
          RETURNING *
        `);
        const gpsPoint = rows[0];
        if (!gpsPoint) throw new ConflictException('GPS insert did not return an authoritative row.');
        const updated = await this.casPositionUpdate(
          tx,
          shipment,
          normalized.expectedVersion,
          normalized.lat as number,
          normalized.lng as number,
          normalized.recordedAt as Date,
        );
        return {
          shipment: updated,
          gpsPoint,
          eventPayload: {
            gpsPointId: gpsPoint.id,
            recordedAt: gpsPoint.recordedAt.toISOString(),
          },
        };
      },
    );
  }

  async getGpsTrack(id: string, user: RequestUser): Promise<ShipmentGpsPointRecord[]> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const shipment = await this.findShipment(tx, shipmentId);
      if (!shipment) throw scopedNotFound();
      return this.findGpsTrack(tx, shipmentId);
    });
  }

  async verifyPin(
    id: string,
    command: VerifyPinCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult> {
    if (user.role !== Role.DRIVER && user.role !== Role.SUPPORT_MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Role cannot verify a shipment driver PIN.');
    }
    const pin = String(command.pin ?? '').trim();
    if (!/^\d{4,12}$/.test(pin)) throw new BadRequestException({ code: 'INVALID_PIN_FORMAT' });
    const normalized: NormalizedCommand = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      pinDigest: digest(pin),
    };

    return this.executeMutation(
      normalized.shipmentId as string,
      normalized,
      user,
      'shipment.pin.verify',
      'shipment.pin.verification.recorded',
      async (tx, shipment, context) => {
        if (user.role === Role.DRIVER && shipment.driverUserId !== context.userId) {
          throw new ForbiddenException('Driver is not assigned to this shipment.');
        }
        if (!shipment.driverPinHash) {
          throw new ConflictException({ code: 'PIN_NOT_PROVISIONED' });
        }
        const now = new Date();
        if (shipment.pinLockedUntil && shipment.pinLockedUntil > now) {
          throw new ConflictException({
            code: 'PIN_LOCKED',
            lockedUntil: shipment.pinLockedUntil.toISOString(),
          });
        }
        const valid = await compare(pin, shipment.driverPinHash);
        const failedAttempts = valid ? 0 : shipment.pinFailedAttempts + 1;
        const lockedUntil = !valid && failedAttempts >= 5
          ? new Date(now.getTime() + 15 * 60_000)
          : null;
        const updated = await this.casPinUpdate(
          tx,
          shipment,
          normalized.expectedVersion,
          valid,
          failedAttempts,
          lockedUntil,
          context.userId,
          now,
        );
        return {
          shipment: updated,
          valid,
          eventPayload: {
            valid,
            failedAttempts,
            lockedUntil: lockedUntil?.toISOString() ?? null,
          },
        };
      },
    );
  }

  private async executeMutation(
    shipmentId: string,
    command: NormalizedCommand,
    user: RequestUser,
    action: string,
    eventType: string,
    work: (
      tx: Prisma.TransactionClient,
      shipment: ShipmentAuthorityRecord,
      context: TrustedRlsContext,
    ) => Promise<MutationArtifacts>,
  ): Promise<ShipmentMutationResult> {
    const requestFingerprint = digest({ action, shipmentId, command: redactCommand(command) });
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, command.idempotencyKey);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        const shipment = await this.findShipment(tx, shipmentId);
        if (!shipment) throw scopedNotFound();
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${shipment.dealId}, 42)) IS NULL AS locked
        `);

        const artifacts = await work(tx, shipment, context);
        const auditId = `audit-${randomUUID()}`;
        const outboxId = `outbox-${randomUUID()}`;
        const previousAudit = await tx.auditEvent.findFirst({
          where: { dealId: shipment.dealId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const auditMaterial = {
          id: auditId,
          action,
          actorUserId: context.userId,
          actorRole: context.role,
          tenantId: context.tenantId,
          orgId: context.orgId,
          dealId: shipment.dealId,
          objectType: 'shipment',
          objectId: shipment.id,
          beforeState: shipmentState(shipment),
          afterState: shipmentState(artifacts.shipment),
          outcome: 'SUCCESS',
          correlationId: command.correlationId ?? command.commandId,
          metadata: {
            commandId: command.commandId,
            idempotencyKey: persistentKey,
            eventType,
            ...artifacts.eventPayload,
          },
          prevHash: previousAudit?.hash ?? null,
        };
        await tx.auditEvent.create({
          data: {
            ...auditMaterial,
            beforeState: auditMaterial.beforeState as Prisma.InputJsonValue,
            afterState: auditMaterial.afterState as Prisma.InputJsonValue,
            metadata: auditMaterial.metadata as Prisma.InputJsonValue,
            hash: digest(auditMaterial),
          },
        });
        await tx.outboxEntry.create({
          data: {
            id: outboxId,
            type: eventType,
            dealId: shipment.dealId,
            status: 'PENDING',
            idempotencyKey: persistentKey,
            correlationId: command.correlationId ?? command.commandId,
            auditId,
            payload: {
              schemaVersion: 'logistics-event.v1',
              requestFingerprint,
              shipmentId: shipment.id,
              checkpointId: artifacts.checkpoint?.id ?? null,
              gpsPointId: artifacts.gpsPoint?.id ?? null,
              valid: artifacts.valid ?? null,
              ...artifacts.eventPayload,
            } as Prisma.InputJsonValue,
          },
        });
        return {
          shipment: publicShipment(artifacts.shipment),
          auditId,
          outboxId,
          duplicate: false,
          checkpoint: artifacts.checkpoint,
          gpsPoint: artifacts.gpsPoint,
          valid: artifacts.valid,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.rls.withTrustedContext(user, async (tx, context) => {
        const replay = await this.replay(
          tx,
          this.persistentKey(context, command.idempotencyKey),
          requestFingerprint,
        );
        if (!replay) throw error;
        return replay;
      });
    }
  }

  private async replay(
    tx: Prisma.TransactionClient,
    persistentKey: string,
    requestFingerprint: string,
  ): Promise<ShipmentMutationResult | null> {
    const outbox = await tx.outboxEntry.findUnique({ where: { idempotencyKey: persistentKey } });
    if (!outbox) return null;
    const payload = jsonObject(outbox.payload);
    if (payload.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key is already bound to a different logistics command.',
      });
    }
    if (!outbox.auditId || typeof payload.shipmentId !== 'string') {
      throw new ConflictException('Atomic logistics receipt is incomplete.');
    }
    const shipment = await this.findShipment(tx, payload.shipmentId);
    if (!shipment) throw new ConflictException('Logistics replay shipment is no longer visible.');
    const checkpoint = typeof payload.checkpointId === 'string'
      ? await this.findCheckpoint(tx, payload.checkpointId)
      : undefined;
    const gpsPoint = typeof payload.gpsPointId === 'string'
      ? await this.findGpsPoint(tx, payload.gpsPointId)
      : undefined;
    return {
      shipment: publicShipment(shipment),
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      checkpoint,
      gpsPoint,
      valid: typeof payload.valid === 'boolean' ? payload.valid : undefined,
    };
  }

  private async findShipment(
    tx: Prisma.TransactionClient,
    shipmentId: string,
  ): Promise<ShipmentAuthorityRecord | null> {
    const rows = await tx.$queryRaw<ShipmentAuthorityRecord[]>(Prisma.sql`
      SELECT s.*
      FROM public."shipments" s
      WHERE s."id" = ${shipmentId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findCheckpoint(
    tx: Prisma.TransactionClient,
    checkpointId: string,
  ): Promise<ShipmentCheckpointRecord | undefined> {
    const rows = await tx.$queryRaw<ShipmentCheckpointRecord[]>(Prisma.sql`
      SELECT c.*
      FROM public."checkpoints" c
      WHERE c."id" = ${checkpointId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findGpsPoint(
    tx: Prisma.TransactionClient,
    gpsPointId: string,
  ): Promise<ShipmentGpsPointRecord | undefined> {
    const rows = await tx.$queryRaw<ShipmentGpsPointRecord[]>(Prisma.sql`
      SELECT p.*
      FROM public."shipment_gps_points" p
      WHERE p."id" = ${gpsPointId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findGpsTrack(
    tx: Prisma.TransactionClient,
    shipmentId: string,
  ): Promise<ShipmentGpsPointRecord[]> {
    return tx.$queryRaw<ShipmentGpsPointRecord[]>(Prisma.sql`
      SELECT p.*
      FROM public."shipment_gps_points" p
      WHERE p."shipmentId" = ${shipmentId}
      ORDER BY p."recordedAt" ASC, p."id" ASC
      LIMIT 5000
    `);
  }

  private async casPositionUpdate(
    tx: Prisma.TransactionClient,
    shipment: ShipmentAuthorityRecord,
    expectedVersion: bigint,
    lat: number | undefined,
    lng: number | undefined,
    occurredAt: Date,
  ): Promise<ShipmentAuthorityRecord> {
    if (shipment.version !== expectedVersion) throw staleVersion(shipment.version);
    const rows = lat === undefined
      ? await tx.$queryRaw<ShipmentRecord[]>(Prisma.sql`
          UPDATE public."shipments"
          SET "version" = "version" + 1, "updatedAt" = now()
          WHERE "id" = ${shipment.id} AND "version" = ${expectedVersion}
          RETURNING *
        `)
      : await tx.$queryRaw<ShipmentRecord[]>(Prisma.sql`
          UPDATE public."shipments"
          SET "geoLat" = ${lat}, "geoLng" = ${lng as number}, "lastGeoAt" = ${occurredAt},
              "version" = "version" + 1, "updatedAt" = now()
          WHERE "id" = ${shipment.id} AND "version" = ${expectedVersion}
          RETURNING *
        `);
    if (!rows[0]) throw new ConflictException({ code: 'CONCURRENT_SHIPMENT_UPDATE' });
    return rows[0];
  }

  private async casPinUpdate(
    tx: Prisma.TransactionClient,
    shipment: ShipmentAuthorityRecord,
    expectedVersion: bigint,
    valid: boolean,
    failedAttempts: number,
    lockedUntil: Date | null,
    actorUserId: string,
    now: Date,
  ): Promise<ShipmentAuthorityRecord> {
    if (shipment.version !== expectedVersion) throw staleVersion(shipment.version);
    const rows = await tx.$queryRaw<ShipmentRecord[]>(Prisma.sql`
      UPDATE public."shipments"
      SET
        "pinVerified" = ${valid},
        "pinVerifiedAt" = ${valid ? now : null},
        "pinVerifiedByUserId" = ${valid ? actorUserId : null},
        "pinFailedAttempts" = ${failedAttempts},
        "pinLockedUntil" = ${lockedUntil},
        "version" = "version" + 1,
        "updatedAt" = now()
      WHERE "id" = ${shipment.id} AND "version" = ${expectedVersion}
      RETURNING *
    `);
    if (!rows[0]) throw new ConflictException({ code: 'CONCURRENT_SHIPMENT_UPDATE' });
    return rows[0];
  }

  private persistentKey(context: TrustedRlsContext, clientKey: string): string {
    return `logistics:${context.tenantId}:${context.userId}:${clientKey}`;
  }
}

function publicShipment(shipment: ShipmentAuthorityRecord): ShipmentRecord {
  const { driverPinHash: _driverPinHash, ...publicRecord } = shipment;
  return publicRecord;
}

function shipmentState(shipment: ShipmentAuthorityRecord): Prisma.InputJsonObject {
  return {
    id: shipment.id,
    dealId: shipment.dealId,
    tenantId: shipment.tenantId,
    status: shipment.status,
    driverUserId: shipment.driverUserId,
    vehicleNumber: shipment.vehicleNumber,
    carrierOrgId: shipment.carrierOrgId,
    routeFrom: shipment.routeFrom,
    routeTo: shipment.routeTo,
    pinVerified: shipment.pinVerified,
    version: shipment.version.toString(),
    geoLat: shipment.geoLat,
    geoLng: shipment.geoLng,
    lastGeoAt: shipment.lastGeoAt?.toISOString() ?? null,
  };
}

function redactCommand(command: NormalizedCommand): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(command).map(([key, value]) => [key, key === 'pin' ? digest(String(value)) : value]),
  );
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requiredIdentifier(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalIdentifier(value: string | undefined, field: string): string | undefined {
  return value === undefined ? undefined : requiredIdentifier(value, field);
}

function requiredVersion(value: string): bigint {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) throw new BadRequestException({ code: 'INVALID_EXPECTED_VERSION' });
  return BigInt(normalized);
}

function requiredDate(value: string, field: string): Date {
  const date = new Date(String(value ?? ''));
  if (!value || Number.isNaN(date.getTime())) throw new BadRequestException({ code: 'INVALID_DATE', field });
  return date;
}

function requiredCheckpointType(value: string): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized || normalized.length > 80 || !/^[A-Z0-9_]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_CHECKPOINT_TYPE' });
  }
  return normalized;
}

function optionalText(value: string | undefined, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = String(value).normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function requiredCoordinate(value: number, field: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException({ code: 'INVALID_COORDINATE', field });
  }
  return value;
}

function optionalCoordinate(
  value: number | undefined,
  field: string,
  min: number,
  max: number,
): number | undefined {
  return value === undefined ? undefined : requiredCoordinate(value, field, min, max);
}

function optionalRange(
  value: number | undefined,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException({ code: 'INVALID_NUMBER', field });
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function scopedNotFound(): NotFoundException {
  return new NotFoundException('Shipment is not available in the authenticated scope.');
}

function staleVersion(currentVersion: bigint): ConflictException {
  return new ConflictException({
    code: 'STALE_SHIPMENT_VERSION',
    currentVersion: currentVersion.toString(),
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  if (error.code !== 'P2010') return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  return meta?.code === '23505';
}
