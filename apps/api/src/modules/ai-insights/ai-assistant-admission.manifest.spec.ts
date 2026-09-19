import { createHash } from 'crypto';
import {
  ADMISSION_DECISION_SCHEMA,
  PUBLIC_ADMISSION_SOURCE,
  canonicalJson,
  readAdmissionManifest,
  verifyAdmissionDocument,
} from './ai-assistant-admission.manifest';

/**
 * The point of reading a decision document instead of a flag is that forging
 * admission has to forge the evidence the digest covers. A test suite that only
 * proved the happy path would not show that, so every case below breaks one
 * thing and requires the refusal.
 */

const MODEL = 'Qwen/Qwen3-8B';

/** Builds a document the way the admission authority does: digest last. */
function decision(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    schema_version: ADMISSION_DECISION_SCHEMA,
    status: 'ADMITTED',
    reasons: [],
    authority_sha256: 'a'.repeat(64),
    primary: {
      model: { role: 'PRIMARY', model_id: MODEL, revision: '895c8d17' },
      benchmark_report_sha256: 'b'.repeat(64),
      benchmark_manifest_sha256: 'c'.repeat(64),
      bundle_manifest_sha256: 'd'.repeat(64),
    },
    fallback: {
      model: { role: 'FALLBACK', model_id: 'mistralai/Mistral-7B-Instruct-v0.3', revision: 'c170c708' },
      benchmark_report_sha256: 'e'.repeat(64),
      benchmark_manifest_sha256: 'f'.repeat(64),
      bundle_manifest_sha256: '0'.repeat(64),
    },
    evaluated_at: '2026-07-27T22:00:00+00:00',
    production_operational_status: 'NOT_ATTESTED',
    ...overrides,
  };
  const digest = createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
  return { ...payload, decision_sha256: digest };
}

describe('canonical form agrees with the authority that produced the digest', () => {
  it('sorts keys at every depth and emits no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
    );
  });

  it('leaves non-ASCII literal, matching ensure_ascii=False', () => {
    expect(canonicalJson({ ключ: 'значение' })).toBe('{"ключ":"значение"}');
  });

  it('renders null and empty containers the way Python does', () => {
    expect(canonicalJson({ a: null, b: [], c: {} })).toBe('{"a":null,"b":[],"c":{}}');
  });
});

describe('a decision document is accepted only when it is intact', () => {
  it('admits a genuine decision for the model this deployment serves', () => {
    expect(verifyAdmissionDocument(decision(), MODEL)).toEqual({
      admitted: true,
      rejection: null,
      modelIdentity: MODEL,
    });
  });

  it('admits when no expected identity is configured, reporting what was admitted', () => {
    expect(verifyAdmissionDocument(decision(), null).modelIdentity).toBe(MODEL);
  });

  it('refuses a decision that admits some other model', () => {
    expect(verifyAdmissionDocument(decision(), 'Someone/Unapproved-7B').rejection).toBe(
      'MODEL_IDENTITY_MISMATCH',
    );
  });

  it('refuses a pending decision even though it is a real one', () => {
    expect(verifyAdmissionDocument(decision({ status: 'PENDING_ADMISSION' }), MODEL).rejection).toBe(
      'STATUS_NOT_ADMITTED',
    );
  });

  it('refuses a rejected decision', () => {
    expect(verifyAdmissionDocument(decision({ status: 'REJECTED' }), MODEL).rejection).toBe(
      'STATUS_NOT_ADMITTED',
    );
  });

  it('refuses a status flipped to ADMITTED after the digest was taken', () => {
    // The whole point: editing the word without re-deriving the evidence fails.
    const tampered = { ...decision({ status: 'REJECTED' }), status: 'ADMITTED' };

    expect(verifyAdmissionDocument(tampered, MODEL).rejection).toBe('DIGEST_MISMATCH');
  });

  it('refuses benchmark evidence swapped under an intact digest field', () => {
    const genuine = decision();
    const primary = { ...(genuine.primary as Record<string, unknown>) };
    primary.benchmark_report_sha256 = '9'.repeat(64);

    expect(verifyAdmissionDocument({ ...genuine, primary }, MODEL).rejection).toBe('DIGEST_MISMATCH');
  });

  it('refuses a document with no digest at all', () => {
    const { decision_sha256: _dropped, ...withoutDigest } = decision();

    expect(verifyAdmissionDocument(withoutDigest, MODEL).rejection).toBe('DIGEST_MISSING');
  });

  it('refuses a digest that is not a sha256 hex string', () => {
    expect(verifyAdmissionDocument({ ...decision(), decision_sha256: 'ADMITTED' }, MODEL).rejection).toBe(
      'DIGEST_MISSING',
    );
  });

  it('refuses a document from a different schema', () => {
    expect(
      verifyAdmissionDocument(decision({ schema_version: 'tai.model-admission-decision.v1' }), MODEL)
        .rejection,
    ).toBe('SCHEMA_MISMATCH');
  });

  it('refuses a document that claims an operational status the authority never grants', () => {
    expect(
      verifyAdmissionDocument(decision({ production_operational_status: 'ATTESTED' }), MODEL).rejection,
    ).toBe('OPERATIONAL_STATUS_CLAIMED');
  });

  it('refuses a decision that admits nothing', () => {
    expect(verifyAdmissionDocument(decision({ primary: null }), MODEL).rejection).toBe(
      'MODEL_IDENTITY_MISMATCH',
    );
  });

  it('refuses a value that is not an object at all', () => {
    expect(verifyAdmissionDocument(['ADMITTED'], MODEL).rejection).toBe('MANIFEST_NOT_JSON');
  });
});

describe('the environment can only say where to look, never that a model is admitted', () => {
  const read = (env: Record<string, string>, file: (path: string) => string) =>
    readAdmissionManifest(env as NodeJS.ProcessEnv, PUBLIC_ADMISSION_SOURCE, file);

  it('refuses when no document is configured', () => {
    expect(read({}, () => '').rejection).toBe('MANIFEST_PATH_UNSET');
  });

  it('refuses a configured path that cannot be read', () => {
    const missing = () => {
      throw new Error('ENOENT');
    };

    expect(read({ TAI_GATEWAY_PUBLIC_ADMISSION_MANIFEST: '/absent.json' }, missing).rejection).toBe(
      'MANIFEST_UNREADABLE',
    );
  });

  it('refuses a document that is not JSON', () => {
    expect(
      read({ TAI_GATEWAY_PUBLIC_ADMISSION_MANIFEST: '/d.json' }, () => 'ADMITTED').rejection,
    ).toBe('MANIFEST_NOT_JSON');
  });

  it('reads the public variables rather than the private ones', () => {
    const document = JSON.stringify(decision());
    const verdict = read(
      {
        TAI_GATEWAY_PUBLIC_ADMISSION_MANIFEST: '/d.json',
        TAI_GATEWAY_PUBLIC_MODEL_IDENTITY: MODEL,
        // A private admission must not leak into the public contour.
        TAI_GATEWAY_MODEL_IDENTITY: 'Someone/Unapproved-7B',
      },
      () => document,
    );

    expect(verdict).toEqual({ admitted: true, rejection: null, modelIdentity: MODEL });
  });

  it('refuses when the configured identity is not the admitted one', () => {
    expect(
      read(
        {
          TAI_GATEWAY_PUBLIC_ADMISSION_MANIFEST: '/d.json',
          TAI_GATEWAY_PUBLIC_MODEL_IDENTITY: 'Someone/Unapproved-7B',
        },
        () => JSON.stringify(decision()),
      ).rejection,
    ).toBe('MODEL_IDENTITY_MISMATCH');
  });
});
