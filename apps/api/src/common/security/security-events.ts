import type { Logger } from '@nestjs/common';

/**
 * ASVS 5.0 V16.3.3: log the security events named in the documentation, and log
 * attempts to bypass the security controls.
 *
 * A bypass attempt is not the same thing as a business action, and it does not
 * belong in the same place. AuditService writes a hash-chained row that needs an
 * actor, a role and usually a deal; the requests recorded here are frequently
 * unauthenticated, carry none of that, and arrive in volume precisely when
 * someone is probing. Writing them into the tamper-evident chain would give an
 * anonymous caller a way to grow it at will. They are emitted to the application
 * log instead, as one structured line per event.
 *
 * Emitted at `warn` deliberately. Production narrows the logger to fatal, error,
 * warn and log (V13.4.2), so anything written at debug here would exist only on
 * a developer's machine - which is the one place these events do not matter.
 *
 * Every field is bounded and chosen by this codebase rather than by the caller.
 * The reason a rejected request is interesting is that its contents are hostile:
 * echoing the payload, the header, or the validation message back into the log
 * would put attacker-chosen text into the record that is supposed to be evidence
 * about the attacker. Property NAMES come from the DTO, the route comes from the
 * route table, and the reason is a fixed code.
 */

/**
 * The catalogue. docs/security/SECURITY_EVENT_CATALOGUE.md documents each of
 * these, and verify-security-event-catalogue.mjs fails the build when the two
 * disagree in either direction, or when an event nothing emits is documented.
 */
export const SECURITY_EVENTS = Object.freeze({
  /** A request was refused by an anti-automation bound. */
  ANTI_AUTOMATION_REJECTED: 'security.anti_automation.rejected',
  /** A request body failed positive validation against its declared constraints. */
  INPUT_VALIDATION_REJECTED: 'security.input_validation.rejected',
  /** An authenticated caller was refused a route their role may not reach. */
  AUTHORIZATION_REJECTED: 'security.authorization.rejected',
});

export type SecurityEvent = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

/** Enough to correlate, never enough to carry the caller's own text. */
export interface SecurityEventDetail {
  /** The control that refused, matching the catalogue. */
  readonly control: string;
  /** Fixed code chosen here, never a message from the request or the framework. */
  readonly reason: string;
  /** Route TEMPLATE from the route table - '/deals/:id', not the requested URL. */
  readonly route?: string;
  readonly method?: string;
  /** Authenticated subject when there is one; probing is usually anonymous. */
  readonly subject?: string;
  /** Developer-defined names, never values. */
  readonly fields?: readonly string[];
  /** Small, non-identifying counters. */
  readonly count?: number;
}

const MAX_FIELDS = 20;
const MAX_FIELD_LENGTH = 64;
/** Anything outside this cannot be a name this codebase declared. */
const SAFE_NAME = /^[A-Za-z_$][\w$.-]*$/u;

/**
 * Removes anything that did not come from this codebase.
 *
 * class-validator reports the property it rejected, and for a body typed as a
 * plain object that property name is whatever the caller sent. So the names are
 * filtered rather than trusted: a name carrying a newline would otherwise let a
 * caller forge a second log line, which is the log-injection version of the
 * bypass this event exists to record.
 */
export function safeFieldNames(names: readonly unknown[] = []): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (out.length >= MAX_FIELDS) break;
    if (typeof name !== 'string') continue;
    if (name.length > MAX_FIELD_LENGTH) continue;
    if (!SAFE_NAME.test(name)) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** One structured line, so the record is parseable rather than prose. */
export function formatSecurityEvent(event: SecurityEvent, detail: SecurityEventDetail): string {
  return JSON.stringify({
    event,
    control: detail.control,
    reason: detail.reason,
    method: detail.method,
    route: detail.route,
    subject: detail.subject ?? 'anonymous',
    fields: detail.fields,
    count: detail.count,
  });
}

export function recordSecurityEvent(
  logger: Pick<Logger, 'warn'>,
  event: SecurityEvent,
  detail: SecurityEventDetail,
): void {
  logger.warn(formatSecurityEvent(event, detail));
}

/** The route template and method, taken from the route table, not the URL. */
export function requestShape(request: unknown): { method?: string; route?: string; subject?: string } {
  const req = (request ?? {}) as {
    method?: unknown;
    route?: { path?: unknown };
    user?: { id?: unknown };
  };
  return {
    method: typeof req.method === 'string' ? req.method : undefined,
    route: typeof req.route?.path === 'string' ? req.route.path : undefined,
    subject: typeof req.user?.id === 'string' ? req.user.id : undefined,
  };
}
