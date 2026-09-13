import { CallHandler, ExecutionContext, Injectable, InternalServerErrorException, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Refuses a response that carries a field which may never leave this API.
 *
 * The register records V15.3.1 as FAIL: responses here are hand-built objects,
 * nothing enforces that only the required fields are returned, and a column added
 * to a row later can ride out with it. That is a real gap and this does not close
 * it - minimisation is a property of each endpoint and cannot be retrofitted at
 * the boundary.
 *
 * What can be retrofitted is the worst case. `passwordHash` and
 * `mfa_secret_ciphertext` are read by auth services that have to read them, and
 * the row they came from is one careless `return` away from a client. Every name
 * below is one this API has no reason to send to anybody, so a response
 * containing one is a defect regardless of which endpoint produced it.
 *
 * It refuses rather than strips. Stripping would hand the client a body that
 * looks right while a leak sits unreported in production; a 500 is noticed. The
 * message names the field and the route and never the value, because a guard
 * against disclosure that logs the disclosure is not a guard.
 *
 * The walk is bounded. A response is attacker-influenced in size and shape, so an
 * unbounded traversal is a denial-of-service the guard brought with it: depth and
 * visited-node count are capped, and reaching either cap is reported rather than
 * treated as clean.
 */

export const FORBIDDEN_RESPONSE_FIELDS: readonly string[] = [
  'passwordhash',
  'password_hash',
  'mfasecret',
  'mfa_secret',
  'mfa_secret_ciphertext',
  'totpsecret',
  'totp_secret',
  'privatekey',
  'private_key',
];

const MAX_DEPTH = 12;
const MAX_NODES = 20_000;

export type FieldScanResult =
  | { readonly outcome: 'clean' }
  | { readonly outcome: 'forbidden'; readonly field: string; readonly path: string }
  | { readonly outcome: 'unbounded'; readonly reason: string };

/**
 * The first forbidden field in the body, the path to it, or the reason the walk
 * stopped. Never returns the value.
 */
export function scanForForbiddenFields(body: unknown, forbidden: readonly string[] = FORBIDDEN_RESPONSE_FIELDS): FieldScanResult {
  const denied = new Set(forbidden.map((name) => name.toLowerCase()));
  const seen = new WeakSet<object>();
  let nodes = 0;
  const stack: Array<{ value: unknown; depth: number; path: string }> = [{ value: body, depth: 0, path: '$' }];
  while (stack.length) {
    const { value, depth, path } = stack.pop() as { value: unknown; depth: number; path: string };
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value as object)) continue;
    seen.add(value as object);
    nodes += 1;
    if (nodes > MAX_NODES) return { outcome: 'unbounded', reason: `more than ${MAX_NODES} nodes` };
    if (depth > MAX_DEPTH) return { outcome: 'unbounded', reason: `deeper than ${MAX_DEPTH} levels` };
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) stack.push({ value: value[index], depth: depth + 1, path: `${path}[${index}]` });
      continue;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (denied.has(key.toLowerCase())) return { outcome: 'forbidden', field: key, path: `${path}.${key}` };
      stack.push({ value: child, depth: depth + 1, path: `${path}.${key}` });
    }
  }
  return { outcome: 'clean' };
}

@Injectable()
export class ResponseFieldGuardInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const route = `${request?.method ?? '?'} ${request?.url ?? '?'}`;
    return next.handle().pipe(map((body) => {
      const result = scanForForbiddenFields(body);
      if (result.outcome === 'forbidden') {
        throw new InternalServerErrorException(
          `response from ${route} carries ${result.field} at ${result.path}, which may never leave this API`,
        );
      }
      if (result.outcome === 'unbounded') {
        throw new InternalServerErrorException(
          `response from ${route} could not be checked for forbidden fields: ${result.reason}`,
        );
      }
      return body;
    }));
  }
}
