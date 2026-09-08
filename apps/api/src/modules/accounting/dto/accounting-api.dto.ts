import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PeriodStatus } from '../accounting-period.policy';
import { ServiceKind, ServiceStatus } from '../deal-service.policy';
import { ReconciliationStatus } from '../reconciliation.policy';
import { WorkTaskStatus } from '../work-task.policy';

/**
 * The accounting contour's request bodies, as classes the global ValidationPipe
 * can actually see.
 *
 * Every endpoint here previously declared `@Body() body: { ... }` as an inline
 * TypeScript type. An inline type erases to Object at runtime and ValidationPipe
 * skips a parameter whose metatype it cannot transform, so the pipe - whitelist,
 * forbidNonWhitelisted and all - validated nothing on any of them. The controller
 * did its own checking with integer(), instant(), text() and required(), which is
 * why this is a narrowing rather than a rescue: most fields were already refused.
 * The ones that were not are the point.
 *
 * Nine call sites parsed a date as `new Date(body.field)` without instant(), and
 * an unparseable date is not an error there - it is `Invalid Date`, whose
 * getTime() is NaN. Every comparison against NaN is false, so a guard written as
 * a comparison does not refuse it; it simply never fires. evaluatePeriodOpen is
 * exactly that shape: `periodEnd.getTime() <= periodStart.getTime()` does not
 * raise WINDOW_IS_EMPTY for two Invalid Dates, and the overlap scan does not
 * raise WINDOW_OVERLAPS either, because both of its comparisons are against NaN
 * as well. An accounting period with no window passes every refusal the policy
 * has and goes to the write. NaN defeats range checks silently, so the door is
 * the only place it can be caught.
 *
 * The constraints below are read off what the code already requires, never
 * invented: the money pattern is integer()'s own /^-?\d+$/, the currency pattern
 * is the database's settlement_payment_currency_check, and every enumeration is
 * the policy constant rather than a copy of its values.
 */

/** A whole number of the minor unit, exactly as integer() will parse it. */
const MONEY = /^-?\d+$/u;

/** The shape the database itself enforces: settlement_payment_currency_check. */
const CURRENCY = /^[A-Z]{3}$/u;

const ID_LENGTH = 240;
const TEXT_LENGTH = 2000;

export class TransitionWorkTaskDto {
  @IsIn(Object.values(WorkTaskStatus)) to!: WorkTaskStatus;
  @IsString() @Matches(MONEY) @MaxLength(19) expectedVersion!: string;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) resolutionEventId?: string | null;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) assignedMembershipId?: string | null;
}

export class CreateWorkTaskDto {
  @IsString() @MaxLength(500) title!: string;
  @IsString() @MaxLength(TEXT_LENGTH) humanDescription!: string;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) dealId?: string | null;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) documentId?: string | null;
  @IsOptional() @IsISO8601() deadlineAt?: string | null;
}

export class OpenAccountingPeriodDto {
  @IsISO8601() periodStart!: string;
  @IsISO8601() periodEnd!: string;
}

export class AdvanceAccountingPeriodDto {
  @IsIn(Object.values(PeriodStatus)) to!: PeriodStatus;
  @IsString() @Matches(MONEY) @MaxLength(19) expectedVersion!: string;
}

export class RecordAdvanceDto {
  @IsString() @MaxLength(ID_LENGTH) dealId!: string;
  @IsString() @MaxLength(ID_LENGTH) counterpartyOrgId!: string;
  @IsString() @Matches(MONEY) @MaxLength(19) amountKopecks!: string;
  @IsOptional() @IsString() @Matches(CURRENCY) currency?: string;
  @IsString() @MaxLength(ID_LENGTH) bankOperationId!: string;
  @IsISO8601() receivedAt!: string;
}

export class ApplyAdvanceOffsetDto {
  @IsString() @Matches(MONEY) @MaxLength(19) amountKopecks!: string;
  @IsISO8601() appliedAt!: string;
  @IsString() @MaxLength(TEXT_LENGTH) reason!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) documentVersionId?: string | null;
}

export class RecordDealServiceDto {
  @IsString() @MaxLength(ID_LENGTH) dealId!: string;
  @IsString() @MaxLength(ID_LENGTH) counterpartyOrgId!: string;
  @IsIn(Object.values(ServiceKind)) kind!: string;
  @IsString() @Matches(MONEY) @MaxLength(24) quantityMilliUnits!: string;
  @IsOptional() @IsString() @Matches(MONEY) @MaxLength(24) tonnageMilliTons?: string | null;
  @IsOptional() @IsISO8601() periodFrom?: string | null;
  @IsOptional() @IsISO8601() periodTo?: string | null;
  @IsString() @Matches(MONEY) @MaxLength(19) rateKopecks!: string;
  @IsOptional() @IsString() @Matches(CURRENCY) currency?: string;
  @IsISO8601() renderedAt!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
}

/**
 * RENDERED is deliberately absent. The controller already refuses anything but
 * APPROVED or REJECTED, and a decision endpoint that accepted "put it back to
 * rendered" would be undoing an approval rather than making one.
 */
export class DecideDealServiceDto {
  @IsIn([ServiceStatus.APPROVED, ServiceStatus.REJECTED]) intended!: string;
}

export class ReverseDealServiceDto {
  @IsISO8601() renderedAt!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
}

export class RecordPaymentDto {
  @IsString() @MaxLength(ID_LENGTH) dealId!: string;
  @IsString() @MaxLength(ID_LENGTH) counterpartyOrgId!: string;
  @IsIn(['INCOMING', 'OUTGOING']) direction!: string;
  @IsString() @Matches(MONEY) @MaxLength(19) amountKopecks!: string;
  @IsOptional() @IsString() @Matches(CURRENCY) currency?: string;
  @IsString() @MaxLength(ID_LENGTH) bankOperationId!: string;
  @IsISO8601() paidAt!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
}

export class AllocatePaymentDto {
  @IsString() @Matches(MONEY) @MaxLength(19) amountKopecks!: string;
  @IsISO8601() allocatedAt!: string;
  @IsString() @MaxLength(TEXT_LENGTH) reason!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) documentVersionId?: string | null;
  @IsOptional() @IsString() @MaxLength(ID_LENGTH) dealServiceId?: string | null;
}

export class PrepareReconciliationDto {
  @IsString() @MaxLength(ID_LENGTH) dealId!: string;
  @IsString() @MaxLength(ID_LENGTH) counterpartyOrgId!: string;
  @IsISO8601() periodStart!: string;
  @IsISO8601() periodEnd!: string;
  @IsOptional() @IsString() @Matches(CURRENCY) currency?: string;
}

/**
 * PREPARED is absent for the same reason RENDERED is above: the policy refuses
 * anything but AGREED or DISPUTED with INTENT_UNKNOWN, and answering a statement
 * by returning it to prepared is not an answer.
 */
export class AnswerReconciliationDto {
  @IsIn([ReconciliationStatus.AGREED, ReconciliationStatus.DISPUTED]) intended!: string;
  @IsOptional() @IsString() @MaxLength(TEXT_LENGTH) note?: string | null;
}

export class RegisterConnectionSubjectDto {
  @IsIn(['EDO', 'ONE_C', 'BANK_STATEMENT']) connectionKind!: string;
  @IsString() @MaxLength(ID_LENGTH) providerCode!: string;
  @IsIn(['PRE_PRODUCTION', 'PRODUCTION']) environment!: string;
}

export class AttestConnectionDto {
  @IsIn(['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS']) gate!: string;
  @IsIn(['APPROVED', 'REJECTED']) decision!: string;
  @IsString() @MaxLength(TEXT_LENGTH) justification!: string;
  @IsString() @MaxLength(TEXT_LENGTH) evidenceReference!: string;
  @IsISO8601() validUntil!: string;
  @IsString() @MaxLength(ID_LENGTH) idempotencyKey!: string;
  @IsString() @MaxLength(ID_LENGTH) correlationId!: string;
}
