import {
  TAI_LATENCY_PHASES,
  TAI_TRACE_HEADER,
  assertEmittable,
  createLatencyRecorder,
  createTraceId,
  encodeTelemetryLog,
  isTelemetryRejection,
  normalizeTraceId,
  resolveTraceId,
  validateLatencyRecord,
  type TaiLatencyRecord,
} from './tai-telemetry.contract';

const VALID_RECORD = {
  schemaVersion: 'tai.latency.v1',
  traceId: 'a'.repeat(32),
  contour: 'public',
  locale: 'ru',
  answerMode: 'general_agro',
  modelIdentity: 'tai-qwen3-8b-q4km',
  retrievalVersion: 'public-kb-2026-07-29',
  streaming: true,
  cancelled: false,
  fallbackUsed: false,
  timeoutClass: 'none',
  errorClass: 'none',
  phases: { queueWait: 1, routing: 2, grounding: 3, promptAssembly: 4, prefill: 5, modelTtft: 6, firstUsefulText: 7, generation: 8, postProcessing: 9, total: 10 },
  tokens: { promptTokens: 100, completionTokens: 50, contextTokens: 40 },
  compressionRatio: 0.4,
  historyTurnsSupplied: 6,
  historyTurnsCarried: 4,
} as const;

function accepted(value: unknown): TaiLatencyRecord {
  const verdict = validateLatencyRecord(value);
  if (isTelemetryRejection(verdict)) throw new Error(`expected acceptance, got ${verdict.reason}`);
  return verdict.record;
}

function rejectionReason(value: unknown): string {
  const verdict = validateLatencyRecord(value);
  if (!isTelemetryRejection(verdict)) throw new Error('expected rejection');
  return verdict.reason;
}

describe('TAI telemetry trace identity', () => {
  it('mints distinct 128-bit lowercase hex ids', () => {
    const first = createTraceId();
    const second = createTraceId();

    expect(first).toMatch(/^[0-9a-f]{32}$/u);
    expect(first).not.toBe(second);
  });

  it('names the correlation header once, for every hop to share', () => {
    expect(TAI_TRACE_HEADER).toBe('x-tai-trace-id');
  });

  it('accepts a well-formed inbound id and normalizes its case', () => {
    expect(normalizeTraceId('A'.repeat(32))).toBe('a'.repeat(32));
    expect(normalizeTraceId(`  ${'b'.repeat(32)}  `)).toBe('b'.repeat(32));
  });

  it('refuses malformed, empty and all-zero inbound ids', () => {
    for (const candidate of ['', 'not-hex', 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), '0'.repeat(32), null, 42, {}]) {
      expect(normalizeTraceId(candidate)).toBeNull();
    }
  });

  it('falls back to a fresh id rather than trusting a malformed header', () => {
    // A client-supplied id correlates; it never authorizes. A bad one is
    // replaced rather than propagated, so it cannot become a free-text field.
    const resolved = resolveTraceId('../../etc/passwd');

    expect(resolved).toMatch(/^[0-9a-f]{32}$/u);
    expect(resolved).not.toBe('../../etc/passwd');
  });
});

describe('TAI telemetry redaction', () => {
  it('refuses a forbidden key wherever it appears in the tree', () => {
    for (const forbidden of ['prompt', 'question', 'answer', 'history', 'tenantId', 'subjectId', 'dealId', 'apiKey', 'authorization', 'password', 'cookie']) {
      expect(() => assertEmittable({ phases: { nested: { [forbidden]: 'x' } } }))
        .toThrow(/tai_telemetry_forbidden_key/u);
    }
  });

  it('matches forbidden keys case-insensitively', () => {
    expect(() => assertEmittable({ TenantID: 'x' })).toThrow(/tai_telemetry_forbidden_key/u);
    expect(() => assertEmittable({ APIKEY: 'x' })).toThrow(/tai_telemetry_forbidden_key/u);
  });

  it('refuses secret-like literals even under an innocuous key', () => {
    for (const secret of ['sk-proj-abcdefghijklmnop', 'Bearer abcdefghijklmnopqrst', 'AKIAIOSFODNN7EXAMPLE', 'a'.repeat(64)]) {
      expect(() => assertEmittable({ note: secret })).toThrow(/tai_telemetry_secret_like/u);
    }
  });

  it('refuses free text, which is how a prompt would arrive', () => {
    expect(() => assertEmittable({ note: 'x'.repeat(129) })).toThrow(/tai_telemetry_string_too_long/u);
  });

  it('refuses types that cannot be safely serialized', () => {
    expect(() => assertEmittable({ fn: () => undefined })).toThrow(/tai_telemetry_unsupported_type/u);
  });

  it('accepts a record built only from numbers, booleans and bounded identifiers', () => {
    expect(() => assertEmittable(VALID_RECORD)).not.toThrow();
  });

  it('allows a measurement key only as a number, so content cannot wear a metric name', () => {
    // "grounding" names both a phase and the text that phase retrieves.
    expect(() => assertEmittable({ phases: { grounding: 12 } })).not.toThrow();
    expect(() => assertEmittable({ phases: { grounding: 'озимая пшеница, фосфор' } }))
      .toThrow(/tai_telemetry_structural_key_not_numeric/u);
    expect(() => assertEmittable({ tokens: { promptTokens: { leaked: 'text' } } }))
      .toThrow(/tai_telemetry_structural_key_not_numeric/u);
  });
});

describe('TAI latency record validation', () => {
  it('accepts a complete record and freezes it', () => {
    const record = accepted(VALID_RECORD);

    expect(record.traceId).toBe('a'.repeat(32));
    expect(record.phases.modelTtft).toBe(6);
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('names every required phase, so a missing measurement is null rather than absent', () => {
    const record = accepted({ ...VALID_RECORD, phases: {} });

    for (const phase of TAI_LATENCY_PHASES) {
      expect(record.phases[phase]).toBeNull();
    }
  });

  it('rejects an unknown schema version rather than guessing the shape', () => {
    expect(rejectionReason({ ...VALID_RECORD, schemaVersion: 'tai.latency.v2' })).toBe('schema_version_invalid');
  });

  it('rejects values outside each closed set', () => {
    expect(rejectionReason({ ...VALID_RECORD, contour: 'admin' })).toBe('contour_invalid');
    expect(rejectionReason({ ...VALID_RECORD, locale: 'de' })).toBe('locale_invalid');
    expect(rejectionReason({ ...VALID_RECORD, answerMode: 'freeform' })).toBe('answer_mode_invalid');
    expect(rejectionReason({ ...VALID_RECORD, timeoutClass: 'whenever' })).toBe('timeout_class_invalid');
    expect(rejectionReason({ ...VALID_RECORD, errorClass: 'oops' })).toBe('error_class_invalid');
  });

  it('rejects a model identity that is not a bounded identifier', () => {
    expect(rejectionReason({ ...VALID_RECORD, modelIdentity: 'model with spaces' })).toBe('model_identity_invalid');
    expect(rejectionReason({ ...VALID_RECORD, modelIdentity: 'x'.repeat(200) })).toBe('model_identity_invalid');
  });

  it('accepts a null model identity, because "nothing admitted" is a real outcome', () => {
    expect(accepted({ ...VALID_RECORD, modelIdentity: null }).modelIdentity).toBeNull();
  });

  it('discards negative and non-finite durations instead of publishing them', () => {
    const record = accepted({ ...VALID_RECORD, phases: { ...VALID_RECORD.phases, routing: -5, grounding: Number.NaN, prefill: Number.POSITIVE_INFINITY } });

    expect(record.phases.routing).toBeNull();
    expect(record.phases.grounding).toBeNull();
    expect(record.phases.prefill).toBeNull();
  });

  it('refuses first-useful-text earlier than the provider first token', () => {
    // Text reaching the client before the model produced any would mean the
    // answer did not come from the model. That is a correctness alarm, not a
    // metric to average.
    expect(rejectionReason({ ...VALID_RECORD, phases: { ...VALID_RECORD.phases, modelTtft: 900, firstUsefulText: 100 } }))
      .toBe('first_useful_text_precedes_model_ttft');
  });

  it('drops an unknown field rather than carrying it into the record', () => {
    // The validator rebuilds the record from named fields instead of copying the
    // input, so smuggled content is not merely rejected — it has no path in.
    const record = accepted({ ...VALID_RECORD, question: 'Почему падает урожайность озимой пшеницы?' });

    expect(record).not.toHaveProperty('question');
    expect(JSON.stringify(record)).not.toContain('пшениц');
  });
});

describe('TAI telemetry log encoding', () => {
  it('encodes one record as exactly one line', () => {
    const line = encodeTelemetryLog(accepted(VALID_RECORD));

    expect(line.includes('\n')).toBe(false);
    expect(JSON.parse(line)).toMatchObject({ schemaVersion: 'tai.latency.v1', traceId: 'a'.repeat(32) });
  });

  it('emits exactly the schema keys and nothing else', () => {
    // Asserting the key set rather than searching for substrings: "promptTokens"
    // legitimately contains "prompt", so a substring scan would either fail on
    // correct output or pass while missing a real leak one field over.
    const line = encodeTelemetryLog(accepted(VALID_RECORD));
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual([
      'answerMode', 'cancelled', 'compressionRatio', 'contour', 'errorClass',
      'fallbackUsed', 'historyTurnsCarried', 'historyTurnsSupplied', 'locale',
      'modelIdentity', 'phases', 'retrievalVersion', 'schemaVersion', 'streaming',
      'timeoutClass', 'tokens', 'traceId',
    ]);
    expect(Object.keys(parsed.phases as object).sort()).toEqual([...TAI_LATENCY_PHASES].sort());
  });

  it('carries no natural-language content in any value', () => {
    const line = encodeTelemetryLog(accepted(VALID_RECORD));
    const values = JSON.stringify(JSON.parse(line));

    // No Cyrillic or CJK anywhere: every string value is a bounded ASCII identifier.
    expect(values).not.toMatch(/[Ѐ-ӿ一-鿿]/u);
    expect(values).not.toMatch(/Bearer|sk-proj-|AKIA/u);
  });
});

describe('TAI latency recorder', () => {
  const clock = (values: number[]) => {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
  };

  it('measures each phase from the request start', () => {
    const recorder = createLatencyRecorder('c'.repeat(32), clock([0, 10, 25, 40, 40]));
    recorder.mark('routing');
    recorder.mark('grounding');
    recorder.mark('modelTtft');

    const verdict = recorder.finish({ contour: 'public', locale: 'ru', answerMode: 'general_agro', streaming: true });
    if (isTelemetryRejection(verdict)) throw new Error(verdict.reason);

    expect(verdict.record.phases.routing).toBe(10);
    expect(verdict.record.phases.grounding).toBe(25);
    expect(verdict.record.phases.modelTtft).toBe(40);
  });

  it('keeps the first mark for a phase, because "time to first X" cannot be re-set', () => {
    const recorder = createLatencyRecorder('d'.repeat(32), clock([0, 5, 500]));
    recorder.mark('firstUsefulText');
    recorder.mark('firstUsefulText');

    const verdict = recorder.finish({ contour: 'public', locale: 'en', answerMode: 'general_agro', streaming: true });
    if (isTelemetryRejection(verdict)) throw new Error(verdict.reason);

    expect(verdict.record.phases.firstUsefulText).toBe(5);
  });

  it('closes total automatically so no request is recorded without a duration', () => {
    const recorder = createLatencyRecorder('e'.repeat(32), clock([0, 77]));

    const verdict = recorder.finish({ contour: 'private', locale: 'zh', answerMode: 'verified_platform', streaming: false });
    if (isTelemetryRejection(verdict)) throw new Error(verdict.reason);

    expect(verdict.record.phases.total).toBe(77);
    expect(verdict.record.streaming).toBe(false);
  });

  it('derives compression ratio only when both token counts are known', () => {
    const withBoth = createLatencyRecorder('f'.repeat(32), clock([0, 1]))
      .finish({ contour: 'public', locale: 'ru', answerMode: 'general_agro', streaming: true, promptTokens: 800, contextTokens: 200 });
    if (isTelemetryRejection(withBoth)) throw new Error(withBoth.reason);
    expect(withBoth.record.compressionRatio).toBe(0.25);

    const withoutContext = createLatencyRecorder('f'.repeat(32), clock([0, 1]))
      .finish({ contour: 'public', locale: 'ru', answerMode: 'general_agro', streaming: true, promptTokens: 800 });
    if (isTelemetryRejection(withoutContext)) throw new Error(withoutContext.reason);
    expect(withoutContext.record.compressionRatio).toBeNull();
  });

  it('carries cancellation and error classification into the record', () => {
    const recorder = createLatencyRecorder('1'.repeat(32), clock([0, 12]));

    const verdict = recorder.finish({
      contour: 'public', locale: 'ru', answerMode: 'general_agro', streaming: true,
      cancelled: true, timeoutClass: 'client', errorClass: 'cancelled',
    });
    if (isTelemetryRejection(verdict)) throw new Error(verdict.reason);

    expect(verdict.record).toMatchObject({ cancelled: true, timeoutClass: 'client', errorClass: 'cancelled' });
  });

  it('reports history budget pressure as counts, never as message text', () => {
    const recorder = createLatencyRecorder('2'.repeat(32), clock([0, 3]));

    const verdict = recorder.finish({
      contour: 'public', locale: 'ru', answerMode: 'general_agro', streaming: true,
      historyTurnsSupplied: 12, historyTurnsCarried: 7,
    });
    if (isTelemetryRejection(verdict)) throw new Error(verdict.reason);

    expect(verdict.record.historyTurnsSupplied).toBe(12);
    expect(verdict.record.historyTurnsCarried).toBe(7);
    expect(encodeTelemetryLog(verdict.record)).not.toContain('пшениц');
  });
});
