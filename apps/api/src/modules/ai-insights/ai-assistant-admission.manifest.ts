import { createHash } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Reading admission from the C.04 decision document rather than a flag.
 *
 * `TAI_GATEWAY_MODEL_ADMISSION=ADMITTED` is one word an operator can type. It
 * says nothing about whether a model was benchmarked, whether its licence was
 * reviewed, or whether the artifact on disk is the one that was measured — and
 * it reads identically whether all of that happened or none of it did.
 *
 * The admission authority already produces a decision document whose
 * `decision_sha256` is taken over the whole decision: the admitted models, the
 * benchmark report digests, the bundle manifest digests and the authority the
 * decision was made against. Recomputing that digest here means a fabricated
 * admission has to fabricate the benchmark and bundle evidence with it, and a
 * genuine one turns the gateway on without anyone flipping a switch.
 *
 * This module is server-only: it hashes and reads files. The browser side of
 * the contract must never import it.
 */

export const ADMISSION_DECISION_SCHEMA = 'tai.model-admission-decision.v2';

/** Why an admission document was not accepted. Never merged into one string. */
export type AdmissionRejection =
  | 'MANIFEST_PATH_UNSET'
  | 'MANIFEST_UNREADABLE'
  | 'MANIFEST_NOT_JSON'
  | 'SCHEMA_MISMATCH'
  | 'STATUS_NOT_ADMITTED'
  | 'DIGEST_MISSING'
  | 'DIGEST_MISMATCH'
  | 'OPERATIONAL_STATUS_CLAIMED'
  | 'MODEL_IDENTITY_MISMATCH';

export interface AdmissionVerdict {
  readonly admitted: boolean;
  readonly rejection: AdmissionRejection | null;
  /** Identity of the admitted primary model, or null when nothing is admitted. */
  readonly modelIdentity: string | null;
}

const REFUSED: (rejection: AdmissionRejection) => AdmissionVerdict = (rejection) => ({
  admitted: false,
  rejection,
  modelIdentity: null,
});

/**
 * The exact canonical form the admission authority hashes.
 *
 * It must agree byte for byte with Python's
 * `json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)`
 * or every genuine decision would be read as forged. Keys are sorted at every
 * depth, there is no whitespace, and non-ASCII characters stay literal —
 * `JSON.stringify` already emits them unescaped, matching `ensure_ascii=False`.
 *
 * One difference is real and worth naming rather than hiding: Python orders keys
 * by code point while JavaScript compares UTF-16 code units, so a key outside the
 * basic plane could sort differently. The decision schema uses ASCII keys only,
 * so no document the authority produces can reach that case; a document that did
 * would fail the digest rather than pass it wrongly.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

/**
 * Whether a decision document admits the model this deployment intends to serve.
 *
 * `expectedModelIdentity` is compared rather than trusted from the document:
 * a decision that admits some other model is a real decision, but not one that
 * says anything about the model this process would generate with.
 */
export function verifyAdmissionDocument(
  document: unknown,
  expectedModelIdentity: string | null,
): AdmissionVerdict {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return REFUSED('MANIFEST_NOT_JSON');
  }
  const record = document as Record<string, unknown>;

  if (record.schema_version !== ADMISSION_DECISION_SCHEMA) return REFUSED('SCHEMA_MISMATCH');
  if (record.status !== 'ADMITTED') return REFUSED('STATUS_NOT_ADMITTED');

  // The schema pins this to NOT_ATTESTED. A document claiming otherwise is not
  // a stricter admission, it is a document the authority did not produce.
  if (record.production_operational_status !== 'NOT_ATTESTED') {
    return REFUSED('OPERATIONAL_STATUS_CLAIMED');
  }

  const declared = record.decision_sha256;
  if (typeof declared !== 'string' || !/^[0-9a-f]{64}$/.test(declared)) {
    return REFUSED('DIGEST_MISSING');
  }

  // The digest is taken over the decision without the digest itself, exactly as
  // the authority computed it before stamping it in.
  const { decision_sha256: _omitted, ...hashed } = record;
  const recomputed = createHash('sha256').update(canonicalJson(hashed), 'utf8').digest('hex');
  if (recomputed !== declared) return REFUSED('DIGEST_MISMATCH');

  const primary = record.primary;
  const model =
    primary !== null && typeof primary === 'object' && !Array.isArray(primary)
      ? (primary as Record<string, unknown>).model
      : null;
  const modelId =
    model !== null && typeof model === 'object' && !Array.isArray(model)
      ? (model as Record<string, unknown>).model_id
      : null;
  if (typeof modelId !== 'string' || modelId.length === 0) {
    return REFUSED('MODEL_IDENTITY_MISMATCH');
  }
  if (expectedModelIdentity !== null && expectedModelIdentity !== modelId) {
    return REFUSED('MODEL_IDENTITY_MISMATCH');
  }

  return { admitted: true, rejection: null, modelIdentity: modelId };
}

/**
 * Which variables name the document and the intended model.
 *
 * The two contours are admitted separately — the public boundary may serve a
 * different model, or none, while the private one serves an admitted one — so
 * they read different documents rather than sharing one and hoping the identity
 * check catches the difference.
 */
export interface AdmissionSource {
  readonly manifestVariable: string;
  readonly identityVariable: string;
}

export const PRIVATE_ADMISSION_SOURCE: AdmissionSource = {
  manifestVariable: 'TAI_GATEWAY_ADMISSION_MANIFEST',
  identityVariable: 'TAI_GATEWAY_MODEL_IDENTITY',
};

export const PUBLIC_ADMISSION_SOURCE: AdmissionSource = {
  manifestVariable: 'TAI_GATEWAY_PUBLIC_ADMISSION_MANIFEST',
  identityVariable: 'TAI_GATEWAY_PUBLIC_MODEL_IDENTITY',
};

/**
 * Read and verify the decision document this deployment was pointed at.
 *
 * Read on every call rather than cached: admission is withdrawn by replacing or
 * removing the document, and a cached "admitted" would keep generating after the
 * withdrawal — the same reason the flag was read per request before.
 */
export function readAdmissionManifest(
  env: NodeJS.ProcessEnv = process.env,
  source: AdmissionSource = PRIVATE_ADMISSION_SOURCE,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): AdmissionVerdict {
  const manifestPath = (env[source.manifestVariable] || '').trim();
  if (manifestPath.length === 0) return REFUSED('MANIFEST_PATH_UNSET');

  let raw: string;
  try {
    raw = readFile(manifestPath);
  } catch {
    return REFUSED('MANIFEST_UNREADABLE');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return REFUSED('MANIFEST_NOT_JSON');
  }

  const identity = (env[source.identityVariable] || '').trim();
  return verifyAdmissionDocument(parsed, identity.length > 0 ? identity : null);
}
