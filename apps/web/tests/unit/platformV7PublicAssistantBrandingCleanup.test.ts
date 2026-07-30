import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_STREAM_TIMEOUT_MS,
  publicSnapshotForDisplay,
  stripPublicAssistantBoilerplate,
  stripPublicAssistantInternalArtifacts,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';

const controllerSource = readFileSync(
  join(process.cwd(), 'components/platform-v7/UnifiedModalSheetFullscreenController.tsx'),
  'utf8',
);
const assistantSource = readFileSync(
  join(process.cwd(), 'components/platform-v7/PublicPlatformAssistant.tsx'),
  'utf8',
);

function snapshot(status: GatewayStreamSnapshot['status'], text: string): GatewayStreamSnapshot {
  return {
    status,
    text,
    citations: [],
    assessment: '{"safetyFlags":["INTERNAL"]}',
    modelIdentity: 'Qwen/Qwen3-8B',
    refusal: null,
  };
}

describe('public assistant production-safe UI', () => {
  it('uses one fullscreen control and the approved two-line agribusiness identity', () => {
    expect(controllerSource).toContain("title: 'ИИ для агробизнеса'");
    expect(controllerSource).toContain("subtitle: 'Разработан Прозрачной ценой для сельского хозяйства.'");
    expect(controllerSource).toContain("title: 'AI for agribusiness'");
    expect(controllerSource).toContain("subtitle: 'Developed by Transparent Price for agriculture.'");
    expect(controllerSource).toContain("title: '农业商业人工智能'");
    expect(controllerSource).toContain("subtitle: '由“透明价格”为农业打造。'");
    expect(assistantSource).toContain("title: 'ИИ для агробизнеса'");
    expect(assistantSource).toContain("subtitle: 'Разработан Прозрачной ценой для сельского хозяйства.'");
    expect(assistantSource).toContain("title: 'AI for agribusiness'");
    expect(assistantSource).toContain("subtitle: 'Developed by Transparent Price for agriculture.'");
    expect(assistantSource).toContain("title: '农业商业人工智能'");
    expect(assistantSource).toContain("subtitle: '由“透明价格”为农业打造。'");
    expect(controllerSource).toContain("querySelectorAll<HTMLElement>('.pc-modal-sheet-fullscreen-button')");
    expect(controllerSource).toContain('data-pc-public-assistant-fullscreen');
  });

  it('restores the AI mark and removes all unapproved identity children', () => {
    expect(controllerSource).toContain("mark.dataset.pcPublicAssistantAiMark = 'true'");
    expect(controllerSource).toContain("identity.dataset.pcPublicAssistantIdentity = 'two-lines-only'");
    expect(controllerSource).toContain("textGroup.className = 'pc-public-assistant-identity-copy'");
    expect(controllerSource).toContain("subtitle.dataset.pcPublicAssistantSubtitle = 'true'");
    expect(controllerSource).toContain('for (const child of Array.from(identity.children))');
    expect(controllerSource).toContain('if (child !== mark && child !== textGroup) child.remove()');
    expect(controllerSource).toContain('.pc-public-assistant-header-action {');
    expect(controllerSource).toContain('display: none !important');
  });

  it('preserves reset through a stable accessible proxy without adding header clutter', () => {
    expect(controllerSource).toContain("ru: 'Новый диалог'");
    expect(controllerSource).toContain("resetProxy.className = 'pc-public-assistant-reset-proxy'");
    expect(controllerSource).toContain("resetProxy.dataset.pcPublicAssistantResetProxy = 'true'");
    expect(controllerSource).toContain("panel.querySelector<HTMLButtonElement>('.pc-public-assistant-header-action')?.click()");
    expect(controllerSource).toContain('if (resetProxy.textContent !== label) resetProxy.textContent = label');
    expect(controllerSource).toContain('if (resetProxy.nextElementSibling !== form) form.before(resetProxy)');
    expect(controllerSource).toMatch(/return \(\) => \{[\s\S]*removeResetProxy\(\);[\s\S]*removeWatchdogError\(\);/u);
  });

  it('enforces a mobile-safe header layout without clipping or button collision', () => {
    expect(controllerSource).toContain('@media (max-width: 430px)');
    expect(controllerSource).toContain('grid-template-columns: minmax(0, 1fr) 42px 42px !important');
    expect(controllerSource).toContain('grid-template-columns: 40px minmax(0, 1fr) !important');
    expect(controllerSource).toContain("[data-pc-public-assistant-subtitle='true']");
    expect(controllerSource).toContain('color: #2f7d5a !important');
    expect(controllerSource).toContain('-webkit-line-clamp: 2 !important');
    expect(controllerSource).toContain('visibility: visible !important');
  });

  it('stops a public request that exceeds the bounded deadline and exposes a real retry action', () => {
    expect(PUBLIC_STREAM_TIMEOUT_MS).toBe(45_000);
    expect(controllerSource).toContain('PUBLIC_ASSISTANT_TIMEOUT_MS = 45_000');
    expect(controllerSource).toContain(".pc-public-assistant-composer-button[data-kind='stop']");
    expect(controllerSource).toContain('form.requestSubmit()');
  });

  it('aborts active requests before backdrop and compact Escape close the assistant', () => {
    expect(controllerSource).toContain("classList.contains('pc-public-assistant-backdrop')");
    expect(controllerSource).toContain("backdrop?.addEventListener('click', onCloseCapture, { capture: true })");
    expect(controllerSource).toContain("document.addEventListener('keydown', onEscapeCapture, { capture: true })");
    expect(controllerSource).toContain("panel.dataset.fullscreen !== 'true'");
    expect(controllerSource).toContain("backdrop?.removeEventListener('click', onCloseCapture, { capture: true })");
    expect(controllerSource).toContain("document.removeEventListener('keydown', onEscapeCapture, { capture: true })");
    expect(controllerSource).toMatch(/return \(\) => \{\s+stopActiveRequest\(\);\s+observer\.disconnect\(\);/u);
  });

  it('never projects provisional tokens or operational metadata while thinking', () => {
    const result = publicSnapshotForDisplay(snapshot('streaming', '<think>private reasoning</think> partial answer'));
    expect(result).toMatchObject({
      status: 'streaming',
      text: '',
      assessment: null,
      modelIdentity: null,
    });
  });

  it('removes reasoning blocks and nested tool envelopes from a completed answer', () => {
    const answer = [
      '<think>Проверяю внутренние шаги и вызываю инструмент.</think>',
      '{"tool_calls":[{"name":"search","arguments":{"query":"grain","secret":true}}]}',
      'Итоговый ответ пользователю.',
    ].join('\n');

    expect(stripPublicAssistantInternalArtifacts(answer)).toBe('Итоговый ответ пользователю.');
    expect(publicSnapshotForDisplay(snapshot('answered', answer))).toMatchObject({
      status: 'answered',
      text: 'Итоговый ответ пользователю.',
      assessment: null,
      modelIdentity: null,
    });
  });

  it('removes multiline and array-root internal JSON without trailing fragments', () => {
    const multiline = [
      '{',
      '  "tool_calls": [',
      '    {"name":"search","arguments":{"query":"grain {market}","quote":"\\"exact\\""}}',
      '  ]',
      '}',
      'Публичный вывод.',
    ].join('\n');
    const arrayRoot = '[{"tool_call":{"name":"lookup","arguments":{"id":1}}}]\nОтвет пользователю.';

    expect(stripPublicAssistantInternalArtifacts(multiline)).toBe('Публичный вывод.');
    expect(stripPublicAssistantInternalArtifacts(arrayRoot)).toBe('Ответ пользователю.');
  });

  it('preserves ordinary and agribusiness analysis JSON exactly', () => {
    const ordinary = 'Показатели: {"protein":12.5,"note":"скобки {сохраняются} и \\"кавычки\\""}.';
    const analysis = '{"analysis":{"protein":12.5}}';

    expect(stripPublicAssistantInternalArtifacts(ordinary)).toBe(ordinary);
    expect(stripPublicAssistantInternalArtifacts(analysis)).toBe(analysis);
    expect(publicSnapshotForDisplay(snapshot('answered', analysis))).toMatchObject({
      status: 'answered',
      text: analysis,
      refusal: null,
    });
  });

  it('recursively removes recognizable scratchpad envelopes but preserves plain reasoning data', () => {
    const envelope = '{"analysis":"Сначала вызову инструмент поиска, затем проверю результат.","final":"Ответ"}\nПубличный ответ.';
    const nested = '{"payload":{"analysis":"First call tool, then verify result","final":"answer"}}\nПубличный ответ.';
    const plain = '{"reasoning":"Содержание белка рассчитано лабораторией"}';

    expect(stripPublicAssistantInternalArtifacts(envelope)).toBe('Публичный ответ.');
    expect(stripPublicAssistantInternalArtifacts(nested)).toBe('Публичный ответ.');
    expect(stripPublicAssistantInternalArtifacts(plain)).toBe(plain);
  });

  it('fails closed on incomplete, malformed and unquoted hard internal envelopes', () => {
    const incomplete = 'Видимый префикс.\n{"tool_calls":[{"name":"search"';
    const malformed = 'До.\n{"reasoning_content":bad}\nПосле.';
    const unquoted = 'До.\n{tool_calls:[{"name":"search"}]}\nПосле.';
    const unquotedIncomplete = 'Префикс.\n{tool_call_id:';

    expect(stripPublicAssistantInternalArtifacts(incomplete)).toBe('Видимый префикс.');
    expect(stripPublicAssistantInternalArtifacts(malformed)).toBe('До.\n\nПосле.');
    expect(stripPublicAssistantInternalArtifacts(unquoted)).toBe('До.\n\nПосле.');
    expect(stripPublicAssistantInternalArtifacts(unquotedIncomplete)).toBe('Префикс.');
    expect(publicSnapshotForDisplay(snapshot('answered', '{"reasoning_content":"незавершённый')))
      .toMatchObject({ status: 'refused', text: '', refusal: 'ABSTAINED_NO_DATA' });
  });

  it('fails closed when an unterminated reasoning block consumes the final answer', () => {
    const result = publicSnapshotForDisplay(snapshot('answered', '<think>Внутреннее рассуждение без закрытия'));
    expect(result).toMatchObject({ status: 'refused', text: '', refusal: 'ABSTAINED_NO_DATA' });
  });

  it('removes the rejected integration and navigation boilerplate', () => {
    const answer = [
      'Каждый этап фиксирует событие, ответственного и основание.',
      'Внешние банковские и государственные шаги считаются подключёнными только после отдельного подтверждения интеграции.',
      'Для более подробной информации: Как работает сделка.',
    ].join('\n');

    expect(stripPublicAssistantBoilerplate(answer)).toBe(
      'Каждый этап фиксирует событие, ответственного и основание.',
    );
  });

  it('keeps substantive platform explanations unchanged', () => {
    const answer = 'Деньги и спор входят в исполнение Сделки. Следующий шаг определяется её текущим состоянием.';
    expect(stripPublicAssistantInternalArtifacts(answer)).toBe(answer);
    expect(publicSnapshotForDisplay(snapshot('answered', answer))).toMatchObject({ status: 'answered', text: answer });
  });
});
