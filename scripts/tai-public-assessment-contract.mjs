/**
 * What a real public TAI answer looks like, in one place.
 *
 * The public streaming route reports two different things in its assessment and
 * they must not be conflated. The outer record is the *relay's* own account of
 * what it did — which grounding source it used, which answer mode it resolved,
 * and whether it forwarded frames incrementally. The `upstream` record is the
 * *model's* account of how generation ended. They arrive together and they fail
 * separately: a relay can stream perfectly while the model truncates, and a
 * model can finish cleanly while the relay falls back to canned text.
 *
 * Two acceptance scripts used to read a flattened, pre-streaming shape, and when
 * the route stopped emitting it they failed on a missing model identity — a
 * message that describes a dead model, not a stale reader. This module exists so
 * there is one reader, and so the regression suite can exercise it without
 * launching a browser against production.
 *
 * On identity: the public contour deliberately publishes none. `meta` carries
 * `modelIdentity: null` by design, and the admitted identity is asserted where
 * it can actually be enforced — the relay refuses any upstream stream whose
 * identity is not the admitted one, and protected activation verifies the bound
 * model before the hosted acceptance job is allowed to run at all. So this
 * contract checks that identity is *absent* from the public stream, and treats
 * the identity guarantee as a dependency on that upstream gate rather than
 * something a public reader may restate.
 */

/** The relay only ever reports this source when a real local model answered. */
export const REAL_QWEN_SOURCE = 'local_qwen';
/** The relay's claim that frames were forwarded as produced, not sliced after. */
export const INCREMENTAL_STREAMING = 'incremental';

/**
 * Where the model identity guarantee actually comes from.
 *
 * Recorded in evidence as a named dependency rather than a value, so nobody
 * reads a hard-coded constant back out of an evidence file and mistakes it for
 * an observation.
 */
export const IDENTITY_AUTHORITY = 'protected_activation_dependency';

/** A degraded answer announces itself here; a real one carries neither. */
const DEGRADED_FLAG_PATTERN = /FALLBACK|RUNTIME_UNAVAILABLE/iu;

/** Material that must never cross into a public answer or its transport. */
export const FORBIDDEN_PUBLIC_MATERIAL = Object.freeze([
  '192.168.0.206',
  'tenantId',
  'membershipId',
  'subjectId',
  'AI_ASSISTANT_API_KEY',
  'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read one public assessment, or explain precisely which clause it broke.
 *
 * Every rejection names the field and the value seen. The failure this replaces
 * reported only `sse_model_identity_invalid`, which sent two investigation
 * rounds at the model runtime for what was a schema disagreement.
 */
export function normalizePublicQwenAssessment(assessment, id) {
  if (!isRecord(assessment)) throw new Error(`sse_assessment_missing:${id}`);

  if (assessment.source !== REAL_QWEN_SOURCE) {
    // `verified_knowledge` and `policy` are legitimate route outcomes; they are
    // simply not evidence that a model generated anything.
    throw new Error(`sse_source_invalid:${id}:${String(assessment.source)}`);
  }
  if (assessment.answerMode !== 'general_agro' || assessment.currentDataRequired !== false) {
    throw new Error(
      `sse_answer_mode_invalid:${id}:${String(assessment.answerMode)}:${String(assessment.currentDataRequired)}`,
    );
  }
  if (assessment.streaming !== INCREMENTAL_STREAMING) {
    // A route that buffered and re-sliced would either omit this or name the
    // slicing, and either way must not pass as streaming.
    throw new Error(`sse_streaming_contract_invalid:${id}:${String(assessment.streaming)}`);
  }
  // Identity belongs to the protected activation gate, not to the public stream.
  if ('modelIdentity' in assessment && assessment.modelIdentity !== null) {
    throw new Error(`sse_public_model_identity_exposed:${id}:${String(assessment.modelIdentity)}`);
  }

  const upstream = assessment.upstream;
  if (!isRecord(upstream)) {
    // Null upstream means the relay never saw a model assessment frame — it
    // streamed something, but nothing accounted for how generation ended.
    throw new Error(`sse_upstream_assessment_missing:${id}`);
  }
  if (upstream.finishReason !== 'stop') {
    throw new Error(`sse_finish_reason_invalid:${id}:${String(upstream.finishReason)}`);
  }
  if (upstream.truncated !== false) throw new Error(`sse_answer_truncated:${id}`);
  if (!Array.isArray(upstream.safetyFlags) || upstream.safetyFlags.some((flag) => typeof flag !== 'string')) {
    throw new Error(`sse_safety_flags_invalid:${id}`);
  }

  const safetyFlags = [...upstream.safetyFlags];
  const degraded = safetyFlags.filter((flag) => DEGRADED_FLAG_PATTERN.test(flag));
  if (degraded.length > 0) throw new Error(`sse_fallback_flag_present:${id}:${degraded.join(',')}`);

  return Object.freeze({
    source: assessment.source,
    answerMode: assessment.answerMode,
    currentDataRequired: assessment.currentDataRequired,
    streaming: assessment.streaming,
    finishReason: upstream.finishReason,
    truncated: upstream.truncated,
    safetyFlags: Object.freeze(safetyFlags),
    identityAuthority: IDENTITY_AUTHORITY,
    publicModelIdentityExposed: false,
  });
}

/**
 * The stream's own frames must corroborate what the assessment claims.
 *
 * An assessment is a self-report. Checking it alone would accept a route that
 * announced `streaming: 'incremental'` and emitted no tokens at all — which is
 * exactly the observed production failure, where the answer was zero characters
 * long and the run still had to be talked out of reporting PASS.
 */
export function assertRealGeneralQwen({
  id,
  text,
  frames,
  assessment,
  done,
  answer,
  minimumAnswerCharacters,
}) {
  const normalized = normalizePublicQwenAssessment(assessment, id);

  const meta = frames.find((frame) => frame.event === 'meta') ?? null;
  if (!meta) throw new Error(`sse_meta_missing:${id}`);
  if (meta.mode !== 'public') throw new Error(`sse_meta_mode_invalid:${id}:${String(meta.mode)}`);
  if (meta.modelIdentity !== null) {
    throw new Error(`sse_public_model_identity_exposed:${id}:${String(meta.modelIdentity)}`);
  }

  const tokenFrames = frames.filter((frame) => frame.event === 'token');
  if (tokenFrames.length < 1) throw new Error(`sse_no_token_frames:${id}`);
  // General agro answers are model knowledge, not sourced platform records. A
  // citation here would mean canned grounding was dressed up as a live answer.
  if (frames.some((frame) => frame.event === 'citation')) throw new Error(`sse_fake_general_agro_citation:${id}`);
  if (done?.event !== 'done' || done.complete !== true) throw new Error(`sse_incomplete:${id}`);
  if (answer.length < minimumAnswerCharacters) throw new Error(`sse_answer_too_short:${id}:${answer.length}`);

  for (const forbidden of FORBIDDEN_PUBLIC_MATERIAL) {
    if (text.includes(forbidden)) throw new Error(`sse_forbidden_material:${id}:${forbidden}`);
  }

  return Object.freeze({ ...normalized, tokenFrames: tokenFrames.length });
}
