import {
  FORBIDDEN_ACTION_KEYS,
  GATEWAY_EVENTS,
  PRIVATE_IDENTITY_KEYS,
  isAcceptance,
  isRejection,
  resolveAdmission,
  resolveOutcome,
  validateFrame,
  type GatewayFrame,
} from './ai-assistant-stream.contract';

const STREAM = 'stream-abcdef12';

const accept = (candidate: unknown, mode: 'public' | 'private' = 'public') => {
  const verdict = validateFrame(candidate, mode);
  if (isRejection(verdict)) throw new Error(`expected acceptance, got: ${verdict.reason}`);
  return verdict.frame;
};

const rejectionOf = (candidate: unknown, mode: 'public' | 'private' = 'public') => {
  const verdict = validateFrame(candidate, mode);
  if (isAcceptance(verdict)) throw new Error('expected rejection, got acceptance');
  return verdict.reason;
};

describe('gateway stream contract', () => {
  describe('the event set is closed', () => {
    it('carries exactly the six documented events', () => {
      expect([...GATEWAY_EVENTS]).toEqual(['meta', 'token', 'citation', 'assessment', 'done', 'error']);
    });

    it('refuses an event nobody declared', () => {
      expect(rejectionOf({ event: 'tool_call', streamId: STREAM })).toContain('unknown event');
    });

    it('refuses a non-object frame instead of coercing it', () => {
      expect(rejectionOf('token')).toContain('must be an object');
      expect(rejectionOf(null)).toContain('must be an object');
      expect(rejectionOf([{ event: 'token' }])).toContain('must be an object');
    });
  });

  describe('read-only is structural, not aspirational', () => {
    it.each(FORBIDDEN_ACTION_KEYS)('refuses a frame carrying %s', (key) => {
      const reason = rejectionOf({ event: 'token', streamId: STREAM, text: 'hi', [key]: {} });
      expect(reason).toContain('read-only');
    });

    it('refuses a write-capable key nested inside the payload', () => {
      // A nested prepared_action is the same capability as a top-level one.
      const reason = rejectionOf({
        event: 'assessment',
        streamId: STREAM,
        summary: 'looks fine',
        operationalStatus: 'NOT_ATTESTED',
        detail: { inner: { prepared_action: { verb: 'confirm' } } },
      });
      expect(reason).toContain('prepared_action');
    });
  });

  describe('server-authorized identity never travels in a frame', () => {
    it.each(PRIVATE_IDENTITY_KEYS)('refuses a frame restating %s', (key) => {
      const reason = rejectionOf({ event: 'token', streamId: STREAM, text: 'hi', [key]: 'x' }, 'private');
      expect(reason).toContain('must not travel in a frame');
    });

    it('refuses it in the private mode too, not only the public one', () => {
      // The session establishes identity. A frame restating it can only be an echo
      // the client could tamper with, so private mode is not a licence to carry it.
      expect(rejectionOf({ event: 'token', streamId: STREAM, text: 'x', tenantId: 't' }, 'private')).toContain(
        'tenantId',
      );
    });
  });

  describe('meta', () => {
    it('accepts a null model identity, because nothing is admitted yet', () => {
      expect(accept({ event: 'meta', streamId: STREAM, mode: 'public', modelIdentity: null })).toBeDefined();
    });

    it('refuses a meta frame whose mode contradicts the stream', () => {
      const reason = rejectionOf({ event: 'meta', streamId: STREAM, mode: 'private', modelIdentity: null }, 'public');
      expect(reason).toContain('does not match the stream');
    });
  });

  describe('citation', () => {
    it('accepts a resolvable source', () => {
      expect(
        accept({
          event: 'citation',
          streamId: STREAM,
          sourceId: 'rosstat-2026-07',
          title: 'Средние цены',
          uri: 'https://rosstat.gov.ru/x',
        }),
      ).toBeDefined();
    });

    it('refuses a citation nobody can open', () => {
      // A citation that cannot be followed is indistinguishable from an invented one.
      const base = { event: 'citation', streamId: STREAM, sourceId: 's', title: 't' };
      expect(rejectionOf({ ...base, uri: 'internal://memory' })).toContain('http(s)');
      expect(rejectionOf({ ...base, uri: '   ' })).toContain('uri is required');
    });
  });

  describe('assessment', () => {
    it('refuses to raise operational maturity', () => {
      const reason = rejectionOf({
        event: 'assessment',
        streamId: STREAM,
        summary: 'ready for production',
        operationalStatus: 'ATTESTED',
      });
      expect(reason).toContain('must not raise operational maturity');
    });
  });

  describe('streamId', () => {
    it('refuses an unbounded or unsafe identifier', () => {
      expect(rejectionOf({ event: 'done', streamId: 'short', complete: true })).toContain('url-safe');
      expect(rejectionOf({ event: 'done', streamId: `${'a'.repeat(65)}`, complete: true })).toContain('url-safe');
      expect(rejectionOf({ event: 'done', streamId: 'has spaces here', complete: true })).toContain('url-safe');
    });
  });

  describe('done and error', () => {
    it('requires an explicit completion flag rather than inferring it', () => {
      expect(rejectionOf({ event: 'done', streamId: STREAM })).toContain('explicit complete flag');
      expect(accept({ event: 'done', streamId: STREAM, complete: false })).toBeDefined();
    });

    it('refuses a refusal code nobody declared', () => {
      const reason = rejectionOf({ event: 'error', streamId: STREAM, refusal: 'RETRY_LATER', message: 'x' });
      expect(reason).toContain('unknown refusal');
    });
  });
});

describe('a truncated answer is invalidated, not shown', () => {
  const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });

  it('returns the text only when the stream actually completed', () => {
    const outcome = resolveOutcome([token('цена '), token('выросла'), { event: 'done', streamId: STREAM, complete: true }]);

    expect(outcome).toEqual({ usable: true, text: 'цена выросла', refusal: null });
  });

  it('discards partial text when the stream was cancelled', () => {
    // The partial text is an answer the model never finished and nobody vouched
    // for. Showing it would be the assistant appearing to state a conclusion it
    // did not reach.
    const outcome = resolveOutcome([
      token('цена '),
      { event: 'error', streamId: STREAM, refusal: 'CANCELLED', message: 'client cancelled' },
      { event: 'done', streamId: STREAM, complete: false },
    ]);

    expect(outcome.usable).toBe(false);
    expect(outcome.text).toBe('');
    expect(outcome.refusal).toBe('CANCELLED');
  });

  it('discards text when done never arrived at all', () => {
    expect(resolveOutcome([token('половина ответа')])).toEqual({ usable: false, text: '', refusal: null });
  });

  it('discards text when done arrived incomplete without an error frame', () => {
    const outcome = resolveOutcome([token('половина'), { event: 'done', streamId: STREAM, complete: false }]);

    expect(outcome.usable).toBe(false);
    expect(outcome.text).toBe('');
  });

  it('treats an empty completed stream as unusable rather than as an empty answer', () => {
    expect(resolveOutcome([{ event: 'done', streamId: STREAM, complete: true }]).usable).toBe(false);
  });
});

describe('admission decides whether generation may run at all', () => {
  it('allows generation only for an admitted identity', () => {
    expect(
      resolveAdmission({ featureEnabled: true, modelIdentity: 'Qwen/Qwen3-8B', admissionStatus: 'ADMITTED' }),
    ).toEqual({ allowed: true, refusal: null });
  });

  it('refuses when the feature is off, before looking at the model', () => {
    expect(
      resolveAdmission({ featureEnabled: false, modelIdentity: 'Qwen/Qwen3-8B', admissionStatus: 'ADMITTED' }),
    ).toEqual({ allowed: false, refusal: 'FEATURE_DISABLED' });
  });

  it.each([
    ['no model at all', null, 'ADMITTED'],
    ['a model that is only a candidate', 'Qwen/Qwen3-8B', 'CANDIDATE'],
    ['a model with no admission record', 'Qwen/Qwen3-8B', null],
  ])('refuses with MODEL_NOT_ADMITTED for %s', (_case, modelIdentity, admissionStatus) => {
    expect(resolveAdmission({ featureEnabled: true, modelIdentity, admissionStatus })).toEqual({
      allowed: false,
      refusal: 'MODEL_NOT_ADMITTED',
    });
  });

  it('never yields a usable answer without admission', () => {
    // There is no mock and no canned fallback: an unadmitted model must be
    // indistinguishable from a switched-off feature to anyone reading the UI.
    const { allowed, refusal } = resolveAdmission({
      featureEnabled: true,
      modelIdentity: null,
      admissionStatus: null,
    });

    expect(allowed).toBe(false);
    const outcome = resolveOutcome([
      { event: 'error', streamId: STREAM, refusal: refusal!, message: 'model is not admitted' },
      { event: 'done', streamId: STREAM, complete: false },
    ]);
    expect(outcome.usable).toBe(false);
  });
});
