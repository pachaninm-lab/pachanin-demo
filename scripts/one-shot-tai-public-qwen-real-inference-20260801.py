from __future__ import annotations

import json
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


# Public web route: remove the hidden 8-second cutoff, align configured deadlines,
# and never answer a general-agriculture question with unrelated platform grounding.
route_path = Path("apps/web/app/api/restricted-public-platform-assistant/route.ts")
route = route_path.read_text(encoding="utf-8")
route = replace_once(
    route,
    "const DEFAULT_TIMEOUT_MS = 90_000;\nconst FAST_FALLBACK_TIMEOUT_MS = 8_000;",
    "const DEFAULT_TIMEOUT_MS = 130_000;",
    "web timeout constants",
)
route = replace_once(
    route,
    """        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_UNAVAILABLE');
          return;
        }""",
    """        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_UNAVAILABLE');
          } else {
            writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }""",
    "general-agro disabled-runtime boundary",
)
route = replace_once(
    route,
    """            request.signal,
            Math.min(runtimeConfig.timeoutMs, FAST_FALLBACK_TIMEOUT_MS),
          );""",
    """            request.signal,
            runtimeConfig.timeoutMs,
          );""",
    "configured web-to-api timeout",
)
route = replace_once(
    route,
    """        } catch {
          if (request.signal.aborted) return;
          emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_FAST_FALLBACK');
          return;
        }""",
    """        } catch {
          if (request.signal.aborted) return;
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_FALLBACK');
          } else {
            writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }""",
    "general-agro failed-runtime boundary",
)
route = replace_once(
    route,
    """      || typeof decoded.modelIdentity !== 'string'
      || !decoded.modelIdentity.trim()
    ) throw new Error('restricted_runtime_contract_invalid');""",
    """      || typeof decoded.modelIdentity !== 'string'
      || decoded.modelIdentity.trim() !== config.identity
    ) throw new Error('restricted_runtime_contract_invalid');""",
    "approved model identity contract",
)
route = replace_once(
    route,
    "const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 90_000);",
    "const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 150_000);",
    "web timeout upper bound",
)
route = replace_once(
    route,
    """function sensitiveInputCopy(locale: PublicLocale): string {
""",
    """function modelUnavailableCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'The local agricultural AI did not finish the answer. Retry the request.';
  if (locale === 'zh') return '本地农业人工智能未能完成回答。请重试该问题。';
  return 'Локальный ИИ для агробизнеса не завершил ответ. Повтори запрос.';
}

function sensitiveInputCopy(locale: PublicLocale): string {
""",
    "localized model retry copy",
)
route_path.write_text(route, encoding="utf-8")


# Route behavior tests: platform grounding remains a truthful fallback, while
# general-agro fails closed and a healthy response beyond the old 8s cutoff wins.
route_test_path = Path("apps/web/tests/unit/platformV7RestrictedPublicQwenRoute.test.ts")
route_test = route_test_path.read_text(encoding="utf-8")
route_test = replace_once(
    route_test,
    """  afterEach(() => {
    process.env = { ...originalEnv };""",
    """  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };""",
    "route test timer cleanup",
)
route_test = replace_once(
    route_test,
    "safetyFlags: ['MODEL_FAST_FALLBACK']",
    "safetyFlags: ['MODEL_RUNTIME_FALLBACK']",
    "platform fallback flag",
)
extra_route_tests = r'''

  it('fails closed instead of using unrelated platform grounding for a general-agro model failure', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: vi.fn(async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 })),
    });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Что влияет на цену зерна?'))).text());

    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
    expect(JSON.stringify(frames[1])).toContain('UPSTREAM_ERROR');
    expect(JSON.stringify(frames[1])).toContain('Повтори запрос');
    expect(frames[2]).toMatchObject({ complete: false });
    expect(JSON.stringify(frames)).not.toContain('MODEL_RUNTIME_FALLBACK');
  });

  it('waits beyond the removed eight-second cutoff for a healthy local Qwen answer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: unknown, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(modelResponse(
        'На цену зерна влияют качество, базис поставки, логистика, сезонность, спрос и предложение.',
      )), 9_000);
      const signal = init.signal as AbortSignal;
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(request('Что влияет на цену зерна?'));
    const body = response.text();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(9_001);
    const frames = parseFrames(await body);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'token', 'assessment', 'done']);
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({
      source: 'local_qwen',
      modelIdentity: 'tai-qwen3-8b-q4km',
      answerMode: 'general_agro',
    });
    expect(frames[3]).toMatchObject({ complete: true });
  });
'''
last_close = route_test.rfind("\n});")
if last_close < 0:
    raise SystemExit("route test suite terminator missing")
route_test = route_test[:last_close] + extra_route_tests + route_test[last_close:]
route_test_path.write_text(route_test, encoding="utf-8")


# API-to-model request authority follows the documented protected 120s default.
service_path = Path("apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts")
service = service_path.read_text(encoding="utf-8")
service = replace_once(service, "const DEFAULT_TIMEOUT_MS = 80_000;", "const DEFAULT_TIMEOUT_MS = 120_000;", "api default timeout")
service = replace_once(
    service,
    "timeoutMs: boundedInteger(process.env.AI_ASSISTANT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 90_000),",
    "timeoutMs: boundedInteger(process.env.AI_ASSISTANT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 150_000),",
    "api timeout upper bound",
)
service_path.write_text(service, encoding="utf-8")

service_test_path = Path("apps/api/src/modules/ai-insights/restricted-public-qwen.service.spec.ts")
service_test = service_test_path.read_text(encoding="utf-8")
service_test = replace_once(
    service_test,
    "it('uses the bounded 80-second default when no provider timeout is configured'",
    "it('uses the bounded 120-second default when no provider timeout is configured'",
    "api timeout test title",
)
service_test = replace_once(service_test, "await jest.advanceTimersByTimeAsync(79_999);", "await jest.advanceTimersByTimeAsync(119_999);", "api pre-timeout assertion")
service_test_path.write_text(service_test, encoding="utf-8")


# Browser stream and watchdog must outlive the 130s internal request deadline.
stream_path = Path("apps/web/lib/platform-v7/ai-gateway-stream.ts")
stream = stream_path.read_text(encoding="utf-8")
stream = replace_once(stream, "Public mode defaults to 45 seconds.", "Public mode defaults to 145 seconds.", "stream timeout documentation")
stream = replace_once(stream, "export const PUBLIC_STREAM_TIMEOUT_MS = 45_000;", "export const PUBLIC_STREAM_TIMEOUT_MS = 145_000;", "stream timeout constant")
stream_path.write_text(stream, encoding="utf-8")

controller_path = Path("apps/web/components/platform-v7/UnifiedModalSheetFullscreenController.tsx")
controller = controller_path.read_text(encoding="utf-8")
controller = replace_once(controller, "const PUBLIC_ASSISTANT_TIMEOUT_MS = 45_000;", "const PUBLIC_ASSISTANT_TIMEOUT_MS = 145_000;", "UI watchdog timeout")
controller_path.write_text(controller, encoding="utf-8")

branding_test_path = Path("apps/web/tests/unit/platformV7PublicAssistantBrandingCleanup.test.ts")
branding_test = branding_test_path.read_text(encoding="utf-8")
branding_test = replace_once(branding_test, "expect(PUBLIC_STREAM_TIMEOUT_MS).toBe(45_000);", "expect(PUBLIC_STREAM_TIMEOUT_MS).toBe(145_000);", "stream timeout expectation")
branding_test = replace_once(branding_test, "PUBLIC_ASSISTANT_TIMEOUT_MS = 45_000", "PUBLIC_ASSISTANT_TIMEOUT_MS = 145_000", "watchdog timeout expectation")
branding_test_path.write_text(branding_test, encoding="utf-8")


# Exact-main hosted acceptance must prove real Qwen and semantic relevance in all
# three supported languages, not merely token/done framing.
acceptance_path = Path("scripts/tai-live-public-ai-acceptance.mjs")
acceptance = acceptance_path.read_text(encoding="utf-8")
acceptance = replace_once(
    acceptance,
    """let fullscreenVisible = null;
let answerCharacters = 0;

try {""",
    r'''let fullscreenVisible = null;
let answerCharacters = 0;
let multilingualQwen = null;

function parseSseFrames(text) {
  const frames = [];
  for (const block of text.split('\n\n')) {
    for (const line of block.splitlines?.() || block.split('\n')) {
      if (line.startsWith('data: ')) frames.push(JSON.parse(line.slice(6)));
    }
  }
  return frames;
}

function languageAndTopicEvidence(locale, answer) {
  const normalized = answer.normalize('NFKC').toLocaleLowerCase(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
  const terms = locale === 'ru'
    ? ['качество', 'логист', 'сезон', 'спрос', 'предлож', 'экспорт', 'валют', 'базис', 'урож', 'хранен']
    : locale === 'en'
      ? ['quality', 'logistic', 'season', 'demand', 'supply', 'export', 'currency', 'basis', 'harvest', 'storage']
      : ['质量', '物流', '季节', '需求', '供应', '出口', '汇率', '交货', '收获', '储存', '库存'];
  const topicMatches = terms.filter(term => normalized.includes(term));
  const languageCharacters = locale === 'ru'
    ? (answer.match(/[А-Яа-яЁё]/gu) || []).length
    : locale === 'en'
      ? (answer.match(/[A-Za-z]/gu) || []).length
      : (answer.match(/[\u3400-\u9FFF]/gu) || []).length;
  const minimumLanguageCharacters = locale === 'zh' ? 10 : 30;
  if (languageCharacters < minimumLanguageCharacters) throw new Error(`sse_language_invalid:${locale}:${languageCharacters}`);
  if (topicMatches.length < 2) throw new Error(`sse_topic_relevance_invalid:${locale}:${topicMatches.join(',')}`);
  return { languageCharacters, topicMatches };
}

async function verifyRealQwenSse() {
  const cases = [
    ['ru', 'Что влияет на цену зерна?'],
    ['en', 'What affects grain prices?'],
    ['zh', '哪些因素影响粮食价格？'],
  ];
  const results = [];
  for (const [locale, question] of cases) {
    const text = await page.evaluate(async ({ locale, question }) => {
      const response = await fetch('/api/public-platform-assistant?stream=1', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: question, locale }),
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`sse_http_${response.status}`);
      return response.text();
    }, { locale, question });
    const frames = parseSseFrames(text);
    const assessmentFrame = frames.find(frame => frame.event === 'assessment');
    const done = frames.at(-1);
    const assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
    const answer = frames.filter(frame => frame.event === 'token').map(frame => String(frame.text || '')).join('').trim();
    if (!assessment) throw new Error(`sse_assessment_missing:${locale}`);
    if (assessment.source !== 'local_qwen') throw new Error(`sse_source_invalid:${locale}:${assessment.source}`);
    if (assessment.modelIdentity !== 'tai-qwen3-8b-q4km') throw new Error(`sse_model_identity_invalid:${locale}`);
    if (assessment.answerMode !== 'general_agro' || assessment.currentDataRequired !== false) {
      throw new Error(`sse_answer_mode_invalid:${locale}`);
    }
    const flags = Array.isArray(assessment.safetyFlags) ? assessment.safetyFlags.map(String) : [];
    if (flags.some(flag => /FALLBACK|RUNTIME_UNAVAILABLE/iu.test(flag))) {
      throw new Error(`sse_fallback_flag_present:${locale}:${flags.join(',')}`);
    }
    if (frames.some(frame => frame.event === 'citation')) throw new Error(`sse_fake_general_agro_citation:${locale}`);
    if (done?.event !== 'done' || done.complete !== true) throw new Error(`sse_incomplete:${locale}`);
    if (answer.length < 80) throw new Error(`sse_answer_too_short:${locale}:${answer.length}`);
    for (const forbidden of ['192.168.0.206', 'tenantId', 'membershipId', 'subjectId', 'AI_ASSISTANT_API_KEY', 'TAI_PUBLIC_GATEWAY_HMAC_SECRET']) {
      if (text.includes(forbidden)) throw new Error(`sse_forbidden_material:${locale}:${forbidden}`);
    }
    const evidence = languageAndTopicEvidence(locale, answer);
    results.push({
      locale,
      answerCharacters: answer.length,
      source: assessment.source,
      modelIdentity: assessment.modelIdentity,
      latencyMs: typeof assessment.latencyMs === 'number' ? assessment.latencyMs : null,
      safetyFlags: flags,
      ...evidence,
      status: 'PASS',
    });
  }
  return results;
}

try {''',
    "multilingual Qwen acceptance helpers",
)
acceptance = replace_once(
    acceptance,
    """  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);

  const hidden = page.locator('.pc-public-assistant-shortcut');""",
    """  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);
  multilingualQwen = await verifyRealQwenSse();

  const hidden = page.locator('.pc-public-assistant-shortcut');""",
    "invoke multilingual Qwen acceptance",
)
acceptance = replace_once(
    acceptance,
    """    fullscreenDomCount,
    fullscreenVisible,
    status: 'PASS',""",
    """    fullscreenDomCount,
    fullscreenVisible,
    multilingualQwen,
    status: 'PASS',""",
    "PASS multilingual evidence",
)
acceptance = replace_once(
    acceptance,
    """    fullscreenDomCount,
    fullscreenVisible,
    pageErrors,""",
    """    fullscreenDomCount,
    fullscreenVisible,
    multilingualQwen,
    pageErrors,""",
    "failure multilingual evidence",
)
acceptance_path.write_text(acceptance, encoding="utf-8")


acceptance_test_path = Path("apps/web/tests/unit/taiLivePublicQwenInferenceAcceptance.test.ts")
acceptance_test_path.write_text(r'''import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/restricted-public-platform-assistant/route.ts'), 'utf8');
const acceptance = fs.readFileSync(path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'), 'utf8');
const stream = fs.readFileSync(path.join(root, 'apps/web/lib/platform-v7/ai-gateway-stream.ts'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'apps/web/components/platform-v7/UnifiedModalSheetFullscreenController.tsx'), 'utf8');

describe('real public Qwen exact-main acceptance', () => {
  it('removes the hidden eight-second cutoff and preserves the 120/130/145 second deadline hierarchy', () => {
    expect(route).not.toContain('FAST_FALLBACK_TIMEOUT_MS');
    expect(route).not.toContain('Math.min(runtimeConfig.timeoutMs');
    expect(route).toContain('const DEFAULT_TIMEOUT_MS = 130_000');
    expect(route).toContain('runtimeConfig.timeoutMs');
    expect(route).toContain('5_000, 150_000');
    expect(stream).toContain('PUBLIC_STREAM_TIMEOUT_MS = 145_000');
    expect(controller).toContain('PUBLIC_ASSISTANT_TIMEOUT_MS = 145_000');
  });

  it('never substitutes platform grounding for a failed general-agro generation', () => {
    expect(route).toContain("if (answerMode === 'verified_platform')");
    expect(route).toContain("writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale))");
    expect(route).toContain("'MODEL_RUNTIME_FALLBACK'");
    expect(route).not.toContain("'MODEL_FAST_FALLBACK'");
  });

  it('requires real multilingual Qwen assessment, identity and semantic relevance before acceptance', () => {
    for (const fragment of [
      "assessment.source !== 'local_qwen'",
      "assessment.modelIdentity !== 'tai-qwen3-8b-q4km'",
      "assessment.answerMode !== 'general_agro'",
      'sse_fallback_flag_present',
      'sse_topic_relevance_invalid',
      'sse_language_invalid',
      "['ru', 'Что влияет на цену зерна?']",
      "['en', 'What affects grain prices?']",
      "['zh', '哪些因素影响粮食价格？']",
      'multilingualQwen = await verifyRealQwenSse()',
    ]) expect(acceptance).toContain(fragment);
  });

  it('keeps exact-main, UI, privacy and failure evidence gates intact', () => {
    for (const fragment of [
      'manifestSha !== targetSha',
      'native_fullscreen_dom_count_invalid',
      'mobile_fullscreen_control_visible',
      'ui_alert_present',
      'ui_overflow',
      'public-ai-window-failure.json',
      'public-ai-window-failure-390x844.png',
      'AI_ASSISTANT_API_KEY',
      'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
    ]) expect(acceptance).toContain(fragment);
  });
});
''', encoding="utf-8")


scope_path = Path("docs/platform-v7/autopilot/scopes/tai-public-qwen-real-inference-20260801.json")
scope = json.loads(scope_path.read_text(encoding="utf-8"))
scope["allowedPaths"] = [
    "apps/web/app/api/restricted-public-platform-assistant/route.ts",
    "apps/web/tests/unit/platformV7RestrictedPublicQwenRoute.test.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.spec.ts",
    "apps/web/lib/platform-v7/ai-gateway-stream.ts",
    "apps/web/components/platform-v7/UnifiedModalSheetFullscreenController.tsx",
    "apps/web/tests/unit/platformV7PublicAssistantBrandingCleanup.test.ts",
    "scripts/tai-live-public-ai-acceptance.mjs",
    "apps/web/tests/unit/taiLivePublicQwenInferenceAcceptance.test.ts",
    "docs/platform-v7/autopilot/scopes/tai-public-qwen-real-inference-20260801.json",
]
scope["deadlineHierarchyMs"] = {
    "apiToModel": 120000,
    "webToApi": 130000,
    "browserStreamAndWatchdog": 145000,
    "hostedAcceptanceRequest": 240000,
}
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
