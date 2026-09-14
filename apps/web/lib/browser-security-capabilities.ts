/**
 * What this application needs the browser to provide, and what it does when the
 * browser does not provide it.
 *
 * Web Crypto's randomUUID and subtle are both [SecureContext] in the spec, so
 * over plain HTTP - or in a browser old enough to lack them - they are simply
 * absent. The identifiers built from them are not decorative: a deal command id
 * and a registration idempotency key are what the API deduplicates on, and a
 * staff decision is bound to a SHA-256 digest computed here.
 *
 * Before this module the application did two different undocumented things in
 * that situation. Some call sites fell back to `Date.now()` and `Math.random()`,
 * which silently turns an unguessable identifier into a predictable one and
 * leaves nothing in the record to say the substitution happened. Others called
 * the missing API directly and threw a TypeError into an event handler, which
 * reaches the user as a control that does nothing.
 *
 * ASVS V3.7.5 asks for one documented behaviour instead. It is: the feature is
 * detected, the affected action is refused with a message that names the reason,
 * and no weaker substitute is invented. docs/security/BROWSER_SECURITY_REQUIREMENTS.md
 * is that documentation.
 */

export type BrowserSecurityFeature = 'secureContext' | 'randomUUID' | 'subtleCrypto';

export const BROWSER_SECURITY_FEATURE_REASONS: Readonly<Record<BrowserSecurityFeature, string>> = Object.freeze({
  secureContext: 'Web Crypto is only available over HTTPS, and the session cookies are Secure.',
  randomUUID: 'Command and idempotency identifiers must be unguessable; there is no safe substitute.',
  subtleCrypto: 'Staff decisions are bound to a SHA-256 digest computed in the browser.',
});

type CapabilityScope = {
  readonly isSecureContext?: boolean;
  readonly crypto?: { randomUUID?: unknown; subtle?: unknown } | undefined;
};

/**
 * Which of the required features this scope is missing.
 *
 * Server-side there is no window, and the answer is "nothing missing": this is a
 * statement about the browser, and rendering must not differ between the server
 * pass and the first client pass or React will report a hydration mismatch. The
 * check runs after mount, where the real answer is available.
 */
export function browserScope(): CapabilityScope | undefined {
  // `globalThis` always exists, including on the server, so asking about it is
  // not the same as asking about a browser. `window` is what distinguishes them.
  return typeof window === 'undefined' ? undefined : (globalThis as CapabilityScope);
}

export function missingBrowserSecurityFeatures(
  scope: CapabilityScope | undefined = browserScope(),
  required: readonly BrowserSecurityFeature[] = ['secureContext', 'randomUUID'],
): BrowserSecurityFeature[] {
  if (!scope) return [];
  const missing: BrowserSecurityFeature[] = [];
  for (const feature of required) {
    if (feature === 'secureContext' && scope.isSecureContext !== true) missing.push(feature);
    if (feature === 'randomUUID' && typeof scope.crypto?.randomUUID !== 'function') missing.push(feature);
    if (feature === 'subtleCrypto' && !scope.crypto?.subtle) missing.push(feature);
  }
  return missing;
}

/** What a surface shows when it refuses for this reason. */
export const BROWSER_SECURITY_REFUSAL =
  'Действие недоступно: браузер или соединение не обеспечивают требуемую защиту. Откройте страницу по HTTPS в актуальном браузере.';

export class BrowserSecurityUnsupportedError extends Error {
  readonly missing: readonly BrowserSecurityFeature[];

  constructor(missing: readonly BrowserSecurityFeature[]) {
    super(`browser is missing required security features: ${missing.join(', ')}`);
    this.name = 'BrowserSecurityUnsupportedError';
    this.missing = missing;
  }
}

/** True when a failure was this refusal and not something else. */
export function isBrowserSecurityUnsupported(cause: unknown): cause is BrowserSecurityUnsupportedError {
  return cause instanceof BrowserSecurityUnsupportedError;
}

/**
 * An unguessable identifier, or nothing at all.
 *
 * It throws rather than returning a weaker value, because the caller's own
 * correctness depends on the strength: a predictable idempotency key is a key
 * somebody else can claim first, and the request that then loses is the real
 * one. A refused action is recoverable; a silently weak one is not visible.
 */
export function secureRandomId(prefix: string, scope: CapabilityScope | undefined = browserScope()): string {
  // No browser means no browser identifier. Unlike the capability report, which
  // answers "nothing missing" off the browser so rendering stays stable, this
  // has to produce a value and cannot, so it refuses like any other absence.
  if (!scope) throw new BrowserSecurityUnsupportedError(['randomUUID']);
  const missing = missingBrowserSecurityFeatures(scope, ['randomUUID']);
  if (missing.length > 0) throw new BrowserSecurityUnsupportedError(missing);
  const random = (scope as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  // A prefix that already ends in a separator is used as written; otherwise a
  // dash is added, which is how every call site spelled it before.
  if (!prefix) return random;
  return /[-:_/]$/u.test(prefix) ? `${prefix}${random}` : `${prefix}-${random}`;
}
