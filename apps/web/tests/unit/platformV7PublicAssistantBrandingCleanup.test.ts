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
  it('uses one fullscreen control and the approved two-line identity', () => {
    expect(controllerSource).toContain("title: 'ИИ в агробизнесе'");
    expect(controllerSource).toContain("title: 'AI for agribusiness'");
    expect(controllerSource).toContain("title: '农业商业人工智能'");
    expect(controllerSource).toContain("subtitle: 'разработан Прозрачной Ценой'");
    expect(controllerSource).toContain("querySelectorAll<HTMLElement>('.pc-modal-sheet-fullscreen-button')");
    expect(controllerSource).toContain('data-pc-public-assistant-fullscreen');
  });

  it('stops a public request that exceeds the bounded deadline and exposes a real retry action', () => {
    expect(PUBLIC_STREAM_TIMEOUT_MS).toBe(45_000);
    expect(controllerSource).toContain('PUBLIC_ASSISTANT_TIMEOUT_MS = 45_000');
    expect(controllerSource).toContain(".pc-public-assistant-composer-button[data-kind='stop']");
    expect(controllerSource).toContain('form.requestSubmit()');
  });

  it('aborts an active request when any close path unmounts the assistant', () => {
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

  it('removes reasoning blocks and tool envelopes from a completed answer', () => {
    const answer = [
      '<think>Проверяю внутренние шаги и вызываю инструмент.</think>',
      '{"tool_calls":[{"name":"search","arguments":"secret"}]}',
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
