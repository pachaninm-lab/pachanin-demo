import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  MARKETING_CADENCE_AUDIENCES,
  MARKETING_CONTENT_ANGLES,
  planNextMarketingContent,
  type MarketingContentPlanDecision,
  type MarketingPublishHistoryItem,
} from './marketing-content-planner';
import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';
import {
  ALLOWED_RU_MARKETING_CHANNELS,
  type AdvertisingMetadata,
  type MarketingChannel,
  type MarketingPolicyInput,
  type MarketingPublishRequest,
} from './marketing.types';

export interface MarketingPublicationAdmissionCommand {
  channel: string;
  text: string;
  idempotencyKey: string;
  editorialSlot: number;
  policy: Omit<MarketingPolicyInput, 'channel' | 'text'>;
}

export interface MarketingPublicationAdmission {
  schemaVersion: 'marketing.publication-admission.v1';
  admissionId: string;
  issuedAt: string;
  expiresAt: string;
  request: MarketingPublishRequest;
  cadence: Extract<MarketingContentPlanDecision, { allowed: true }>;
  contentSha256: string;
  commandSha256: string;
  authoritySha256: string;
  outboxIdempotencyKey: string;
  hmacSha256: string;
}

interface HistoryRow {
  id: string;
  payload: unknown;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

type PublishPolicy = Omit<MarketingPolicyInput, 'channel' | 'text'>;
type AllowedCadence = Extract<MarketingContentPlanDecision, { allowed: true }>;

const RESERVED_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'CONFIRMED'] as const;
const ALLOWED_CHANNEL_SET = new Set<string>(ALLOWED_RU_MARKETING_CHANNELS);
const CLASSIFICATIONS = new Set(['INFORMATIONAL', 'ADVERTISING', 'UNCERTAIN']);
const RISK_CLASSES = new Set([
  'NONE',
  'LEGAL_INTERPRETATION',
  'POLITICS',
  'CRISIS',
  'FINANCIAL_PROMISE',
  'HEALTH_OR_SAFETY',
]);
const DESTINATION_RISKS = new Set(['CLEARED', 'UNKNOWN', 'RESTRICTED']);
const EDITORIAL_PILLARS = new Set(['USEFUL', 'PRODUCT_PROOF', 'CONVERSION']);
const REQUEST_KEYS = new Set(['channel', 'text', 'idempotencyKey', 'policy']);
const COMMAND_KEYS = new Set(['channel', 'text', 'idempotencyKey', 'editorialSlot', 'policy']);
const POLICY_KEYS = new Set([
  'classification',
  'requiresEvidence',
  'evidenceIds',
  'requiresFreshness',
  'freshnessCheckedAt',
  'maxEvidenceAgeHours',
  'riskClass',
  'containsPersonalData',
  'destinationRisk',
  'isDirectMessage',
  'recipientInitiated',
  'marketingConsentId',
  'advertising',
]);
const ADVERTISING_KEYS = new Set([
  'erid',
  'advertiserName',
  'advertiserInn',
  'hasAdvertisingLabel',
  'isPaidPlacement',
]);
const CADENCE_KEYS = new Set([
  'allowed',
  'reason',
  'channel',
  'audience',
  'angle',
  'editorialPillar',
  'editorialSlot',
  'operatingDay',
  'channelSequence',
]);
const ADMISSION_KEYS = new Set([
  'schemaVersion',
  'admissionId',
  'issuedAt',
  'expiresAt',
  'request',
  'cadence',
  'contentSha256',
  'commandSha256',
  'authoritySha256',
  'outboxIdempotencyKey',
  'hmacSha256',
]);
const OUTBOX_PREFIX = 'marketing:social-publish:v2:';
const ADMISSION_TTL_MS = 15 * 60 * 1_000;
const FUTURE_SKEW_MS = 5 * 60 * 1_000;
const HISTORY_LIMIT = 5_000;
const HISTORY_WINDOW_DAYS = 30;
const MAX_TEXT_CHARS = 6_000;
const MAX_EVIDENCE_IDS = 64;
const STRONG_SECRET_MIN_BYTES = 32;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const ADMISSION_ID_PATTERN = /^mktadm\.v1\.[0-9a-f]{32}$/u;

function failClosed(message: string): never {
  throw new ServiceUnavailableException(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function stableJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) failClosed('Marketing publication JSON contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!isRecord(value)) failClosed('Marketing publication JSON contains an unsupported value.');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  const material = typeof value === 'string' ? value : stableJson(value);
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

function decodeSecret(value: string): Buffer {
  const trimmed = value.trim();
  if (trimmed.startsWith('base64:')) return Buffer.from(trimmed.slice(7), 'base64');
  if (/^[0-9a-f]{64,}$/iu.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'utf8');
}

export function marketingPublicationAdmissionSecret(
  environment: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  const raw = environment.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;
  if (!raw?.trim()) return null;
  const secret = decodeSecret(raw);
  if (secret.length < STRONG_SECRET_MIN_BYTES) return null;
  if (secret.every((byte) => byte === secret[0])) return null;
  return secret;
}

function requiredSecret(): Buffer {
  const secret = marketingPublicationAdmissionSecret();
  if (!secret) failClosed('Marketing publication admission HMAC secret is missing or weak.');
  return secret;
}

function hmac(secret: Buffer, value: unknown): string {
  return createHmac('sha256', secret).update(stableJson(value), 'utf8').digest('hex');
}

function optionalString(value: unknown, label: string, max = 300): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') failClosed(`Marketing publication ${label} is invalid.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    failClosed(`Marketing publication ${label} is invalid.`);
  }
  return normalized;
}

function normalizePolicy(value: unknown): PublishPolicy {
  if (!isRecord(value) || !hasOnlyKeys(value, POLICY_KEYS)) {
    failClosed('Marketing publication policy schema is invalid.');
  }
  if (
    typeof value.classification !== 'string'
    || !CLASSIFICATIONS.has(value.classification)
    || typeof value.requiresEvidence !== 'boolean'
    || !Array.isArray(value.evidenceIds)
    || value.evidenceIds.length > MAX_EVIDENCE_IDS
    || typeof value.riskClass !== 'string'
    || !RISK_CLASSES.has(value.riskClass)
    || typeof value.containsPersonalData !== 'boolean'
    || typeof value.destinationRisk !== 'string'
    || !DESTINATION_RISKS.has(value.destinationRisk)
    || typeof value.isDirectMessage !== 'boolean'
  ) {
    failClosed('Marketing publication policy fields are invalid.');
  }

  const evidenceIds = value.evidenceIds.map((item) => {
    if (typeof item !== 'string') failClosed('Marketing publication evidence identifiers are invalid.');
    const normalized = item.trim();
    if (!normalized || normalized.length > 200) {
      failClosed('Marketing publication evidence identifiers are invalid.');
    }
    return normalized;
  });
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    failClosed('Marketing publication evidence identifiers are duplicated.');
  }
  if (value.requiresFreshness !== undefined && typeof value.requiresFreshness !== 'boolean') {
    failClosed('Marketing publication freshness requirement is invalid.');
  }
  const freshnessCheckedAt = optionalString(value.freshnessCheckedAt, 'freshness timestamp', 40);
  if (value.maxEvidenceAgeHours !== undefined && (
    typeof value.maxEvidenceAgeHours !== 'number'
    || !Number.isFinite(value.maxEvidenceAgeHours)
    || value.maxEvidenceAgeHours <= 0
    || value.maxEvidenceAgeHours > 8_760
  )) {
    failClosed('Marketing publication evidence age is invalid.');
  }
  if (value.recipientInitiated !== undefined && typeof value.recipientInitiated !== 'boolean') {
    failClosed('Marketing publication recipient-initiation state is invalid.');
  }
  const marketingConsentId = optionalString(value.marketingConsentId, 'consent identifier', 200);

  let advertising: AdvertisingMetadata | undefined;
  if (value.advertising !== undefined) {
    if (!isRecord(value.advertising) || !hasOnlyKeys(value.advertising, ADVERTISING_KEYS)) {
      failClosed('Marketing publication advertising metadata schema is invalid.');
    }
    const hasAdvertisingLabel = value.advertising.hasAdvertisingLabel;
    const isPaidPlacement = value.advertising.isPaidPlacement;
    if (hasAdvertisingLabel !== undefined && typeof hasAdvertisingLabel !== 'boolean') {
      failClosed('Marketing publication advertising marker state is invalid.');
    }
    if (isPaidPlacement !== undefined && typeof isPaidPlacement !== 'boolean') {
      failClosed('Marketing publication paid-placement state is invalid.');
    }
    advertising = Object.freeze({
      ...(optionalString(value.advertising.erid, 'ERID', 200) ? {
        erid: optionalString(value.advertising.erid, 'ERID', 200),
      } : {}),
      ...(optionalString(value.advertising.advertiserName, 'advertiser name') ? {
        advertiserName: optionalString(value.advertising.advertiserName, 'advertiser name'),
      } : {}),
      ...(optionalString(value.advertising.advertiserInn, 'advertiser INN', 12) ? {
        advertiserInn: optionalString(value.advertising.advertiserInn, 'advertiser INN', 12),
      } : {}),
      ...(hasAdvertisingLabel === undefined ? {} : { hasAdvertisingLabel }),
      ...(isPaidPlacement === undefined ? {} : { isPaidPlacement }),
    });
  }

  const requiresFreshness = value.requiresFreshness as boolean | undefined;
  const maxEvidenceAgeHours = value.maxEvidenceAgeHours as number | undefined;
  const recipientInitiated = value.recipientInitiated as boolean | undefined;
  return Object.freeze({
    classification: value.classification as PublishPolicy['classification'],
    requiresEvidence: value.requiresEvidence,
    evidenceIds: Object.freeze(evidenceIds),
    ...(requiresFreshness === undefined ? {} : { requiresFreshness }),
    ...(freshnessCheckedAt === undefined ? {} : { freshnessCheckedAt }),
    ...(maxEvidenceAgeHours === undefined ? {} : { maxEvidenceAgeHours }),
    riskClass: value.riskClass as PublishPolicy['riskClass'],
    containsPersonalData: value.containsPersonalData,
    destinationRisk: value.destinationRisk as PublishPolicy['destinationRisk'],
    isDirectMessage: value.isDirectMessage,
    ...(recipientInitiated === undefined ? {} : { recipientInitiated }),
    ...(marketingConsentId === undefined ? {} : { marketingConsentId }),
    ...(advertising === undefined ? {} : { advertising }),
  });
}

function normalizeRequest(value: unknown): MarketingPublishRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, REQUEST_KEYS)) {
    failClosed('Marketing publication request schema is invalid.');
  }
  if (typeof value.channel !== 'string' || !ALLOWED_CHANNEL_SET.has(value.channel)) {
    failClosed('Marketing publication channel is not allowlisted.');
  }
  if (typeof value.text !== 'string') failClosed('Marketing publication text is invalid.');
  const text = value.text.trim();
  if (!text || text.length > MAX_TEXT_CHARS) failClosed('Marketing publication text is invalid.');
  if (typeof value.idempotencyKey !== 'string') {
    failClosed('Marketing publication idempotency key is invalid.');
  }
  const idempotencyKey = value.idempotencyKey.trim();
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    failClosed('Marketing publication idempotency key is invalid.');
  }
  return Object.freeze({
    channel: value.channel,
    text,
    idempotencyKey,
    policy: normalizePolicy(value.policy),
  });
}

function normalizeCommand(value: unknown): {
  request: MarketingPublishRequest;
  editorialSlot: number;
  outboxIdempotencyKey: string;
  commandSha256: string;
} {
  if (!isRecord(value)) failClosed('Marketing publication command is invalid.');
  if (Object.prototype.hasOwnProperty.call(value, 'history')) {
    failClosed('Marketing publication cadence history is PostgreSQL-authoritative.');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'now')) {
    failClosed('Marketing publication admission time is server-authoritative.');
  }
  if (!hasOnlyKeys(value, COMMAND_KEYS)) failClosed('Marketing publication command schema is invalid.');
  if (!Number.isSafeInteger(value.editorialSlot) || (value.editorialSlot as number) < 0) {
    failClosed('Marketing publication editorial slot is invalid.');
  }
  const request = normalizeRequest({
    channel: value.channel,
    text: value.text,
    idempotencyKey: value.idempotencyKey,
    policy: value.policy,
  });
  const editorialSlot = value.editorialSlot as number;
  const outboxIdempotencyKey = `${OUTBOX_PREFIX}${request.idempotencyKey}`;
  return Object.freeze({
    request,
    editorialSlot,
    outboxIdempotencyKey,
    commandSha256: sha256({ request, editorialSlot }),
  });
}

function assertOperatingDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    failClosed('Marketing publication cadence operating day is invalid.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) failClosed('Marketing publication cadence operating day is invalid.');
  return value;
}

function assertCadence(value: unknown): AllowedCadence {
  if (!isRecord(value) || !hasOnlyKeys(value, CADENCE_KEYS)) {
    failClosed('Marketing publication cadence is malformed.');
  }
  if (
    value.allowed !== true
    || value.reason !== 'ALLOW'
    || typeof value.channel !== 'string'
    || !ALLOWED_CHANNEL_SET.has(value.channel)
    || !MARKETING_CADENCE_AUDIENCES.includes(value.audience as never)
    || !MARKETING_CONTENT_ANGLES.includes(value.angle as never)
    || typeof value.editorialPillar !== 'string'
    || !EDITORIAL_PILLARS.has(value.editorialPillar)
    || !Number.isSafeInteger(value.editorialSlot)
    || (value.editorialSlot as number) < 0
    || !Number.isSafeInteger(value.channelSequence)
    || (value.channelSequence as number) < 1
  ) failClosed('Marketing publication cadence is malformed.');

  return Object.freeze({
    allowed: true,
    reason: 'ALLOW',
    channel: value.channel as MarketingChannel,
    audience: value.audience as AllowedCadence['audience'],
    angle: value.angle as AllowedCadence['angle'],
    editorialPillar: value.editorialPillar as AllowedCadence['editorialPillar'],
    editorialSlot: value.editorialSlot as number,
    operatingDay: assertOperatingDay(value.operatingDay),
    channelSequence: value.channelSequence as number,
  });
}

function canonicalIso(value: unknown, label: string): { iso: string; at: number } {
  if (typeof value !== 'string') failClosed(`Marketing publication ${label} is invalid.`);
  const at = Date.parse(value);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value) {
    failClosed(`Marketing publication ${label} is invalid.`);
  }
  return { iso: value, at };
}

function assertAdmissionObject(value: unknown): MarketingPublicationAdmission {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ADMISSION_KEYS)
    || value.schemaVersion !== 'marketing.publication-admission.v1'
  ) failClosed('Marketing publication admission schema is invalid.');
  return value as unknown as MarketingPublicationAdmission;
}

function unsignedAdmission(admission: MarketingPublicationAdmission) {
  const { hmacSha256: _hmacSha256, ...unsigned } = admission;
  return unsigned;
}

function verifyAdmissionIntegrity(
  value: unknown,
  expectedOutboxIdempotencyKey: string | null | undefined,
  secret: Buffer,
): MarketingPublicationAdmission {
  const admission = assertAdmissionObject(value);
  if (!SHA256_PATTERN.test(admission.hmacSha256)) {
    failClosed('Marketing publication admission HMAC is invalid.');
  }
  const expectedHmac = Buffer.from(hmac(secret, unsignedAdmission(admission)), 'hex');
  const actualHmac = Buffer.from(admission.hmacSha256, 'hex');
  if (actualHmac.length !== expectedHmac.length || !timingSafeEqual(actualHmac, expectedHmac)) {
    failClosed('Marketing publication admission HMAC is invalid.');
  }

  if (!ADMISSION_ID_PATTERN.test(admission.admissionId)) {
    failClosed('Marketing publication admission identity is invalid.');
  }
  const issued = canonicalIso(admission.issuedAt, 'issued timestamp');
  const expires = canonicalIso(admission.expiresAt, 'expiry timestamp');
  if (expires.at <= issued.at || expires.at - issued.at > ADMISSION_TTL_MS) {
    failClosed('Marketing publication admission lifetime is invalid.');
  }

  const request = normalizeRequest(admission.request);
  const cadence = assertCadence(admission.cadence);
  if (cadence.channel !== request.channel) {
    failClosed('Marketing publication admission channel binding is invalid.');
  }
  const outboxIdempotencyKey = `${OUTBOX_PREFIX}${request.idempotencyKey}`;
  if (
    admission.outboxIdempotencyKey !== outboxIdempotencyKey
    || (expectedOutboxIdempotencyKey !== undefined
      && admission.outboxIdempotencyKey !== expectedOutboxIdempotencyKey)
  ) failClosed('Marketing publication admission idempotency binding is invalid.');

  const commandSha256 = sha256({ request, editorialSlot: cadence.editorialSlot });
  if (admission.commandSha256 !== commandSha256) {
    failClosed('Marketing publication admission command digest is invalid.');
  }
  if (admission.contentSha256 !== sha256(request.text)) {
    failClosed('Marketing publication admission content digest is invalid.');
  }
  if (admission.authoritySha256 !== sha256({
    request,
    cadence,
    outboxIdempotencyKey,
    commandSha256,
  })) failClosed('Marketing publication admission authority digest is invalid.');

  return Object.freeze({ ...admission, request, cadence });
}

function historyItemFromRow(row: HistoryRow, secret: Buffer): MarketingPublishHistoryItem {
  if (!row.idempotencyKey) {
    failClosed(`Marketing publication history row ${row.id} idempotency binding is missing.`);
  }
  if (!RESERVED_STATUSES.includes(row.status as never)) {
    failClosed(`Marketing publication history row ${row.id} status is invalid.`);
  }
  if ((row.status === 'SENT' || row.status === 'CONFIRMED') && !row.sentAt) {
    failClosed(`Marketing publication history row ${row.id} is missing sentAt.`);
  }
  if (!isRecord(row.payload) || row.payload.schemaVersion !== 'marketing.social-publish.v2') {
    failClosed(`Marketing publication history row ${row.id} is malformed.`);
  }
  const admission = verifyAdmissionIntegrity(row.payload.admission, row.idempotencyKey, secret);
  const effectiveAt = row.status === 'SENT' || row.status === 'CONFIRMED'
    ? row.sentAt
    : row.createdAt;
  if (!(effectiveAt instanceof Date)) {
    failClosed(`Marketing publication history row ${row.id} has no effective timestamp.`);
  }
  if (effectiveAt.getTime() < Date.parse(admission.issuedAt) - FUTURE_SKEW_MS) {
    failClosed(`Marketing publication history row ${row.id} predates its admission.`);
  }
  return Object.freeze({
    channel: admission.cadence.channel,
    audience: admission.cadence.audience,
    angle: admission.cadence.angle,
    publishedAt: effectiveAt.toISOString(),
  });
}

@Injectable()
export class MarketingPublicationAdmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async admitAndEnqueue(command: MarketingPublicationAdmissionCommand): Promise<{
    entry: ReturnType<MarketingPublicationAdmissionService['toOutboxEntry']>;
    replayed: boolean;
  }> {
    const normalized = normalizeCommand(command);
    const secret = requiredSecret();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`marketing-publication-admission:${normalized.request.channel}`}, 0)
        )
      `);

      const existing = await tx.outboxEntry.findUnique({
        where: { idempotencyKey: normalized.outboxIdempotencyKey },
      });
      if (existing) {
        if (
          existing.type !== MARKETING_SOCIAL_PUBLISH_EVENT_TYPE
          || !isRecord(existing.payload)
          || existing.payload.schemaVersion !== 'marketing.social-publish.v2'
        ) failClosed('Marketing publication idempotency row is malformed.');
        const admission = verifyAdmissionIntegrity(
          existing.payload.admission,
          existing.idempotencyKey,
          secret,
        );
        if (admission.commandSha256 !== normalized.commandSha256) {
          failClosed('Marketing publication idempotency key conflicts with existing command.');
        }
        return { entry: this.toOutboxEntry(existing), replayed: true };
      }

      const serverTime = await tx.$queryRaw<Array<{ now: Date }>>(
        Prisma.sql`SELECT NOW() AS "now"`,
      );
      const now = serverTime[0]?.now;
      if (!(now instanceof Date)) failClosed('Marketing publication server clock is unavailable.');

      const historyRows = await tx.$queryRaw<HistoryRow[]>(Prisma.sql`
        SELECT "id", "payload", "status", "idempotencyKey", "createdAt", "sentAt"
        FROM "outbox_entries"
        WHERE "type" = ${MARKETING_SOCIAL_PUBLISH_EVENT_TYPE}
          AND "status" IN (${Prisma.join([...RESERVED_STATUSES])})
          AND (
            ("status" IN ('SENT', 'CONFIRMED') AND (
              "sentAt" >= NOW() - make_interval(days => ${HISTORY_WINDOW_DAYS})
              OR (
                "sentAt" IS NULL
                AND "createdAt" >= NOW() - make_interval(days => ${HISTORY_WINDOW_DAYS})
              )
            ))
            OR (
              "status" IN ('PENDING', 'PROCESSING')
              AND "createdAt" >= NOW() - make_interval(days => ${HISTORY_WINDOW_DAYS})
            )
          )
        ORDER BY COALESCE("sentAt", "createdAt") DESC, "id" DESC
        LIMIT ${HISTORY_LIMIT + 1}
      `);
      if (historyRows.length > HISTORY_LIMIT) {
        failClosed('Marketing publication cadence history exceeds bounded authority.');
      }

      const history = historyRows.map((row) => historyItemFromRow(row, secret));
      const cadence = planNextMarketingContent({
        channel: normalized.request.channel,
        now: now.toISOString(),
        editorialSlot: normalized.editorialSlot,
        history,
      });
      if (!cadence.allowed) {
        failClosed(`Marketing publication cadence denied: ${cadence.reason}`);
      }

      const admission = this.createAdmission({
        request: normalized.request,
        cadence,
        outboxIdempotencyKey: normalized.outboxIdempotencyKey,
        issuedAt: now,
      });
      const payload = {
        schemaVersion: 'marketing.social-publish.v2' as const,
        admission,
      };
      const created = await tx.outboxEntry.create({
        data: {
          type: MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: 'PENDING',
          idempotencyKey: normalized.outboxIdempotencyKey,
          correlationId: `marketing:${admission.admissionId}`,
          maxRetries: 6,
          nextRetryAt: now,
        },
      });
      return { entry: this.toOutboxEntry(created), replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  createAdmission(params: {
    request: MarketingPublishRequest;
    cadence: AllowedCadence;
    outboxIdempotencyKey: string;
    issuedAt: Date;
  }): MarketingPublicationAdmission {
    if (!(params.issuedAt instanceof Date) || !Number.isFinite(params.issuedAt.getTime())) {
      failClosed('Marketing publication issued timestamp is invalid.');
    }
    const request = normalizeRequest(params.request);
    const cadence = assertCadence(params.cadence);
    const expectedOutboxIdempotencyKey = `${OUTBOX_PREFIX}${request.idempotencyKey}`;
    if (
      cadence.channel !== request.channel
      || params.outboxIdempotencyKey !== expectedOutboxIdempotencyKey
    ) failClosed('Marketing publication admission binding is invalid.');

    const issuedAt = params.issuedAt.toISOString();
    const expiresAt = new Date(params.issuedAt.getTime() + ADMISSION_TTL_MS).toISOString();
    const commandSha256 = sha256({ request, editorialSlot: cadence.editorialSlot });
    const contentSha256 = sha256(request.text);
    const authoritySha256 = sha256({
      request,
      cadence,
      outboxIdempotencyKey: expectedOutboxIdempotencyKey,
      commandSha256,
    });
    const unsigned = Object.freeze({
      schemaVersion: 'marketing.publication-admission.v1' as const,
      admissionId: `mktadm.v1.${randomBytes(16).toString('hex')}`,
      issuedAt,
      expiresAt,
      request,
      cadence,
      contentSha256,
      commandSha256,
      authoritySha256,
      outboxIdempotencyKey: expectedOutboxIdempotencyKey,
    });
    return Object.freeze({
      ...unsigned,
      hmacSha256: hmac(requiredSecret(), unsigned),
    });
  }

  verify(
    value: unknown,
    outboxIdempotencyKey?: string | null,
    nowMs: number = Date.now(),
  ): MarketingPublishRequest {
    if (!Number.isFinite(nowMs)) failClosed('Marketing publication verification time is invalid.');
    const admission = verifyAdmissionIntegrity(value, outboxIdempotencyKey, requiredSecret());
    const issuedAt = Date.parse(admission.issuedAt);
    const expiresAt = Date.parse(admission.expiresAt);
    if (issuedAt > nowMs + FUTURE_SKEW_MS) {
      failClosed('Marketing publication admission is not yet valid.');
    }
    if (nowMs >= expiresAt) failClosed('Marketing publication admission is expired.');
    return admission.request;
  }

  private toOutboxEntry(row: {
    id: string;
    type: string;
    payload: Prisma.JsonValue;
    status: string;
    idempotencyKey: string | null;
    maxRetries: number;
    retryCount: number;
    nextRetryAt: Date;
    correlationId: string | null;
    createdAt: Date;
    sentAt: Date | null;
    confirmedAt: Date | null;
    failedAt: Date | null;
  }) {
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      status: row.status,
      idempotencyKey: row.idempotencyKey,
      maxRetries: row.maxRetries,
      retryCount: row.retryCount,
      nextRetryAt: row.nextRetryAt.toISOString(),
      correlationId: row.correlationId ?? undefined,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString(),
      failedAt: row.failedAt?.toISOString(),
    };
  }
}
