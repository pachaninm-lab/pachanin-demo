import { stripInternalModelTrace } from './restricted-public-qwen.internal-trace';

describe('restricted public stream trace redaction boundaries', () => {
  it('is byte-preserving for text that contains no internal marker', () => {
    expect(stripInternalModelTrace(' продолжение ответа ')).toBe(' продолжение ответа ');
    expect(stripInternalModelTrace('\nСледующее предложение.')).toBe('\nСледующее предложение.');
  });

  it('keeps word and sentence separators across independently redacted stream fragments', () => {
    const fragments = [
      'Применяйте препараты на основе манкозеба',
      ' или металаксила.',
      ' Для профилактики и борьбы с грибными инфекциями',
      ' подойдут зарегистрированные средства.',
      ' Также важно соблюдать режим обработки и сроки применения.',
    ];

    const publicText = fragments.map((fragment) => stripInternalModelTrace(fragment)).join('');

    expect(publicText).toBe(
      'Применяйте препараты на основе манкозеба или металаксила. Для профилактики и борьбы с грибными инфекциями подойдут зарегистрированные средства. Также важно соблюдать режим обработки и сроки применения.',
    );
    expect(publicText).not.toMatch(/(?:препаратына|металаксила\.Для|инфекциямиподойдут|срокиприменения)/u);
  });

  it('still removes internal reasoning and tool material fail-closed', () => {
    const visible = stripInternalModelTrace(
      '<think>Скрытая внутренняя логика.</think>\nПубличный ответ.\n```tool_trace\n{"tool":"internal"}\n```',
    );

    expect(visible).toBe('Публичный ответ.');
    expect(visible).not.toContain('Скрытая');
    expect(visible).not.toContain('tool_trace');
    expect(visible).not.toContain('{"tool"');
  });
});
