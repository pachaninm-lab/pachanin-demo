import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  publicSnapshotForDisplay,
  stripPublicAssistantBoilerplate,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';

const controllerSource = readFileSync(
  join(process.cwd(), 'components/platform-v7/UnifiedModalSheetFullscreenController.tsx'),
  'utf8',
);

function answered(text: string): GatewayStreamSnapshot {
  return {
    status: 'answered',
    text,
    citations: [],
    assessment: null,
    modelIdentity: 'Qwen/Qwen3-8B',
    refusal: null,
  };
}

describe('public assistant branding and answer cleanup', () => {
  it('uses one native fullscreen control and the approved two-line identity', () => {
    expect(controllerSource).toContain("nativeFullscreen: true");
    expect(controllerSource).toContain("title: 'ИИ в агробизнесе'");
    expect(controllerSource).toContain("subtitle: 'разработан Прозрачной Ценой'");
    expect(controllerSource).toContain('if (config.nativeFullscreen)');
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

  it('rejects an answer when cleanup removes all visible content', () => {
    const result = publicSnapshotForDisplay(answered(
      'Для более подробной информации: Как работает сделка.',
    ));

    expect(result).toMatchObject({ status: 'refused', text: '', refusal: 'ABSTAINED_NO_DATA' });
  });

  it('keeps substantive platform explanations unchanged', () => {
    const answer = 'Деньги и спор входят в исполнение Сделки. Следующий шаг определяется её текущим состоянием.';
    expect(stripPublicAssistantBoilerplate(answer)).toBe(answer);
    expect(publicSnapshotForDisplay(answered(answer))).toMatchObject({ status: 'answered', text: answer });
  });
});
