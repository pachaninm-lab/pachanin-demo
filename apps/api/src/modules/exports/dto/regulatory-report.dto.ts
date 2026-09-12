import {
  IsIn,
  IsISO8601,
  IsOptional,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * The period of a filing to a regulator, checked before it becomes one.
 *
 * exportRegulatoryReport is the only export that leaves the platform - to МСХ,
 * Росстат, ФНС and Росфинмониторинг - and its handler declared the body as an
 * inline type, which erases to Object, so the pipe validated none of it. Three
 * consequences, measured against the service's own code rather than supposed:
 *
 *  - `from` and `to` become `new Date(params.from)` with no instant() check. An
 *    unparseable value is Invalid Date, and buildRosstatCsv prints the period
 *    with `from.toISOString()`, which throws RangeError: Invalid time value. A
 *    malformed request is answered with a 500.
 *  - Nothing compares the two ends. The query filters
 *    `createdAt: { gte: from, lte: to }`, so a period whose start is after its
 *    end matches no rows, and every builder then reports what an empty set
 *    reports: zero deals, zero tonnage, zero roubles - a well-formed filing
 *    stating that nothing happened, with the swapped period printed in its own
 *    header. The service already refuses that outcome when it arrives by
 *    another route: the comment above the query says a failed query used to be
 *    swallowed into `.catch(() => [])` and that «не пустой отчёт, а ложное
 *    донесение регулятору». The input path to the same filing was left open.
 *  - An unknown `type` reaches a bare `throw new Error('Unknown report type')`,
 *    which Nest answers as 500 rather than as the malformed request it is.
 *
 * The four names below are the switch's own cases in exportRegulatoryReport.
 */

/**
 * A cross-field rule cannot be expressed by a per-field decorator, and it has
 * to be a rule rather than a convention: the period is what the filing claims
 * to cover, so start-after-end is not a preference about argument order.
 *
 * Equal ends are refused too. `gte`/`lte` make an equal pair a single instant
 * rather than a day, which no regulator asks for and which reports as empty for
 * the same reason a swapped pair does.
 */
@ValidatorConstraint({ name: 'regulatoryPeriodOrdered', async: false })
export class RegulatoryPeriodOrderedConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { from, to } = args.object as { from?: string; to?: string };
    const start = Date.parse(String(from));
    const end = Date.parse(String(to));
    // Two cases collapse into this one line, and an earlier version guarded
    // them separately with `from === undefined || to === undefined`. That guard
    // could not fire: @IsOptional skips this constraint entirely when `to` is
    // absent, and an absent `from` parses to NaN, which this check already
    // covers. A mutation run removed it and failed nothing, so it is gone
    // rather than left reading as a protection.
    //
    // A parse failure is @IsISO8601's finding, not this one - reporting it here
    // as well would answer one defect with two messages, which the suite
    // asserts by reading the complaints rather than the exception's message.
    if (Number.isNaN(start) || Number.isNaN(end)) return true;
    return start < end;
  }

  defaultMessage(): string {
    return 'from должен быть раньше to: период отчёта регулятору не может быть пустым или обратным';
  }
}

export const REGULATORY_REPORT_TYPES = ['msh', 'rosstat', 'fns', 'rosfinmonitoring'] as const;

export class ExportRegulatoryReportDto {
  @IsIn(REGULATORY_REPORT_TYPES) type!: (typeof REGULATORY_REPORT_TYPES)[number];
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() @Validate(RegulatoryPeriodOrderedConstraint) to?: string;
}
