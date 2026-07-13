import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Checkpoint, Prisma, Shipment, ShipmentGpsPoint } from '@prisma/client';
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
  ShipmentMutationResult,
  ShipmentRepository,
  ShipmentWorkspace,
  VerifyPinCommand,
} from './shipment.repository';

type MutationArtifacts = Readonly<{
  shipment: Shipment;
  checkpoint?: Checkpoint;
  gpsPoint?: ShipmentGpsPoint;
  valid?: boolean;
  eventPayload: Prisma.InputJsonObject;
}>;

const CHECKPOINT_ROLES = new Set<Role>([
  Role.DRIVER,
  Role.LOGISTICIAN,
  Role.ELEVATOR,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<Shipment[]> {
    return this.rls.withTrustedContext(user, (tx) => tx.shipment.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 500,
    }));
  }

  async getById(id: string, user: RequestUser): Promise<Shipment> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    const shipment = await this.rls.withTrustedContext(user, (tx) => tx.shipment.findUnique({
      where: { id: shipmentId },
    }));
    if (!shipment) throw new NotFoundException('Shipment is not available in the authenticated scope.');
    return shipment;
  }

  async workspace(id: string, user: RequestUser): Promise<ShipmentWorkspace> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    const workspace = await this.rls.withTrustedContext(user, async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
      if (!shipment) return null;
      const [checkpoints, gpsTrack] = await Promise.all([
        tx.checkpoint.findMany({
          where: { shipmentId },
          orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          take: 1_000,
        }),
        tx.shipmentGpsPoint.findMany({
          where: { shipmentId },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
          take: 5_000,
        }),
      ]);
      return { shipment, checkpoints, gpsTrack };
    });
    if (!workspace) throw new NotFoundException('Shipment is not available in the authenticated scope.');
    return workspace;
  }

  async recordCheckpoint(
    id: string,
    command: RecordCheckpointCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult> {
    if (!CHECKPOINT_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot record shipment checkpoints.');
    }
    const normalized = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      type: requiredCheckpointType(command.type),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      lat: optionalCoordinate(command.lat, 'lat', -90, 90),
      lng: optionalCoordinate(command.lng, 'lng', -180, 180),
      note: optionalText(command.note, 'note', 1_000),
    };
    if ((normalized.lat === undefined) !== (normalized.lng === undefined)) {
      throw new BadRequestException({ code: 'COORDINATE_PAIR_REQUIRED' });
    }

    return this.executeMutation(
      normalized.shipmentId,
      normalized,
      user,
      'shipment.checkpoint.record',
      'shipment.checkpoint.recorded',
      async (tx, shipment, context) => {
        const checkpoint = await tx.checkpoint.create({
          data: {
            id: `checkpoint-${randomUUID()}`,
            shipmentId: shipment.id,
            tenantId: context.tenantId,
            type: normalized.type,
            completedAt: normalized.occurredAt,
            lat: normalized.lat ?? null,
            lng: normalized.lng ?? null,
            note: normalized.note ?? null,
            actorId: context.userId,
            commandId: normalized.commandId,
            idempotencyKey: this.persistentKey(context, normalized.idempotencyKey),
            correlationId: normalized.correlationId,
          },
        });
        const updated = await this.casUpdateShipment(tx, shipment, normalized.expectedVersion, {
          ...(normalized.lat === undefined ? {} : {
            geoLat: normalized.lat,
            geoLng: normalized.lng,
            lastGeoAt: normalized.occurredAt,
          }),
        });
        return {
          shipment: updated,
          checkpoint,
          eventPayload: {
            checkpointId: checkpoint.id,
            checkpointType: checkpoint.type,
            occurredAt: checkpoint.completedAt?.toISOString() ?? normalized.occurredAt.toISOString(),
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
    const normalized = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      lat: requiredCoordinate(command.lat, 'lat', -90, 90),
      lng: requiredCoordinate(command.lng, 'lng', -180, 180),
      speedKmh: optionalRange(command.speedKmh, 'speedKmh', 0, 250),
      headingDeg: optionalRange(command.headingDeg, 'headingDeg', 0, 360),
      accuracyM: optionalRange(command.accuracyM, 'accuracyM', 0, 10_000),
      recordedAt: requiredDate(command.recordedAt, 'recordedAt'),
    };

    return this.executeMutation(
      normalized.shipmentId,
      normalized,
      user,
      'shipment.gps.record',
      'shipment.gps.recorded',
      async (tx, shipment, context) => {
        if (user.role === Role.DRIVER && shipment.driverUserId !== context.userId) {
          throw new ForbiddenException('Driver is not assigned to this shipment.');
        }
        const gpsPoint = await tx.shipmentGpsPoint.create({
          data: {
            id: `gps-${randomUUID()}`,
            shipmentId: shipment.id,
            tenantId: context.tenantId,
            actorUserId: context.userId,
            lat: normalized.lat,
            lng: normalized.lng,
            speedKmh: normalized.speedKmh ?? null,
            headingDeg: normalized.headingDeg ?? null,
            accuracyM: normalized.accuracyM ?? null,
            recordedAt: normalized.recordedAt,
            commandId: normalized.commandId,
            idempotencyKey: this.persistentKey(context, normalized.idempotencyKey),
            correlationId: normalized.correlationId,
          },
        });
        const updated = await this.casUpdateShipment(tx, shipment, normalized.expectedVersion, {
          geoLat: normalized.lat,
          geoLng: normalized.lng,
          lastGeoAt: normalized.recordedAt,
        });
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

  async getGpsTrack(id: string, user: RequestUser): Promise<ShipmentGpsPoint[]> {
    const shipmentId = requiredIdentifier(id, 'shipmentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
      if (!shipment) throw new NotFoundException('Shipment is not available in the authenticated scope.');
      return tx.shipmentGpsPoint.findMany({
        where: { shipmentId },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        take: 5_000,
      });
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
    const normalized = {
      shipmentId: requiredIdentifier(id, 'shipmentId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      pinDigest: digest(pin),
    };

    return this.executeMutation(
      normalized.shipmentId,
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
        const updated = await this.casUpdateShipment(tx, shipment, normalized.expectedVersion, valid ? {
          pinVerified: true,
          pinVerifiedAt: now,
          pinVerifiedByUserId: context.userId,
          pinFailedAttempts: 0,
          pinLockedUntil: null,
        } : {
          pinVerified: false,
          pinFailedAttempts: failedAttempts,
          pinLockedUntil: lockedUntil,
        });
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

  private async executeMutation<T extends LogisticsCommand>(
    shipmentId: string,
    command: T,
    user: RequestUser,
    action: string,
    eventType: string,
    work: (
      tx: Prisma.TransactionClient,
      shipment: Shipment,
      context: TrustedRlsContext,
    ) => Promise<MutationArtifacts>,
  ): Promise<ShipmentMutationResult> {
    const requestFingerprint = digest({ action, shipmentId, command: redactCommand(command) });
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, command.idempotencyKey);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
        if (!shipment) throw new NotFoundException('Shipment is not available in the authenticated scope.');
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${shipment.dealId}, 42)) IS NULL AS locked
        `;

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
          shipment: artifacts.shipment,
          auditId,
          outboxId,
          duplicate: false,
          checkpoint: artifacts.checkpoint,
          gpsPoint: artifacts.gpsPoint,
          valid: artifacts.valid,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20_000,
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
    const shipment = await tx.shipment.findUnique({ where: { id: payload.shipmentId } });
    if (!shipment) throw new ConflictException('Logistics replay shipment is no longer visible.');
    const checkpoint = typeof payload.checkpointId === 'string'
      ? await tx.checkpoint.findUnique({ where: { id: payload.checkpointId } }) ?? undefined
      : undefined;
    const gpsPoint = typeof payload.gpsPointId === 'string'
      ? await tx.shipmentGpsPoint.findUnique({ where: { id: payload.gpsPointId } }) ?? undefined
      : undefined;
    return {
      shipment,
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      checkpoint,
      gpsPoint,
      valid: typeof payload.valid === 'boolean' ? payload.valid : undefined,
    };
  }

  private async casUpdateShipment(
    tx: Prisma.TransactionClient,
    shipment: Shipment,
    expectedVersion: bigint,
    data: Prisma.ShipmentUpdateManyMutationInput,
  ): Promise<Shipment> {
    if (shipment.version !== expectedVersion) {
      throw new ConflictException({
        code: 'STALE_SHIPMENT_VERSION',
        currentVersion: shipment.version.toString(),
      });
    }
    const update = await tx.shipment.updateMany({
      where: { id: shipment.id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (update.count !== 1) {
      throw new ConflictException({ code: 'CONCURRENT_SHIPMENT_UPDATE' });
    }
    return tx.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
  }

  private persistentKey(context: TrustedRlsContext, clientKey: string): string {
    return `logistics:${context.tenantId}:${context.userId}:${clientKey}`;
  }
}

function shipmentState(shipment: Shipment): Prisma.InputJsonObject {
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

function redactCommand(command: LogisticsCommand): Record<string, unknown> {
  const candidate = command as unknown as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(candidate).map(([key, value]) => [key, key === 'pin' ? digest(String(value)) : value]),
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

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
