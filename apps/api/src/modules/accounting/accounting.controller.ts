import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';
import { AdvanceRepository } from './advance.repository';
import { ServiceStatus } from './deal-service.policy';
import { DealServiceRepository } from './deal-service.repository';
import { PaymentRepository } from './payment.repository';
import { ConnectionAttestationRepository } from './connection-attestation.repository';
import { isDecision, isGate } from './connection-attestation.policy';
import { ConnectionCenterRepository } from './connection-center.repository';
import { ConnectionKind } from './connection-center.policy';
import { ReconciliationRepository } from './reconciliation.repository';
import { WorkTaskDeriver } from './work-task.deriver';
import { AudienceView, projectFor } from './work-task-projection.policy';
import { PeriodStatus } from './accounting-period.policy';
import { AccountingPeriodRepository } from './accounting-period.repository';
import { AdapterMaturity } from './document-transmission.policy';
import {
  DocumentTransmissionRepository,
  currentFreshness,
} from './document-transmission.repository';
import { WorkTaskStatus } from './work-task.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * The minimum surface the accounting contour needs to be reachable.
 *
 * Two routes, both taking the actor from the request rather than the body.
 * Nothing here re-checks tenancy or membership: the repositories run inside
 * `withTrustedContext`, and the row policies already refuse what this actor
 * must not see. A second check in the controller would be the weaker copy that
 * drifts — the mistake the whole contour was built to avoid.
 *
 * `documentDate` is not accepted from the caller. A date chosen by the client
 * selects which tax profile, contract version and regulatory rule govern the
 * document, which would let somebody pick the rules their document is judged
 * by. The server uses its own clock.
 */
@UseGuards(RolesGuard)
@Roles('ADMIN', 'FARMER', 'BUYER', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER')
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly snapshots: AccountingSourceSnapshotRepository,
    private readonly versions: AccountingDocumentVersionRepository,
    private readonly tasks: WorkTaskRepository,
    private readonly deriver: WorkTaskDeriver,
    private readonly periods: AccountingPeriodRepository,
    private readonly transmission: DocumentTransmissionRepository,
    private readonly advances: AdvanceRepository,
    private readonly services: DealServiceRepository,
    private readonly payments: PaymentRepository,
    private readonly reconciliations: ReconciliationRepository,
    private readonly connections: ConnectionCenterRepository,
    private readonly attestations: ConnectionAttestationRepository,
  ) {}

  /**
   * What the platform would put in a document for this deal right now, and
   * which sources are missing if it cannot.
   *
   * A read, so it answers with the gaps rather than an error: knowing that the
   * quality passport is the one thing outstanding is what lets somebody act.
   */
  @Get('deals/:dealId/source-snapshot')
  snapshot(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.snapshots.assemble(user, { dealId, at: new Date() });
  }

  /**
   * Render a new immutable version of a draft document.
   *
   * The outcome is returned rather than thrown, including the refusals, so the
   * caller sees every reason at once instead of one per attempt.
   */
  @Post('documents/:documentId/versions')
  createVersion(
    @Param('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.versions.create(user, { documentId, at: new Date() });
  }

  /**
   * What is outstanding for this organization, most urgent first.
   *
   * Serialised by hand because a task carries a bigint version and JSON has no
   * bigint. Letting the default serialiser reach it would throw at runtime on
   * the first task ever listed.
   */
  @Get('tasks')
  async listTasks(@CurrentUser() user: RequestUser) {
    const tasks = await this.tasks.listOpen(user);
    return tasks.map((task) => ({ ...task, version: task.version.toString() }));
  }

  /**
   * Move a task, carrying the version the caller read.
   *
   * The version is required. Two people working one task from two screens is
   * ordinary in an accounting department, and without it the later write
   * silently discards the earlier decision.
   */
  @Post('tasks/:taskId/transition')
  transition(
    @Param('taskId') taskId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      to: WorkTaskStatus;
      expectedVersion: string;
      resolutionEventId?: string | null;
      assignedMembershipId?: string | null;
    },
  ) {
    return this.tasks.transition(user, {
      taskId,
      to: body.to,
      expectedVersion: integer(body.expectedVersion, 'expectedVersion'),
      resolutionEventId: body.resolutionEventId ?? null,
      assignedMembershipId: body.assignedMembershipId ?? null,
      // Neither the capabilities nor whether the condition still holds are
      // taken from the body. Both are facts the server can read, and a caller
      // who could state either would be deciding the question being asked of
      // them.
    });
  }

  /**
   * A note somebody writes for themselves.
   *
   * Manual by construction: the row policy admits nothing else from this
   * principal, so a claim about the world cannot be dressed up as a personal
   * note. Who wrote it is resolved by the database, not named in the call.
   */
  @Post('tasks')
  createTask(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      title: string;
      humanDescription: string;
      dealId?: string | null;
      documentId?: string | null;
      deadlineAt?: string | null;
    },
  ) {
    return this.tasks.raiseManual(user, {
      title: body.title ?? '',
      humanDescription: body.humanDescription ?? '',
      dealId: body.dealId ?? null,
      documentId: body.documentId ?? null,
      deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
    });
  }

  /**
   * Raise tasks for whatever is outstanding right now.
   *
   * Idempotent: a condition already raised stays one task.
   */
  @Post('tasks/derive')
  derive(@CurrentUser() user: RequestUser) {
    return this.deriver.deriveUnsignedDocuments(user);
  }

  /**
   * The same tasks, shaped for who is reading them.
   *
   * A farmer gets one sentence, a director gets the decisions with the
   * counterparty and the amount, a bookkeeper gets the queue. Not three
   * filters over one table: three different questions.
   */
  @Get('tasks/projection')
  async projection(
    @CurrentUser() user: RequestUser,
    @Query('view') view?: string,
  ) {
    const requested =
      view === AudienceView.DECISION_QUEUE || view === AudienceView.WORK_QUEUE
        ? view
        : AudienceView.PRINCIPAL_SUMMARY;

    const tasks = await this.tasks.listOpen(user);
    const viewer = await this.tasks.describeViewer(user);
    const projected = projectFor(tasks, viewer, requested);

    // bigint again: the amounts have to cross JSON, and they are kopecks.
    return JSON.parse(
      JSON.stringify(projected, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  /**
   * Every period with what is standing in the way of closing it.
   *
   * Readiness is reported alongside the counts that produced it, so a screen
   * can say why rather than only that.
   */
  @Get('periods')
  async listPeriods(@CurrentUser() user: RequestUser) {
    const periods = await this.periods.list(user);
    return periods.map((period) => ({
      ...period,
      version: period.version.toString(),
    }));
  }

  @Post('periods')
  openPeriod(
    @CurrentUser() user: RequestUser,
    @Body() body: { periodStart: string; periodEnd: string },
  ) {
    return this.periods.open(user, {
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  /**
   * Move a period one step towards closed.
   *
   * The counts a close depends on are not in the body. A close is exactly the
   * moment somebody would like those numbers to be zero, so the server reads
   * them itself.
   */
  @Post('periods/:periodId/advance')
  advancePeriod(
    @Param('periodId') periodId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { to: PeriodStatus; expectedVersion: string },
  ) {
    return this.periods.advance(user, {
      periodId,
      to: body.to,
      expectedVersion: integer(body.expectedVersion, 'expectedVersion'),
    });
  }

  /** Raise tasks for months that are ready to be closed. */
  @Post('periods/derive')
  derivePeriods(@CurrentUser() user: RequestUser) {
    return this.deriver.derivePeriodsReadyToClose(user);
  }

  /**
   * Whether this version could be handed to a counterparty, and what is in the
   * way if not.
   *
   * There is deliberately no send route. Sending needs an attested adapter and
   * none exists yet; a route wired to the fake, or one that always refuses,
   * would be the fictitious «Подключено» the contract forbids. The adapter
   * maturity is therefore NOT_ATTESTED here, which is the truth, and the answer
   * says so among its reasons.
   */
  @Get('documents/versions/:versionId/transmission-readiness')
  transmissionReadiness(
    @Param('versionId') versionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.transmission.describeReadiness(user, {
      versionId,
      freshness: currentFreshness(),
      formatAllowed: true,
      formatReasons: [],
      adapterMaturity: AdapterMaturity.NOT_ATTESTED,
    });
  }

  /**
   * The advances on a deal, each with what is left of it.
   *
   * `remaining` is derived from the offsets on every read rather than stored.
   * A cached balance is a second source of truth for the same number, and the
   * two only have to disagree once for somebody to be told an advance has money
   * in it that it does not.
   */
  @Get('deals/:dealId/advances')
  async listAdvances(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const advances = await this.advances.listForDeal(user, dealId);
    return advances.map((advance) => ({
      ...advance,
      amountKopecks: advance.amountKopecks.toString(),
      appliedKopecks: advance.appliedKopecks.toString(),
      remainingKopecks: advance.remainingKopecks.toString(),
      version: advance.version.toString(),
    }));
  }

  /**
   * Record money that arrived before the thing it pays for.
   *
   * The amount is not taken on trust: the server reads the cited bank operation
   * and refuses an advance that does not match the transfer it claims. An
   * advance recorded without that check is a number two parties would compare
   * against a bank statement and find missing.
   */
  @Post('advances')
  recordAdvance(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      dealId: string;
      counterpartyOrgId: string;
      amountKopecks: string;
      currency?: string;
      bankOperationId: string;
      receivedAt: string;
    },
  ) {
    return this.advances.record(user, {
      dealId: body.dealId,
      counterpartyOrgId: body.counterpartyOrgId,
      amountKopecks: integer(body.amountKopecks, 'amountKopecks'),
      currency: body.currency ?? 'RUB',
      bankOperationId: body.bankOperationId,
      receivedAt: new Date(body.receivedAt),
    });
  }

  /**
   * Apply part or all of an advance.
   *
   * The remaining balance is not in the body. This is exactly the moment
   * somebody would like it to be larger than it is, so the server reads it
   * under the same lock the database guard takes.
   */
  @Post('advances/:advanceId/offsets')
  applyAdvanceOffset(
    @Param('advanceId') advanceId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      amountKopecks: string;
      appliedAt: string;
      reason: string;
      idempotencyKey: string;
      documentVersionId?: string | null;
    },
  ) {
    return this.advances.applyOffset(user, {
      advanceId,
      amountKopecks: integer(body.amountKopecks, 'amountKopecks'),
      appliedAt: new Date(body.appliedAt),
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      documentVersionId: body.documentVersionId ?? null,
    });
  }

  /**
   * The services rendered on a deal, and what they come to.
   *
   * The net is computed by the server from the approved lines and the approved
   * reversals. A client that added the lines up itself would have to know which
   * of them were reversed, and one that got it wrong would show a charge as owed
   * after it had been cancelled.
   */
  @Get('deals/:dealId/services')
  async listServices(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const services = await this.services.listForDeal(user, dealId);
    return {
      netKopecks: services.netKopecks.toString(),
      lines: services.lines.map((line) => ({
        ...line,
        quantityMilliUnits: line.quantityMilliUnits.toString(),
        tonnageMilliTons: line.tonnageMilliTons?.toString() ?? null,
        rateKopecks: line.rateKopecks.toString(),
        amountKopecks: line.amountKopecks.toString(),
        version: line.version.toString(),
      })),
    };
  }

  /**
   * Record a service rendered on a deal.
   *
   * The total is not in the body. It is computed from the quantity and the rate,
   * and for storage the quantity itself has to follow from the tonnage and the
   * days of the window — which is the arithmetic a storage charge is usually
   * inflated through. The unit is not in the body either: it follows from the
   * kind.
   */
  @Post('services')
  recordService(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      dealId: string;
      counterpartyOrgId: string;
      kind: string;
      quantityMilliUnits: string;
      tonnageMilliTons?: string | null;
      periodFrom?: string | null;
      periodTo?: string | null;
      rateKopecks: string;
      currency?: string;
      renderedAt: string;
      idempotencyKey: string;
    },
  ) {
    return this.services.record(user, {
      dealId: body.dealId,
      counterpartyOrgId: body.counterpartyOrgId,
      kind: body.kind,
      quantityMilliUnits: integer(body.quantityMilliUnits, 'quantityMilliUnits'),
      tonnageMilliTons:
        body.tonnageMilliTons === undefined || body.tonnageMilliTons === null
          ? null
          : integer(body.tonnageMilliTons, 'tonnageMilliTons'),
      periodFrom: instant(body.periodFrom, 'periodFrom'),
      periodTo: instant(body.periodTo, 'periodTo'),
      rateKopecks: integer(body.rateKopecks, 'rateKopecks'),
      currency: body.currency ?? 'RUB',
      renderedAt: new Date(body.renderedAt),
      idempotencyKey: body.idempotencyKey,
    });
  }

  /**
   * Approve or reject a rendered line.
   *
   * The approving membership is not in the body: it is the session's own, and
   * the database refuses an approval by the membership that recorded the line.
   */
  @Post('services/:serviceId/decision')
  decideService(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { intended: string },
  ) {
    if (
      body.intended !== ServiceStatus.APPROVED
      && body.intended !== ServiceStatus.REJECTED
    ) {
      throw new BadRequestException(
        `intended is ${ServiceStatus.APPROVED} or ${ServiceStatus.REJECTED}`,
      );
    }
    return this.services.decide(user, { serviceId, intended: body.intended });
  }

  /**
   * Reverse an approved line.
   *
   * Nothing about the amount is accepted here. The server copies the original's
   * terms from the row it reads under lock, so a reversal cannot cancel a large
   * charge with a small one.
   */
  @Post('services/:serviceId/reversal')
  reverseService(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { renderedAt: string; idempotencyKey: string },
  ) {
    return this.services.reverse(user, {
      serviceId,
      renderedAt: new Date(body.renderedAt),
      idempotencyKey: body.idempotencyKey,
    });
  }

  /**
   * The payments on a deal, each with what is left to allocate.
   *
   * The unallocated remainder is computed by the server from the allocations.
   * A client that subtracted them itself would be a second place the same
   * number is worked out, and the two only have to disagree once for a debt to
   * be settled from money already spent elsewhere.
   */
  @Get('deals/:dealId/payments')
  async listPayments(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const payments = await this.payments.listForDeal(user, dealId);
    return payments.map((payment) => ({
      ...payment,
      amountKopecks: payment.amountKopecks.toString(),
      allocatedKopecks: payment.allocatedKopecks.toString(),
      unallocatedKopecks: payment.unallocatedKopecks.toString(),
      version: payment.version.toString(),
    }));
  }

  /**
   * Record money that moved against a deal.
   *
   * The amount is not taken on trust: the server reads the cited bank operation
   * and refuses a payment that does not match the transfer it claims, or one
   * citing a transfer already recorded as an advance. Counted twice, the same
   * money would settle the same debt twice on paper.
   */
  @Post('payments')
  recordPayment(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      dealId: string;
      counterpartyOrgId: string;
      direction: string;
      amountKopecks: string;
      currency?: string;
      bankOperationId: string;
      paidAt: string;
      idempotencyKey: string;
    },
  ) {
    return this.payments.record(user, {
      dealId: body.dealId,
      counterpartyOrgId: body.counterpartyOrgId,
      direction: body.direction,
      amountKopecks: integer(body.amountKopecks, 'amountKopecks'),
      currency: body.currency ?? 'RUB',
      bankOperationId: body.bankOperationId,
      paidAt: new Date(body.paidAt),
      idempotencyKey: body.idempotencyKey,
    });
  }

  /**
   * Allocate part or all of a payment against one obligation.
   *
   * Neither ceiling is in the body. What is left of the payment and what is
   * left owed on the obligation are exactly the two numbers somebody would like
   * to be larger than they are, so the server reads both under the locks the
   * database guard takes.
   */
  @Post('payments/:paymentId/allocations')
  allocatePayment(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      amountKopecks: string;
      allocatedAt: string;
      reason: string;
      idempotencyKey: string;
      documentVersionId?: string | null;
      dealServiceId?: string | null;
    },
  ) {
    return this.payments.allocate(user, {
      paymentId,
      amountKopecks: integer(body.amountKopecks, 'amountKopecks'),
      allocatedAt: new Date(body.allocatedAt),
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      documentVersionId: body.documentVersionId ?? null,
      dealServiceId: body.dealServiceId ?? null,
    });
  }

  /**
   * The statements of mutual settlements prepared on a deal.
   */
  @Get('deals/:dealId/reconciliations')
  async listReconciliations(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const statements = await this.reconciliations.listForDeal(user, dealId);
    return statements.map((statement) => ({
      ...statement,
      openingBalanceKopecks: statement.openingBalanceKopecks.toString(),
      chargedKopecks: statement.chargedKopecks.toString(),
      reversedKopecks: statement.reversedKopecks.toString(),
      paidKopecks: statement.paidKopecks.toString(),
      advanceAppliedKopecks: statement.advanceAppliedKopecks.toString(),
      closingBalanceKopecks: statement.closingBalanceKopecks.toString(),
      version: statement.version.toString(),
    }));
  }

  /**
   * What the books say for a counterparty over a window, without writing
   * anything.
   *
   * A read, so somebody can look at the figures before committing to them — and
   * so the statement they later prepare can be compared against this.
   */
  @Get('deals/:dealId/reconciliations/preview')
  async previewReconciliation(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
    @Query('counterpartyOrgId') counterpartyOrgId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const figures = await this.reconciliations.preview(user, {
      dealId,
      counterpartyOrgId,
      periodStart: required(instant(periodStart, 'periodStart'), 'periodStart'),
      periodEnd: required(instant(periodEnd, 'periodEnd'), 'periodEnd'),
    });
    return {
      openingBalanceKopecks: figures.openingBalanceKopecks.toString(),
      chargedKopecks: figures.chargedKopecks.toString(),
      reversedKopecks: figures.reversedKopecks.toString(),
      paidKopecks: figures.paidKopecks.toString(),
      advanceAppliedKopecks: figures.advanceAppliedKopecks.toString(),
      closingBalanceKopecks: figures.closingBalanceKopecks.toString(),
    };
  }

  /**
   * Prepare a statement.
   *
   * No figure is in the body. Every one of them is read from the rows, the
   * bottom line follows from them by an expression the database checks again,
   * and the statement is immutable once prepared — a reconciliation somebody can
   * edit after sending it is not a reconciliation.
   */
  @Post('reconciliations')
  async prepareReconciliation(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      dealId: string;
      counterpartyOrgId: string;
      periodStart: string;
      periodEnd: string;
      currency?: string;
    },
  ) {
    const outcome = await this.reconciliations.prepare(user, {
      dealId: body.dealId,
      counterpartyOrgId: body.counterpartyOrgId,
      periodStart: required(instant(body.periodStart, 'periodStart'), 'periodStart'),
      periodEnd: required(instant(body.periodEnd, 'periodEnd'), 'periodEnd'),
      currency: body.currency ?? 'RUB',
    });
    return {
      ...outcome,
      closingBalanceKopecks: outcome.closingBalanceKopecks?.toString() ?? null,
      figures:
        outcome.figures === null
          ? null
          : {
              openingBalanceKopecks: outcome.figures.openingBalanceKopecks.toString(),
              chargedKopecks: outcome.figures.chargedKopecks.toString(),
              reversedKopecks: outcome.figures.reversedKopecks.toString(),
              paidKopecks: outcome.figures.paidKopecks.toString(),
              advanceAppliedKopecks: outcome.figures.advanceAppliedKopecks.toString(),
            },
    };
  }

  /**
   * Agree with a statement, or dispute it.
   *
   * The answering membership is the session's own, and it may not be the one
   * that prepared the statement: agreeing with your own arithmetic is not
   * agreement.
   */
  @Post('reconciliations/:reconciliationId/answer')
  answerReconciliation(
    @Param('reconciliationId') reconciliationId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { intended: string; note?: string | null },
  ) {
    return this.reconciliations.answer(user, {
      reconciliationId,
      intended: body.intended,
      note: body.note ?? null,
    });
  }

  /**
   * Every external connection this organization has, and what each is waiting
   * for.
   *
   * A read with no counterpart that writes, deliberately. The levels are derived
   * from rows other contours wrote — a receipt carrying the far side's own
   * identifier, an attested contract — so nobody can set a green tick by asking
   * for one. A connection nobody has started is reported as NOT_ATTESTED with
   * its prerequisites named, which is the honest form of "not yet".
   */
  @Get('connections')
  listConnections(@CurrentUser() user: RequestUser) {
    return this.connections.describe(user);
  }

  /**
   * What this organization has put in front of the four gates, and how far each
   * has got.
   */
  @Get('connections/attestations')
  listConnectionAttestations(@CurrentUser() user: RequestUser) {
    return this.attestations.list(user);
  }

  /**
   * Register what is to be attested: a connection kind, a provider, and the
   * environment. Provider-neutral — no vendor is named in the schema, and the
   * code is normalized so one operator cannot become two approval histories.
   */
  @Post('connections/attestations/subjects')
  registerConnectionSubject(
    @CurrentUser() user: RequestUser,
    @Body() body: { connectionKind: string; providerCode: string; environment: string },
  ) {
    return this.attestations.register(user, {
      connectionKind: connectionKind(body.connectionKind),
      providerCode: text(body.providerCode, 'providerCode'),
      environment: environment(body.environment),
    });
  }

  /**
   * Answer one gate.
   *
   * The actor is not taken from the body: the database function reads it from
   * the session, so nobody records somebody else's approval. Whether one person
   * has already answered a different gate for this version is the database's
   * decision too — that is the rule that makes four gates mean four people.
   */
  @Post('connections/attestations/:subjectId')
  attestConnection(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      gate: string;
      decision: string;
      justification: string;
      evidenceReference: string;
      validUntil: string;
      idempotencyKey: string;
      correlationId: string;
    },
  ) {
    if (isGate(body.gate) === false) {
      throw new BadRequestException(
        'gate must be OWNER, SECURITY, LEGAL or OPERATIONS',
      );
    }
    if (isDecision(body.decision) === false) {
      throw new BadRequestException('decision must be APPROVED or REJECTED');
    }
    return this.attestations.attest(user, {
      subjectId,
      gate: body.gate,
      decision: body.decision,
      justification: text(body.justification, 'justification'),
      evidenceReference: text(body.evidenceReference, 'evidenceReference'),
      validUntil: required(instant(body.validUntil, 'validUntil'), 'validUntil'),
      idempotencyKey: text(body.idempotencyKey, 'idempotencyKey'),
      correlationId: text(body.correlationId, 'correlationId'),
    });
  }
}

/** A connection kind the platform actually knows about. */
function connectionKind(value: string): ConnectionKind {
  if (
    value === ConnectionKind.EDO
    || value === ConnectionKind.ONE_C
    || value === ConnectionKind.BANK_STATEMENT
  ) {
    return value;
  }
  throw new BadRequestException(
    'connectionKind must be EDO, ONE_C or BANK_STATEMENT',
  );
}

/**
 * An attestation of a test environment is not an attestation of production, so
 * the two are named rather than assumed.
 */
function environment(value: string): string {
  if (value === 'PRE_PRODUCTION' || value === 'PRODUCTION') {
    return value;
  }
  throw new BadRequestException(
    'environment must be PRE_PRODUCTION or PRODUCTION',
  );
}

/** Text that has to say something. */
function text(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

/** An instant that has to be there. */
function required(value: Date | null, field: string): Date {
  if (value === null) {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

/**
 * A whole number of the minor unit, from the string a JSON body can carry.
 *
 * `BigInt('twelve')` throws a SyntaxError, and an uncaught one leaves the client
 * with a 500 for what is plainly a malformed request. Named in the message so
 * the caller knows which field to fix.
 */
function integer(value: string, field: string): bigint {
  if (typeof value !== 'string' || /^-?\d+$/.test(value) === false) {
    throw new BadRequestException(`${field} must be a whole number as a string`);
  }
  return BigInt(value);
}

/** An optional instant, refused rather than silently read as Invalid Date. */
function instant(value: string | null | undefined, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be an ISO-8601 instant`);
  }
  return parsed;
}
