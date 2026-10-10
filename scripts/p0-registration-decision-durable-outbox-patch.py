#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPLEMENTATION_BRANCH = "fix/p0-registration-decision-durable-outbox-4858"
MIGRATION_PATH = "apps/api/prisma/migrations/20260831211500_p0_registration_decision_mail_status/migration.sql"
SCOPE_PATH = "docs/platform-v7/autopilot/scopes/p0-registration-decision-durable-outbox-4858.json"

ALLOWED_PATHS = [
    MIGRATION_PATH,
    "apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts",
    "apps/api/src/modules/auth-mail/auth-mail-outbox.service.spec.ts",
    "apps/api/src/modules/auth-mail/auth-mail-templates.ts",
    "apps/api/src/modules/auth/registration-decision.service.ts",
    "apps/api/src/modules/auth/registration-decision.service.spec.ts",
    "apps/web/app/api/staff/[...path]/route.ts",
    "apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts",
    "apps/web/components/platform-v7/staff/RegistrationReviewQueue.tsx",
    "apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx",
    "apps/web/tests/unit/p0HumanReviewerCeremony.test.ts",
    "apps/web/tests/unit/p0FirstCustomerCompletion.test.ts",
    "docs/ops/production-p0-first-customer-acceptance.md",
    SCOPE_PATH,
]


class PatchError(RuntimeError):
    pass


class Workspace:
    def __init__(self, write: bool) -> None:
        self.write = write
        self.contents: dict[str, str] = {}

    def read(self, relative: str) -> str:
        if relative not in self.contents:
            path = ROOT / relative
            if not path.is_file():
                raise PatchError(f"missing source file: {relative}")
            self.contents[relative] = path.read_text(encoding="utf-8")
        return self.contents[relative]

    def set(self, relative: str, value: str) -> None:
        self.contents[relative] = value

    def replace_once(self, relative: str, old: str, new: str, label: str) -> None:
        source = self.read(relative)
        count = source.count(old)
        if count != 1:
            raise PatchError(f"{relative}: {label}: expected one anchor, found {count}")
        self.set(relative, source.replace(old, new, 1))

    def replace_all(self, relative: str, old: str, new: str, expected: int, label: str) -> None:
        source = self.read(relative)
        count = source.count(old)
        if count != expected:
            raise PatchError(f"{relative}: {label}: expected {expected} anchors, found {count}")
        self.set(relative, source.replace(old, new))

    def replace_span(self, relative: str, start: str, end: str, replacement: str, label: str) -> None:
        source = self.read(relative)
        start_count = source.count(start)
        if start_count != 1:
            raise PatchError(f"{relative}: {label}: start anchor count {start_count}")
        start_at = source.index(start)
        end_at = source.find(end, start_at + len(start))
        if end_at < 0:
            raise PatchError(f"{relative}: {label}: end anchor missing")
        self.set(relative, source[:start_at] + replacement + source[end_at:])

    def replace_span_including(self, relative: str, start: str, end: str, replacement: str, label: str) -> None:
        source = self.read(relative)
        start_count = source.count(start)
        if start_count != 1:
            raise PatchError(f"{relative}: {label}: start anchor count {start_count}")
        start_at = source.index(start)
        end_at = source.find(end, start_at + len(start))
        if end_at < 0:
            raise PatchError(f"{relative}: {label}: end anchor missing")
        end_at += len(end)
        self.set(relative, source[:start_at] + replacement + source[end_at:])

    def create(self, relative: str, value: str) -> None:
        if (ROOT / relative).exists() or relative in self.contents:
            raise PatchError(f"new file already exists: {relative}")
        self.contents[relative] = value

    def flush(self) -> None:
        if not self.write:
            return
        for relative, value in self.contents.items():
            path = ROOT / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value, encoding="utf-8")


def patch_templates(ws: Workspace) -> None:
    path = "apps/api/src/modules/auth-mail/auth-mail-templates.ts"
    anchor = "export function passwordResetMail(input: {\n"
    addition = """export function registrationDecisionMail(input: {
  to: string;
  status: string;
  reason: string | null;
}): AuthMailEnvelope {
  const status = String(input.status || 'UPDATED').trim().slice(0, 64);
  const reason = String(input.reason || 'RECORDED').trim().slice(0, 1000);
  return {
    to: input.to,
    subject: 'Прозрачная Цена — статус заявки / application status / 申请状态',
    text: [
      `Статус регистрационной заявки: ${status}. Основание: ${reason}. Откройте страницу статуса по исходной защищённой ссылке.`,
      '',
      `Registration application status: ${status}. Basis: ${reason}. Open the status page using the original protected link.`,
      '',
      `注册申请状态：${status}。依据：${reason}。请使用原始安全链接打开状态页面。`,
    ].join('\\n'),
  };
}

"""
    ws.replace_once(path, anchor, addition + anchor, "registration decision template")


def patch_outbox_service(ws: Workspace) -> None:
    path = "apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts"
    ws.replace_once(
        path,
        "import { randomUUID } from 'node:crypto';\n",
        "import { randomUUID } from 'node:crypto';\nimport { setTimeout as delay } from 'node:timers/promises';\n",
        "poll delay import",
    )
    ws.replace_once(
        path,
        "type EnqueueResult = { outbox_id: string; replayed: boolean };\n",
        """type EnqueueResult = { outbox_id: string; replayed: boolean };

export type RegistrationDecisionMailDelivery = {
  status: 'MISSING' | 'PENDING' | 'PROCESSING' | 'SENT' | 'DEAD_LETTER';
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  sentAt: Date | null;
};
""",
        "delivery status type",
    )
    source = ws.read(path)
    marker = "\n}\n"
    end_at = source.rfind(marker)
    if end_at < 0:
        raise PatchError(f"{path}: class closing anchor missing")
    methods = """

  async registrationDecisionStatus(
    client: AuthSqlClient,
    idempotencyKeyInput: string,
  ): Promise<RegistrationDecisionMailDelivery> {
    const idempotencyKey = String(idempotencyKeyInput || '').trim();
    if (!/^auth-mail:registration-decision:[a-f0-9]{64}$/.test(idempotencyKey)) {
      throw new Error('Registration-decision mail idempotency key is invalid');
    }
    const rows = await client.$queryRaw<Array<{
      delivery_status: RegistrationDecisionMailDelivery['status'];
      attempt_count: number;
      max_attempts: number;
      last_error_code: string | null;
      sent_at: Date | null;
    }>>(Prisma.sql`
      SELECT delivery_status, attempt_count, max_attempts, last_error_code, sent_at
      FROM auth.registration_decision_mail_delivery_status(${idempotencyKey}::text)
    `);
    const row = rows[0];
    if (!row || !['MISSING', 'PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER'].includes(row.delivery_status)) {
      throw new Error('Registration-decision mail status authority returned an invalid result');
    }
    return {
      status: row.delivery_status,
      attemptCount: Number(row.attempt_count || 0),
      maxAttempts: Number(row.max_attempts || 0),
      lastErrorCode: row.last_error_code || null,
      sentAt: row.sent_at || null,
    };
  }

  async waitForRegistrationDecisionDelivery(
    client: AuthSqlClient,
    idempotencyKey: string,
    options: { timeoutMs?: number; pollMs?: number } = {},
  ): Promise<RegistrationDecisionMailDelivery> {
    const timeoutMs = options.timeoutMs ?? 50_000;
    const pollMs = options.pollMs ?? 250;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
      throw new Error('Registration-decision delivery timeout is invalid');
    }
    if (!Number.isInteger(pollMs) || pollMs < 100 || pollMs > 2_000) {
      throw new Error('Registration-decision delivery poll interval is invalid');
    }
    const deadline = Date.now() + timeoutMs;
    let latest = await this.registrationDecisionStatus(client, idempotencyKey);
    while (!['SENT', 'DEAD_LETTER'].includes(latest.status) && Date.now() < deadline) {
      await delay(Math.min(pollMs, Math.max(1, deadline - Date.now())));
      latest = await this.registrationDecisionStatus(client, idempotencyKey);
    }
    return latest;
  }
"""
    ws.set(path, source[:end_at] + methods + source[end_at:])


def patch_registration_service(ws: Workspace) -> None:
    path = "apps/api/src/modules/auth/registration-decision.service.ts"
    ws.replace_once(
        path,
        "  NotFoundException,\n} from '@nestjs/common';",
        "  NotFoundException,\n  ServiceUnavailableException,\n} from '@nestjs/common';",
        "service unavailable import",
    )
    ws.replace_once(
        path,
        "import type { RequestUser, Role } from '../../common/types/request-user';\n",
        """import type { RequestUser, Role } from '../../common/types/request-user';
import { AuthMailOutboxService } from '../auth-mail/auth-mail-outbox.service';
import { registrationDecisionMail } from '../auth-mail/auth-mail-templates';
""",
        "auth mail imports",
    )
    ws.replace_once(
        path,
        "const PLATFORM_REVIEWER_ROLES = new Set(['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF']);\n",
        """const PLATFORM_REVIEWER_ROLES = new Set(['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF']);
const REGISTRATION_DECISION_MAIL_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_DECISION_DELIVERY_TIMEOUT_MS = 50_000;

type RegistrationDecisionResponse = {
  applicationId: string;
  status: string;
  nextAction: 'LOGIN' | 'WAIT';
  version: string;
  correlationId: string;
  replayed: boolean;
  notificationDelivery?: { status: 'SENT' };
};

type RegistrationDecisionTransactionResult = {
  response: RegistrationDecisionResponse;
  mailIdempotencyKey: string;
};
""",
        "decision response types",
    )
    ws.replace_once(
        path,
        "    private readonly authRepository: PersistentAuthRepository,\n  ) {}",
        "    private readonly authRepository: PersistentAuthRepository,\n    private readonly mailOutbox: AuthMailOutboxService,\n  ) {}",
        "mail outbox dependency",
    )

    methods = """  async decideOrganizationJoin(
    applicationId: string,
    decision: 'APPROVE' | 'REJECT',
    reasonInput: string,
    reviewer: RequestUser,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const { reason, idempotencyKey } = this.validateDecisionInput(reasonInput, idempotencyKeyInput);
    const outcome = await this.prisma.$transaction(async (tx): Promise<RegistrationDecisionTransactionResult> => {
      const administrator = await this.requireOrganizationAdmin(reviewer, tx);
      const eventKey = `org-join-decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string; new_status: string }>>(Prisma.sql`
        SELECT event.application_id, event.new_status
        FROM auth.registration_application_events event
        JOIN auth.registration_applications application ON application.id = event.application_id
        WHERE event.idempotency_key = ${eventKey}
          AND application.organization_id = ${administrator.organizationId}
        LIMIT 1
      `);
      if (existing[0]) {
        if (existing[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
          tx, applicationId, eventKey, correlationId,
        );
        return {
          response: await this.readResult(tx, applicationId, true),
          mailIdempotencyKey,
        };
      }

      const application = await this.lockApplication(
        tx,
        applicationId,
        reviewer,
        'ORGANIZATION_ADMIN',
        administrator,
      );
      if (
        application.kind !== 'JOIN_EXISTING_ORGANIZATION'
        || application.organization_id !== administrator.organizationId
        || application.tenant_id !== administrator.tenantId
      ) {
        throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
      }
      if (application.user_id === reviewer.id) {
        throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
      }
      if (!['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }
      if (!isOrganizationHumanRole(application.requested_role)
        || !canAssignOrganizationRole(administrator.role, application.requested_role)) {
        throw new ForbiddenException({ code: 'ROLE_PERMISSION_CEILING_EXCEEDED' });
      }

      if (decision === 'APPROVE') {
        await this.approve(
          tx,
          application,
          reviewer,
          reason,
          idempotencyKey,
          correlationId,
          'ORGANIZATION_ADMIN',
          eventKey,
          administrator,
        );
      } else {
        await this.nonApprovalDecision(
          tx,
          application,
          reviewer,
          'REJECT',
          reason,
          eventKey,
          correlationId,
          'ORGANIZATION_ADMIN',
          administrator,
        );
      }
      await this.audit(tx, {
        userId: reviewer.id,
        membershipId: reviewer.membershipId,
        organizationId: administrator.organizationId,
        tenantId: administrator.tenantId,
        action: 'auth.organization.join_request.decision',
        outcome: 'SUCCESS',
        reason: decision,
        metadata: { applicationId, decisionReason: reason, correlationId },
      });
      if (decision === 'APPROVE') {
        await this.emitRegistrationLifecycleReceipt(tx, applicationId, correlationId);
      }
      const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
        tx, applicationId, eventKey, correlationId,
      );
      return {
        response: await this.readResult(tx, applicationId),
        mailIdempotencyKey,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return this.completeDecisionResponse(outcome, deliveryKey);
  }

  async decide(
    applicationId: string,
    decision: RegistrationDecision,
    reasonInput: string,
    reviewer: RequestUser,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const { reason, idempotencyKey } = this.validateDecisionInput(reasonInput, idempotencyKeyInput);
    this.requireFreshMfa(reviewer);
    this.requirePlatformReviewer(reviewer);

    const outcome = await this.prisma.$transaction(async (tx): Promise<RegistrationDecisionTransactionResult> => {
      await this.requirePlatformDecisionAuthority(reviewer, tx);
      const eventKey = `decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string }>>(Prisma.sql`
        SELECT application_id
        FROM auth.registration_application_events
        WHERE idempotency_key = ${eventKey}
        LIMIT 1
      `);
      if (existing[0]) {
        if (existing[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
          tx, applicationId, eventKey, correlationId,
        );
        return {
          response: await this.readResult(tx, applicationId, true),
          mailIdempotencyKey,
        };
      }

      const application = await this.lockApplication(
        tx,
        applicationId,
        reviewer,
        'PLATFORM_REVIEWER',
      );
      if (application.kind !== 'NEW_ORGANIZATION') {
        throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_DECISION_REQUIRED' });
      }
      if (application.user_id === reviewer.id) {
        throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
      }
      if (!['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED', 'SUSPENDED'].includes(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }

      if (decision === 'APPROVE') {
        await this.approve(tx, application, reviewer, reason, idempotencyKey, correlationId, 'PLATFORM_REVIEWER');
      } else {
        await this.nonApprovalDecision(
          tx,
          application,
          reviewer,
          decision,
          reason,
          eventKey,
          correlationId,
          'PLATFORM_REVIEWER',
        );
      }

      await this.audit(tx, {
        userId: reviewer.id,
        membershipId: reviewer.membershipId,
        organizationId: reviewer.orgId,
        tenantId: reviewer.tenantId,
        action: 'auth.registration.decision',
        outcome: 'SUCCESS',
        reason: decision,
        metadata: {
          applicationId: application.id,
          decisionReason: reason,
          correlationId,
        },
      });
      if (decision === 'APPROVE') {
        await this.emitRegistrationLifecycleReceipt(tx, application.id, correlationId);
      }
      const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
        tx, application.id, eventKey, correlationId,
      );
      return {
        response: await this.readResult(tx, application.id),
        mailIdempotencyKey,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return this.completeDecisionResponse(outcome, deliveryKey);
  }

"""
    ws.replace_span(path, "  async decideOrganizationJoin(\n", "  private async approve(\n", methods, "decision methods")

    result_methods = """  private async queueRegistrationDecisionNotification(
    client: AuthSqlClient,
    applicationId: string,
    eventKey: string,
    correlationId: string,
  ): Promise<string> {
    const rows = await client.$queryRaw<Array<{
      email: string;
      status: string;
      decision_reason: string | null;
    }>>(Prisma.sql`
      SELECT email, status, decision_reason
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    const application = rows[0];
    if (!application?.email) {
      throw new ConflictException({ code: 'REGISTRATION_DECISION_NOTIFICATION_TARGET_MISSING' });
    }
    const mailIdempotencyKey = `auth-mail:registration-decision:${sha256(`${applicationId}\u001f${eventKey}`)}`;
    const current = await this.mailOutbox.registrationDecisionStatus(client, mailIdempotencyKey);
    if (current.status === 'MISSING') {
      await this.mailOutbox.enqueue(client, {
        kind: 'REGISTRATION_DECISION',
        idempotencyKey: mailIdempotencyKey,
        correlationId,
        envelope: registrationDecisionMail({
          to: application.email,
          status: application.status,
          reason: application.decision_reason,
        }),
        expiresAt: new Date(Date.now() + REGISTRATION_DECISION_MAIL_TTL_MS),
        maxAttempts: 12,
      });
    }
    return mailIdempotencyKey;
  }

  private async completeDecisionResponse(
    outcome: RegistrationDecisionTransactionResult,
    deliveryKey?: string,
  ): Promise<RegistrationDecisionResponse> {
    if (!deliveryAuthorized(deliveryKey)) return outcome.response;
    const delivery = await this.mailOutbox.waitForRegistrationDecisionDelivery(
      this.prisma,
      outcome.mailIdempotencyKey,
      { timeoutMs: REGISTRATION_DECISION_DELIVERY_TIMEOUT_MS, pollMs: 250 },
    );
    if (delivery.status !== 'SENT') {
      throw new ServiceUnavailableException({
        code: delivery.status === 'DEAD_LETTER'
          ? 'REGISTRATION_DECISION_NOTIFICATION_FAILED'
          : 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
        applicationId: outcome.response.applicationId,
        status: outcome.response.status,
        nextAction: outcome.response.nextAction,
        replayed: outcome.response.replayed,
        correlationId: outcome.response.correlationId,
        retryAfterSeconds: 2,
      });
    }
    return outcome.response.replayed
      ? outcome.response
      : { ...outcome.response, notificationDelivery: { status: 'SENT' } };
  }

  private async readResult(
    client: AuthSqlClient,
    applicationId: string,
    replayed = false,
  ): Promise<RegistrationDecisionResponse> {
    const rows = await client.$queryRaw<Array<{
      id: string;
      status: string;
      version: bigint;
      correlation_id: string;
    }>>(Prisma.sql`
      SELECT id, status, version, correlation_id
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    const application = rows[0];
    if (!application) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    return {
      applicationId: application.id,
      status: application.status,
      nextAction: application.status === 'ACTIVATED' ? 'LOGIN' : 'WAIT',
      version: application.version.toString(),
      correlationId: application.correlation_id,
      replayed,
    };
  }

"""
    ws.replace_span(path, "  private async readResult(\n", "  private async insertEvent(\n", result_methods, "durable delivery result methods")


def patch_staff_bff(ws: Workspace) -> None:
    path = "apps/web/app/api/staff/[...path]/route.ts"
    ws.replace_once(path, "import { sendTransactionalMail } from '@/lib/server/transactional-mail';\n", "", "remove direct mail import")
    ws.replace_once(path, "export const maxDuration = 12;", "export const maxDuration = 75;", "registration delivery duration")
    ws.replace_span(path, "const registrationDecisionMailCopy = {\n", "const READ_PATHS = [\n", "const READ_PATHS = [\n", "remove BFF mail templates")
    ws.replace_once(
        path,
        "      signal: AbortSignal.timeout(8_000),",
        "      signal: AbortSignal.timeout(registrationDecision ? 65_000 : 8_000),",
        "bounded registration upstream timeout",
    )
    replacement = """    const notification = safePayload.notificationDelivery && typeof safePayload.notificationDelivery === 'object'
      ? safePayload.notificationDelivery as { status?: unknown }
      : null;
    delete safePayload.notificationDelivery;
    if (upstream.ok && registrationDecision && payloadObject.replayed !== true) {
      const notificationDelivered = notification?.status === 'SENT';
      safePayload.notificationDelivered = notificationDelivered;
      console.info('registration_decision_notification_result', JSON.stringify({
        correlationId,
        delivered: notificationDelivered,
        provider: 'auth-mail-outbox',
        reason: String(notification?.status || 'MISSING'),
      }));
    }
"""
    ws.replace_span(
        path,
        "    const notification = safePayload.notificationDelivery",
        "    if (upstream.ok && registrationDecision && correlationId.startsWith('p0-human-')) {",
        replacement,
        "replace synchronous staff notification",
    )


def patch_join_bff(ws: Workspace) -> None:
    path = "apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts"
    ws.replace_once(path, "import { sendTransactionalMail } from '@/lib/server/transactional-mail';\n", "", "remove direct mail import")
    ws.replace_span(path, "const mailCopy = {\n", "function json(body: Record<string, unknown>, status: number) {\n", "function json(body: Record<string, unknown>, status: number) {\n", "remove BFF mail templates")
    replacement = """  const notification = payload.notificationDelivery && typeof payload.notificationDelivery === 'object'
    ? payload.notificationDelivery as { status?: unknown }
    : null;
  delete payload.notificationDelivery;

  if (!upstreamResponse.ok) return json({ ...payload, correlationId }, upstreamResponse.status);
  if (payload.replayed === true) return json({ ...payload, correlationId }, 200);

  let notificationDelivered = false;
  notificationDelivered = notification?.status === 'SENT';
  console.info('organization_join_decision_notification_result', JSON.stringify({
    correlationId,
    delivered: notificationDelivered,
    provider: 'auth-mail-outbox',
    reason: String(notification?.status || 'MISSING'),
  }));
  if (!notificationDelivered) {
    return json({
      ...payload,
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      correlationId,
    }, 503);
  }
  return json({ ...payload, notificationDelivered, correlationId }, 200);
}"""
    ws.replace_span_including(
        path,
        "  const notification = payload.notificationDelivery",
        "  return json({ ...payload, notificationDelivered, correlationId }, 200);\n}",
        replacement,
        "replace synchronous join notification",
    )


def patch_idempotency_clients(ws: Workspace) -> None:
    path = "apps/web/components/platform-v7/staff/RegistrationReviewQueue.tsx"
    helpers = """async function decisionMarker(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function p0CeremonyHeaders(applicationId: string, phase: 'approve' | 'replay') {
  const marker = await decisionMarker(applicationId);
  return {
    idempotencyKey: `p0-human-review:${marker}`,
    correlationId: `p0-human-${phase}:${marker}`,
  };
}

async function ordinaryDecisionHeaders(
  applicationId: string,
  version: string,
  decision: ReviewDecision,
) {
  const marker = await decisionMarker(`${applicationId}\u001f${version}\u001f${decision}`);
  return {
    idempotencyKey: `registration-review:${marker}:${decision.toLowerCase()}`,
    correlationId: `registration-review:${marker}:${crypto.randomUUID()}`,
  };
}

"""
    ws.replace_span(
        path,
        "function newIdempotencyKey(applicationId: string) {\n",
        "export function RegistrationReviewQueue",
        helpers,
        "stable registration decision idempotency helpers",
    )
    ws.replace_once(
        path,
        "      const ordinaryKey = newIdempotencyKey(application.applicationId);\n      const firstHeaders = p0Ceremony\n        ? await p0CeremonyHeaders(application.applicationId, 'approve')\n        : { idempotencyKey: ordinaryKey, correlationId: '' };",
        """      const firstHeaders = p0Ceremony
        ? await p0CeremonyHeaders(application.applicationId, 'approve')
        : await ordinaryDecisionHeaders(application.applicationId, application.version, decision);""",
        "stable ordinary reviewer decision key",
    )

    path = "apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx"
    helper_anchor = "export function OrganizationTeamAdminClient({\n"
    helper = """async function stableJoinDecisionKey(
  applicationId: string,
  version: string,
  decision: 'APPROVE' | 'REJECT',
) {
  const bytes = new TextEncoder().encode(`${applicationId}\u001f${version}\u001f${decision}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const marker = Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `organization-join:${marker}:${decision.toLowerCase()}`;
}

"""
    ws.replace_once(path, helper_anchor, helper + helper_anchor, "join decision key helper")
    ws.replace_once(
        path,
        "    try {\n      const response = await fetch(`/api/auth/organization-join-requests/${encodeURIComponent(applicationId)}/decision`, {\n        method: 'POST',\n        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': globalThis.crypto.randomUUID() }),",
        """    try {
      const application = joins.find((item) => item.applicationId === applicationId);
      if (!application) throw new Error('join_request_not_found');
      const idempotencyKey = await stableJoinDecisionKey(applicationId, application.version, decision);
      const response = await fetch(`/api/auth/organization-join-requests/${encodeURIComponent(applicationId)}/decision`, {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': idempotencyKey }),""",
        "stable organization join decision key",
    )


def patch_api_tests(ws: Workspace) -> None:
    path = "apps/api/src/modules/auth/registration-decision.service.spec.ts"
    ws.replace_once(
        path,
        "function createService() {\n  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };\n  const repository = {};\n  return {\n    service: new RegistrationDecisionService(prisma as never, repository as never),\n    prisma,\n  };\n}\n",
        """function createMailOutboxMock() {
  return {
    enqueue: jest.fn().mockResolvedValue({ queued: true, replayed: false, envelopeDigest: 'digest' }),
    registrationDecisionStatus: jest.fn().mockResolvedValue({
      status: 'MISSING', attemptCount: 0, maxAttempts: 0, lastErrorCode: null, sentAt: null,
    }),
    waitForRegistrationDecisionDelivery: jest.fn().mockResolvedValue({
      status: 'SENT', attemptCount: 0, maxAttempts: 12, lastErrorCode: null, sentAt: new Date(),
    }),
  };
}

function createService() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
  const repository = {};
  const mailOutbox = createMailOutboxMock();
  return {
    service: new RegistrationDecisionService(prisma as never, repository as never, mailOutbox as never),
    prisma,
    mailOutbox,
  };
}
""",
        "mail outbox test fixture",
    )
    ws.replace_all(
        path,
        "new RegistrationDecisionService(prisma as never, {} as never)",
        "new RegistrationDecisionService(prisma as never, {} as never, createMailOutboxMock() as never)",
        3,
        "service constructor test dependencies",
    )
    replay_test = """  it('recovers the durable notification on an exact platform decision replay', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ application_id: 'application-1' }]),
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new RegistrationDecisionService(
      prisma as never,
      {} as never,
      createMailOutboxMock() as never,
    );
    const replayResult = { applicationId: 'application-1', status: 'ACTIVATED', replayed: true };
    const readResult = jest.fn().mockResolvedValue(replayResult);
    const queueRegistrationDecisionNotification = jest.fn().mockResolvedValue(
      `auth-mail:registration-decision:${'a'.repeat(64)}`,
    );
    Object.assign(service as unknown as Record<string, unknown>, {
      requirePlatformDecisionAuthority: jest.fn().mockResolvedValue(undefined),
      readResult,
      queueRegistrationDecisionNotification,
    });

    await expect(service.decide(
      'application-1',
      'APPROVE',
      'Verified organization details',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] },
      'idempotency-decision-replay-0001',
      'correlation-replay-1',
    )).resolves.toEqual(replayResult);

    expect(queueRegistrationDecisionNotification).toHaveBeenCalledWith(
      tx,
      'application-1',
      'decision:idempotency-decision-replay-0001',
      'correlation-replay-1',
    );
    expect(readResult).toHaveBeenCalledWith(tx, 'application-1', true);
  });

"""
    ws.replace_span(
        path,
        "  it('marks an exact platform decision retry as replayed before reading delivery metadata', async () => {\n",
        "  it('omits notification delivery metadata when readResult is replayed', async () => {\n",
        replay_test,
        "replay recovery test",
    )
    no_recipient_test = """  it('never returns recipient metadata from the registration decision result', async () => {
    const { service } = createService();
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 'application-1',
        status: 'ACTIVATED',
        version: 2n,
        correlation_id: 'correlation-1',
      }]),
    };
    const readResult = (service as unknown as {
      readResult: (
        tx: typeof client,
        applicationId: string,
        replayed?: boolean,
      ) => Promise<Record<string, unknown>>;
    }).readResult.bind(service);

    const initial = await readResult(client, 'application-1');
    expect(initial).toMatchObject({ replayed: false, status: 'ACTIVATED' });
    expect(initial).not.toHaveProperty('notificationDelivery');
    expect(JSON.stringify(initial)).not.toContain('@');

    const replay = await readResult(client, 'application-1', true);
    expect(replay).toMatchObject({ replayed: true });
    expect(replay).not.toHaveProperty('notificationDelivery');
  });

  it('waits for durable SENT evidence before exposing a bounded delivery acknowledgement', async () => {
    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    const deliveryKey = 'registration-delivery-key-for-durable-status';
    process.env.REGISTRATION_DELIVERY_KEY = deliveryKey;
    const { service, mailOutbox } = createService();
    const complete = (service as unknown as {
      completeDecisionResponse: (
        outcome: Record<string, unknown>,
        providedDeliveryKey?: string,
      ) => Promise<Record<string, unknown>>;
    }).completeDecisionResponse.bind(service);
    try {
      const result = await complete({
        response: {
          applicationId: 'application-1', status: 'ACTIVATED', nextAction: 'LOGIN',
          version: '2', correlationId: 'correlation-1', replayed: false,
        },
        mailIdempotencyKey: `auth-mail:registration-decision:${'a'.repeat(64)}`,
      }, deliveryKey);
      expect(mailOutbox.waitForRegistrationDecisionDelivery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ notificationDelivery: { status: 'SENT' } });
      expect(JSON.stringify(result)).not.toContain('@');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

"""
    ws.replace_span(
        path,
        "  it('omits notification delivery metadata when readResult is replayed', async () => {\n",
        "  it('keeps the causal receipt inside a membership-free bounded PostgreSQL authority', () => {\n",
        no_recipient_test,
        "recipient metadata removal tests",
    )
    ws.replace_once(
        path,
        "      emitRegistrationLifecycleReceipt: jest.fn(async () => { order.push('receipt'); }),\n      readResult: jest.fn(async () => { order.push('read'); return { status: 'ACTIVATED' }; }),",
        """      emitRegistrationLifecycleReceipt: jest.fn(async () => { order.push('receipt'); }),
      queueRegistrationDecisionNotification: jest.fn(async () => {
        order.push('queue');
        return `auth-mail:registration-decision:${'a'.repeat(64)}`;
      }),
      readResult: jest.fn(async () => {
        order.push('read');
        return {
          applicationId: application.id, status: 'ACTIVATED', nextAction: 'LOGIN',
          version: '3', correlationId: 'correlation-1', replayed: false,
        };
      }),""",
        "transaction order mail queue",
    )
    ws.replace_once(
        path,
        "    expect(order).toEqual(['authority', 'approve', 'audit', 'receipt', 'read']);",
        "    expect(order).toEqual(['authority', 'approve', 'audit', 'receipt', 'queue', 'read']);",
        "transaction order expectation",
    )

    path = "apps/api/src/modules/auth-mail/auth-mail-outbox.service.spec.ts"
    addition_anchor = "});\n"
    source = ws.read(path)
    end_at = source.rfind(addition_anchor)
    if end_at < 0:
        raise PatchError(f"{path}: suite closing anchor missing")
    tests = """

  it('polls only the bounded registration-decision status authority', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{
      delivery_status: 'SENT',
      attempt_count: 1,
      max_attempts: 12,
      last_error_code: null,
      sent_at: new Date('2035-01-01T00:00:00.000Z'),
    }]);
    const client = { $queryRaw: queryRaw, $executeRaw: jest.fn() } as unknown as AuthSqlClient;
    const key = `auth-mail:registration-decision:${'a'.repeat(64)}`;
    const result = await new AuthMailOutboxService().waitForRegistrationDecisionDelivery(
      client,
      key,
      { timeoutMs: 1_000, pollMs: 100 },
    );
    expect(result.status).toBe('SENT');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as CapturedSql;
    expect(sql.strings.join('?')).toContain('auth.registration_decision_mail_delivery_status(?::text)');
    expect(sql.values).toEqual([key]);
  });
"""
    ws.set(path, source[:end_at] + tests + source[end_at:])


def patch_web_tests(ws: Workspace) -> None:
    path = "apps/web/tests/unit/p0HumanReviewerCeremony.test.ts"
    ws.replace_once(path, "import { sendTransactionalMail } from '@/lib/server/transactional-mail';\n", "", "remove direct mail test import")
    ws.replace_once(
        path,
        "\nvi.mock('@/lib/server/transactional-mail', () => ({\n  sendTransactionalMail: vi.fn(),\n}));\n",
        "",
        "remove direct mail test mock",
    )
    ws.replace_once(
        path,
        "    vi.mocked(sendTransactionalMail).mockResolvedValue({\n      delivered: true,\n      provider: 'smtp',\n      reason: 'sent',\n    });\n",
        "",
        "remove direct mail setup",
    )
    ws.replace_once(
        path,
        "      notificationDelivery: {\n        email: 'synthetic-review@example.test',\n        status: 'ACTIVATED',\n        reason: 'approved',\n      },",
        "      notificationDelivery: { status: 'SENT' },",
        "durable staff delivery fixture",
    )
    ws.replace_once(
        path,
        "    expect(sendTransactionalMail).toHaveBeenCalledWith(expect.objectContaining({\n      to: 'synthetic-review@example.test',\n    }));\n",
        "    expect(fetchMock).toHaveBeenCalledTimes(1);\n",
        "no direct staff mail assertion",
    )
    ws.replace_once(path, "    expect(sendTransactionalMail).not.toHaveBeenCalled();\n", "", "remove replay direct mail assertion")

    path = "apps/web/tests/unit/p0FirstCustomerCompletion.test.ts"
    ws.replace_once(path, "import { sendTransactionalMail } from '@/lib/server/transactional-mail';\n", "", "remove join direct mail test import")
    ws.replace_once(
        path,
        "\nvi.mock('@/lib/server/transactional-mail', () => ({\n  sendTransactionalMail: vi.fn(),\n}));\n",
        "",
        "remove join direct mail test mock",
    )
    old_static = """    const mail = read('apps/web/lib/server/transactional-mail.ts');
    const acceptance = read('scripts/production-p0-all-role-registration.sh');
"""
    ws.replace_once(path, old_static, "    const acceptance = read('scripts/production-p0-all-role-registration.sh');\n", "remove legacy mail timeout fixture")
    ws.replace_once(
        path,
        """    expect(bff).toContain('await sendTransactionalMail({');
    expect(bff).toContain('organization_join_decision_notification_failure');
    expect(bff).toContain("failureClass: 'NOTIFICATION_TRANSPORT'");
    expect(mail).toContain('const MAIL_TIMEOUT_MS = 5_000;');
    expect(mail).toContain('}, MAIL_TIMEOUT_MS + 2_500);');
""",
        """    expect(api).toContain('queueRegistrationDecisionNotification');
    expect(api).toContain("kind: 'REGISTRATION_DECISION'");
    expect(api).toContain('waitForRegistrationDecisionDelivery');
    expect(bff).toContain("notification?.status === 'SENT'");
    expect(bff).toContain("provider: 'auth-mail-outbox'");
    expect(bff).not.toContain('sendTransactionalMail');
""",
        "durable join delivery static contract",
    )
    ws.replace_once(
        path,
        """    expect(bff).toContain('organization_join_decision_notification_failure');
    expect(bff).toContain("failureClass: 'NOTIFICATION_TRANSPORT'");
""",
        "",
        "remove duplicate legacy notification failure assertions",
    ) if ws.read(path).count("    expect(bff).toContain('organization_join_decision_notification_failure');\n    expect(bff).toContain(\"failureClass: 'NOTIFICATION_TRANSPORT'\");\n") == 1 else None
    ws.replace_once(
        path,
        """    vi.mocked(sendTransactionalMail).mockResolvedValue({
      delivered: true,
      provider: 'smtp',
      reason: 'sent',
    });
""",
        "",
        "remove successful direct mail mock",
    )
    ws.replace_once(
        path,
        """      notificationDelivery: {
        email: 'synthetic-employee@example.test',
        status: 'ACTIVATED',
        reason: 'approved',
      },
""",
        "      notificationDelivery: { status: 'SENT' },\n",
        "durable join delivery fixture",
    )
    ws.replace_once(path, "    expect(sendTransactionalMail).toHaveBeenCalledTimes(1);\n", "", "remove successful direct mail assertion")
    ws.replace_once(path, "    expect(sendTransactionalMail).not.toHaveBeenCalled();\n", "", "remove unsuccessful direct mail assertion")
    pending_test = """  it('preserves the API fail-closed durable notification status after a committed decision', async () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('REGISTRATION_DELIVERY_KEY', 'r'.repeat(32));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      status: 'ACTIVATED',
      nextAction: 'LOGIN',
      replayed: false,
      correlationId: 'p0-employee-join-durable-pending',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { POST } = await import('@/app/api/auth/organization-join-requests/[applicationId]/decision/route');
    const response = await POST(employeeJoinDecisionRequest(), {
      params: Promise.resolve({ applicationId: 'reg_employee' }),
    });
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      status: 'ACTIVATED',
    });
    expect(payload).not.toHaveProperty('notificationDelivered');
  });

"""
    ws.replace_span(
        path,
        "  it('does not relabel a committed join decision as upstream 503 when notification code throws', async () => {\n",
        "  it('offers an authenticated one-time MFA step-up instead of requiring a new login', () => {\n",
        pending_test,
        "replace post-commit direct mail failure test",
    )
    if "sendTransactionalMail" in ws.read(path):
        raise PatchError(f"{path}: legacy synchronous notification assertions remain")


def patch_runbook(ws: Workspace) -> None:
    path = "docs/ops/production-p0-first-customer-acceptance.md"
    old = "The BFF accepts PASS only when the first response reports delivered notification and the replay reports `replayed=true` with no `notificationDelivered`; it emits only the bounded `P0_HUMAN_REVIEWER_CEREMONY` marker."
    new = "The API atomically records the decision and its encrypted `REGISTRATION_DECISION` mail intent in the same Serializable transaction. The auth-mail worker must reach durable `SENT`; only then may the BFF report delivered notification. The replay must report `replayed=true` with no `notificationDelivered`; the BFF emits only the bounded `P0_HUMAN_REVIEWER_CEREMONY` marker."
    ws.replace_once(path, old, new, "durable decision notification runbook")


def create_migration_and_scope(ws: Workspace) -> None:
    migration = """-- P0 registration decision notification status authority.
-- The registration state transition and encrypted mail intent are committed in one
-- transaction. API callers may observe only bounded delivery state, never payloads.

CREATE OR REPLACE FUNCTION auth.registration_decision_mail_delivery_status(
  p_idempotency_key text
)
RETURNS TABLE (
  delivery_status text,
  attempt_count integer,
  max_attempts integer,
  last_error_code text,
  sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^auth-mail:registration-decision:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Registration-decision mail idempotency key is invalid'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    candidate.status,
    candidate.attempt_count,
    candidate.max_attempts,
    candidate.last_error_code,
    candidate.sent_at
  FROM auth.mail_outbox candidate
  WHERE candidate.idempotency_key = p_idempotency_key
    AND candidate.message_kind = 'REGISTRATION_DECISION'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'MISSING'::text, 0::integer, 0::integer, NULL::text, NULL::timestamptz;
  END IF;
END
$function$;

ALTER FUNCTION auth.registration_decision_mail_delivery_status(text)
  OWNER TO pc_auth_mail_enqueue_authority;
REVOKE ALL ON FUNCTION auth.registration_decision_mail_delivery_status(text) FROM PUBLIC;

DO $registration_decision_status_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_decision_mail_delivery_status(text) TO %I',
      runtime_role
    );
  END LOOP;
END
$registration_decision_status_grants$;
"""
    ws.create(MIGRATION_PATH, migration)
    scope = {
        "schemaVersion": "platform-v7.concurrent-scope.v1",
        "branch": IMPLEMENTATION_BRANCH,
        "status": "active",
        "issue": 4858,
        "title": "Atomically enqueue registration decision mail and wait for durable SENT evidence",
        "allowedPaths": ALLOWED_PATHS,
        "boundaries": {
            "productionMutation": False,
            "directProductionSqlMutation": False,
            "identityBypass": False,
            "mfaWeakening": False,
            "rlsWeakening": False,
            "csrfWeakening": False,
            "secretOutput": False,
            "newRecurringCostRub": 0,
        },
        "productionHosting": "REG_RU_VPS_ONLY",
    }
    ws.create(SCOPE_PATH, json.dumps(scope, ensure_ascii=False, indent=2) + "\n")


def validate(ws: Workspace) -> None:
    required = {
        "apps/api/src/modules/auth/registration-decision.service.ts": [
            "kind: 'REGISTRATION_DECISION'",
            "queueRegistrationDecisionNotification",
            "waitForRegistrationDecisionDelivery",
            "notificationDelivery: { status: 'SENT' }",
            "ServiceUnavailableException",
        ],
        "apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts": [
            "registrationDecisionStatus",
            "auth.registration_decision_mail_delivery_status",
            "waitForRegistrationDecisionDelivery",
        ],
        "apps/web/app/api/staff/[...path]/route.ts": [
            "provider: 'auth-mail-outbox'",
            "payloadObject.replayed !== true",
            "registrationDecision ? 65_000 : 8_000",
        ],
        "apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts": [
            "provider: 'auth-mail-outbox'",
            "notification?.status === 'SENT'",
            "REGISTRATION_DECISION_NOTIFICATION_PENDING",
        ],
        MIGRATION_PATH: [
            "SECURITY DEFINER",
            "SET row_security = on",
            "pc_auth_mail_enqueue_authority",
            "REVOKE ALL",
        ],
    }
    for path, needles in required.items():
        source = ws.contents.get(path) if path in ws.contents else ws.read(path)
        for needle in needles:
            if needle not in source:
                raise PatchError(f"{path}: required invariant missing: {needle}")

    forbidden = {
        "apps/web/app/api/staff/[...path]/route.ts": ["sendTransactionalMail", "registrationDecisionMailCopy"],
        "apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts": ["sendTransactionalMail", "const mailCopy"],
        "apps/api/src/modules/auth/registration-decision.service.ts": ["notificationDelivery: {\n              email:"],
    }
    for path, needles in forbidden.items():
        source = ws.read(path)
        for needle in needles:
            if needle in source:
                raise PatchError(f"{path}: forbidden legacy behavior remains: {needle}")

    if sorted(ALLOWED_PATHS) != sorted(ws.contents):
        missing = sorted(set(ALLOWED_PATHS) - set(ws.contents))
        extra = sorted(set(ws.contents) - set(ALLOWED_PATHS))
        raise PatchError(f"patched path mismatch; missing={missing}; extra={extra}")


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode not in {"check", "apply", "check-applied"}:
        raise PatchError("usage: patch.py [check|apply|check-applied]")
    if mode == "check-applied":
        for path in ALLOWED_PATHS:
            if not (ROOT / path).is_file():
                raise PatchError(f"applied path missing: {path}")
        service = (ROOT / "apps/api/src/modules/auth/registration-decision.service.ts").read_text(encoding="utf-8")
        staff = (ROOT / "apps/web/app/api/staff/[...path]/route.ts").read_text(encoding="utf-8")
        migration = (ROOT / MIGRATION_PATH).read_text(encoding="utf-8")
        for needle in ["queueRegistrationDecisionNotification", "waitForRegistrationDecisionDelivery"]:
            if needle not in service:
                raise PatchError(f"applied service missing {needle}")
        if "sendTransactionalMail" in staff:
            raise PatchError("applied staff BFF still sends decision mail synchronously")
        if "SECURITY DEFINER" not in migration or "SET row_security = on" not in migration:
            raise PatchError("applied status migration is not fail-closed")
        print("PASS: durable registration-decision outbox implementation is present")
        return 0

    ws = Workspace(write=mode == "apply")
    patch_templates(ws)
    patch_outbox_service(ws)
    patch_registration_service(ws)
    patch_staff_bff(ws)
    patch_join_bff(ws)
    patch_idempotency_clients(ws)
    patch_api_tests(ws)
    patch_web_tests(ws)
    patch_runbook(ws)
    create_migration_and_scope(ws)
    validate(ws)
    ws.flush()

    if mode == "apply":
        result = subprocess.run(["git", "diff", "--check"], cwd=ROOT, text=True, capture_output=True)
        if result.returncode != 0:
            raise PatchError(result.stdout + result.stderr)
    print(f"PASS: {mode} validated {len(ALLOWED_PATHS)} bounded implementation paths")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PatchError as error:
        print(f"P0_REGISTRATION_DECISION_DURABLE_OUTBOX_PATCH_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
