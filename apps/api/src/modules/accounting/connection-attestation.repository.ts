import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { ConnectionKind } from './connection-center.policy';
import {
  type AttestationDecision,
  type AttestationGate,
  type AttestationState,
  type GateAnswer,
  describeAttestation,
  isDecision,
  isGate,
} from './connection-attestation.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Registering what will be attested, and recording the answers.
 *
 * The attestation itself is written by a database function, not by an INSERT
 * from here. The command principal has no grant on the attestation table and
 * does not get one — a grant there would also let this contour write rows about
 * FGIS provider configurations, which it has no business in. The function can
 * only ever write a row about a connection subject, reads the actor and the
 * organization from the session rather than from arguments, and computes the
 * hash itself over the content. A hash the writer chooses is not evidence.
 */

// Existing vocabulary. Registering a connection subject and answering a gate
// about it are both configuring an integration; reading is reading one.
// Minting `attestation.answer` would widen a catalogue whose spec enumerates
// it, and it would not add the guarantee that matters — four *different*
// people — which the database enforces regardless of capability.
const CONFIGURE_CAPABILITY = 'integrations.configure';
const READ_CAPABILITY = 'integrations.read';

export const SubjectOutcome = {
  REGISTERED: 'REGISTERED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
} as const;
export type SubjectOutcome = (typeof SubjectOutcome)[keyof typeof SubjectOutcome];

export const AttestationOutcome = {
  RECORDED: 'RECORDED',
  ALREADY_RECORDED: 'ALREADY_RECORDED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
} as const;
export type AttestationOutcome =
  (typeof AttestationOutcome)[keyof typeof AttestationOutcome];

export interface SubjectView {
  readonly id: string;
  readonly connectionKind: ConnectionKind;
  readonly providerCode: string;
  readonly environment: string;
  readonly version: bigint;
  readonly state: AttestationState;
}

interface SubjectRow {
  id: string;
  connectionKind: string;
  providerCode: string;
  environment: string;
  version: bigint;
}

interface AnswerRow {
  gate: string;
  decision: string;
}

@Injectable()
export class ConnectionAttestationRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /** Every subject this organization has registered, with what it adds up to. */
  async list(user: RequestUser | undefined): Promise<readonly SubjectView[]> {
    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (capabilities.includes(READ_CAPABILITY) === false) {
        return [];
      }

      const subjects = await tx.$queryRaw<SubjectRow[]>`
        SELECT s."id", s."connectionKind", s."providerCode", s."environment",
               s."version"
          FROM public."connection_attestation_subjects" s
         WHERE s."organizationId" = ${context.orgId}
         ORDER BY s."connectionKind", s."providerCode", s."environment"
      `;

      const views: SubjectView[] = [];
      for (const subject of subjects) {
        views.push({
          id: subject.id,
          connectionKind: subject.connectionKind as ConnectionKind,
          providerCode: subject.providerCode,
          environment: subject.environment,
          version: subject.version,
          state: describeAttestation(await this.answers(tx, subject.id)),
        });
      }
      return views;
    });
  }

  /**
   * The live gate answers for one subject.
   *
   * Through the definer function, never by selecting the table: the read
   * principal cannot reach the attestation table, because the same table holds
   * the FGIS contour's governance history and this contour has no business
   * reading it. The function answers about connection subjects and nothing else.
   */
  async answers(
    tx: Prisma.TransactionClient,
    subjectId: string,
  ): Promise<readonly GateAnswer[]> {
    const rows = await tx.$queryRaw<AnswerRow[]>`
      SELECT "gate", "decision"
        FROM public.app_pc_crop_connection_attestation_state(${subjectId})
    `;
    return rows
      .filter((row) => isGate(row.gate) && isDecision(row.decision))
      .map((row) => ({
        gate: row.gate as AttestationGate,
        decision: row.decision as AttestationDecision,
      }));
  }

  async register(
    user: RequestUser | undefined,
    input: {
      connectionKind: ConnectionKind;
      providerCode: string;
      environment: string;
    },
  ): Promise<{ outcome: SubjectOutcome; subjectId?: string; refusal?: string }> {
    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);
      if (membership === null || capabilities.includes(CONFIGURE_CAPABILITY) === false) {
        return {
          outcome: SubjectOutcome.REFUSED_BY_POLICY,
          refusal: 'CONFIGURE_CAPABILITY_REQUIRED',
        };
      }

      // Normalized here as well as checked in the database, so the caller gets
      // the subject they meant rather than a constraint violation for a
      // difference in case they cannot see.
      const providerCode = input.providerCode.trim().toUpperCase();

      const existing = await tx.$queryRaw<{ id: string }[]>`
        SELECT s."id"
          FROM public."connection_attestation_subjects" s
         WHERE s."organizationId" = ${context.orgId}
           AND s."connectionKind" = ${input.connectionKind}
           AND s."providerCode" = ${providerCode}
           AND s."environment" = ${input.environment}
         LIMIT 1
      `;
      if (existing[0] !== undefined) {
        return {
          outcome: SubjectOutcome.ALREADY_REGISTERED,
          subjectId: existing[0].id,
        };
      }

      const subjectId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO public."connection_attestation_subjects" (
          "id", "tenantId", "organizationId", "connectionKind", "providerCode",
          "environment", "createdByMembershipId"
        ) VALUES (
          ${subjectId}, ${context.tenantId}, ${context.orgId},
          ${input.connectionKind}, ${providerCode}, ${input.environment},
          ${membership}
        )
      `;
      return { outcome: SubjectOutcome.REGISTERED, subjectId };
    });
  }

  async attest(
    user: RequestUser | undefined,
    input: {
      subjectId: string;
      gate: AttestationGate;
      decision: AttestationDecision;
      justification: string;
      evidenceReference: string;
      validUntil: Date;
      idempotencyKey: string;
      correlationId: string;
    },
  ): Promise<{ outcome: AttestationOutcome; attestationId?: string; refusal?: string }> {
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);
      if (membership === null || capabilities.includes(CONFIGURE_CAPABILITY) === false) {
        return {
          outcome: AttestationOutcome.REFUSED_BY_POLICY,
          refusal: 'CONFIGURE_CAPABILITY_REQUIRED',
        };
      }

      // An attestation records that a person with a verified second factor
      // decided. The database refuses a row without it; refusing here first
      // gives the caller the reason instead of a constraint name.
      if (user?.mfaVerified !== true) {
        return {
          outcome: AttestationOutcome.REFUSED_BY_POLICY,
          refusal: 'MFA_REQUIRED',
        };
      }

      try {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT public.app_pc_crop_record_connection_attestation(
            ${input.subjectId}, ${input.gate}, ${input.decision},
            ${input.justification}, ${input.evidenceReference},
            ${input.validUntil}, ${input.idempotencyKey}, ${input.correlationId}
          ) AS id
        `;
        return {
          outcome: AttestationOutcome.RECORDED,
          attestationId: rows[0]?.id,
        };
      } catch (error) {
        // The idempotency key is unique across the whole table, so a repeat is
        // a repeat rather than a second opinion.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2010'
          && String(error.meta?.message ?? '').includes('idempotencyKey')
        ) {
          return { outcome: AttestationOutcome.ALREADY_RECORDED };
        }
        return {
          outcome: AttestationOutcome.REFUSED_BY_DATABASE,
          refusal: refusalOf(error),
        };
      }
    });
  }
}

/**
 * The database's own words, not a category invented here.
 *
 * The guards raise sentences meant to be read — "this actor already answered the
 * SECURITY gate for this version" — and flattening those into a code would lose
 * the only part the caller can act on.
 */
function refusalOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = String(error.meta?.message ?? error.message);
    const match = /ERROR:\s*(.+?)(\n|$)/u.exec(message);
    return match?.[1]?.trim() ?? message;
  }
  return error instanceof Error ? error.message : String(error);
}
