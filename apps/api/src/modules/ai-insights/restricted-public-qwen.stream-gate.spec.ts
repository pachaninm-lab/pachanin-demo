import {
  ProviderStreamParser,
  StreamingAnswerGate,
} from './restricted-public-qwen.stream-gate';
import type { PublicGrounding } from './restricted-public-qwen.safety';

const grounding: PublicGrounding = Object.freeze({
  knowledgeVersion: 'test.v1',
  topic: 'general_agro',
  title: 'Агрономическая помощь',
  answer: 'Общая справка.',
  facts: Object.freeze([]),
  maturity: 'Только чтение.',
  confidence: 'medium',
  sources: Object.freeze([]),
});

function generalGate(overrides: Partial<ConstructorParameters<typeof StreamingAnswerGate>[0]> = {}) {
  return new StreamingAnswerGate({
    answerMode: 'general_agro',
    currentDataRequired: false,
    grounding,
    ...overrides,
  });
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sseChunk(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe('StreamingAnswerGate', () => {
  it('releases a sentence as soon as it is complete, without waiting for the rest', () => {
    const gate = generalGate();

    expect(gate.push('Озимая пшеница страдает от').text).toBe('');
    const first = gate.push(' переувлажнения. Дальше идёт');

    expect(first.text).toBe('Озимая пшеница страдает от переувлажнения.');
    expect(gate.withheld.trim()).toBe('Дальше идёт');
  });

  it('progressively releases a useful word-bounded general-agro prefix before a sentence terminator', () => {
    const gate = generalGate();

    const first = gate.push('Сначала проверьте корни и влажность почвы в нескольких точках поля ');

    expect(first.text.length).toBeGreaterThanOrEqual(20);
    expect(first.text).toMatch(/корн|влажност/iu);
    expect(first.text.endsWith(' ')).toBe(false);
    expect(gate.violation).toBeNull();
  });

  it('does not progressively leak an ungrounded crop-protection prescription before the sentence is complete', () => {
    const gate = generalGate();

    const first = gate.push('Для профилактики болезни применяйте зарегистрированные препараты ');
    expect(first.text).toBe('');
    expect(gate.emitted).toBe('');

    const second = gate.push('на основе манкозеба или металаксила. Проводите санитарную уборку поражённых листьев. ');
    gate.flush();

    expect(second.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(gate.emitted).not.toContain('манкозеба');
    expect(gate.emitted).not.toContain('металаксила');
    expect(gate.emitted).toContain('санитарную уборку');
  });

  it('keeps verified-platform text on complete-block release semantics', () => {
    const gate = new StreamingAnswerGate({
      answerMode: 'verified_platform',
      currentDataRequired: false,
      grounding,
    });

    expect(gate.push('Платформа помогает сравнивать предложения и проверять доступные сведения без домыслов ' ).text).toBe('');
    expect(gate.push('в рамках подтверждённых данных. ').text).toContain('Платформа помогает');
  });

  it('keeps current-evidence general-agro text on complete-block release semantics', () => {
    const gate = generalGate({ currentDataRequired: true });

    expect(gate.push('Без подтверждённого источника сначала нужно отделить устойчивые агрономические факторы ' ).text).toBe('');
    expect(gate.push('от текущих числовых значений. ').text).toContain('Без подтверждённого источника');
  });

  it('reconstructs exactly the model output across many small deltas', () => {
    const gate = generalGate();
    const sentences = [
      'Первое предложение про азот. ',
      'Второе предложение про фосфор. ',
      'Третье предложение про калий.',
    ];
    for (const sentence of sentences) {
      for (const character of sentence) gate.push(character);
    }
    gate.flush();

    expect(gate.emitted).toBe(
      'Первое предложение про азот.\nВторое предложение про фосфор.\nТретье предложение про калий.',
    );
  });

  it('reconstructs one long sentence after multiple progressive fragments', () => {
    const gate = generalGate();
    const answer = 'Сначала проверьте корни и влажность почвы в нескольких точках поля затем сравните глубину поражения и состояние узла кущения.';

    for (let offset = 0; offset < answer.length; offset += 9) {
      gate.push(answer.slice(offset, offset + 9));
    }
    gate.flush();

    expect(gate.emitted).toBe(answer);
  });

  it('carries write-claim detection across progressive fragment boundaries', () => {
    const gate = generalGate();

    const first = gate.push('Для безопасной проверки сначала сопоставьте документы и фактические данные, а я ');
    expect(first.text).not.toContain('подписал');

    const verdict = gate.push('подписал документ за вас. ');

    expect(verdict.violation).toBe('WRITE_CLAIM');
    expect(gate.violation).toBe('WRITE_CLAIM');
  });

  it('does not leak a secret token split across a progressive boundary', () => {
    const gate = generalGate();

    const first = gate.push('Для диагностики используйте только безопасные публичные данные и никогда не передавайте Bearer ');
    expect(first.text).not.toContain('abcdefghijklmnop12345');

    const verdict = gate.push('abcdefghijklmnop12345 пользователю. ');

    expect(verdict.violation).toBe('SECRET');
    expect(gate.emitted).not.toContain('abcdefghijklmnop12345');
  });

  it('does not cut an unfinished raw-link token into a progressive commit', () => {
    const gate = generalGate();

    const first = gate.push('Для проверки источника используйте официальный реестр и не копируйте сырой адрес https://example.com/very-long-path');
    expect(first.text).not.toContain('https://');
    expect(gate.withheld).toContain('https://');

    const second = gate.push(' сюда. ');
    expect(second.text).not.toContain('https://');
    expect(second.flags).toContain('RAW_LINK_REMOVED');
  });

  it('withholds an unterminated reasoning tag instead of guessing at it', () => {
    const gate = generalGate();

    const opened = gate.push('Ответ по существу. <think>внутреннее рассуждение');
    expect(opened.text).toBe('Ответ по существу.');

    const closed = gate.push(' продолжается</think> Вывод для читателя. ');
    expect(closed.text).not.toContain('внутреннее');
    expect(gate.emitted).toContain('Вывод для читателя.');
    expect(gate.emitted).not.toContain('рассуждение');
  });

  it('withholds an unbalanced tool envelope until it closes', () => {
    const gate = generalGate();

    const opened = gate.push('Полезный текст. {"tool_calls": [{"name": "search"');
    expect(opened.text).toBe('Полезный текст.');
    expect(gate.emitted).not.toContain('tool_calls');
  });

  it('refuses the whole answer when a block claims an executed write', () => {
    const gate = generalGate();
    gate.push('Первое нормальное предложение. ');

    const verdict = gate.push('Я подписал документ за вас. ');

    expect(verdict.violation).toBe('WRITE_CLAIM');
    expect(gate.violation).toBe('WRITE_CLAIM');
    expect(gate.push('Ещё текст. ').text).toBe('');
  });

  it('refuses the whole answer when a block carries secret-shaped material', () => {
    const gate = generalGate();

    const verdict = gate.push('Используйте ключ sk-proj-abcdefghijklmnop12345. ');

    expect(verdict.violation).toBe('SECRET');
  });

  it('drops a block that contradicts verified platform grounding', () => {
    const gate = new StreamingAnswerGate({
      answerMode: 'verified_platform',
      currentDataRequired: false,
      grounding,
    });

    gate.push('Платформа помогает сравнивать предложения. ');
    const unsupported = gate.push('Интеграция с 1С уже работает. ');
    gate.flush();

    expect(unsupported.flags).toContain('UNSUPPORTED_PLATFORM_ENTITY_REMOVED');
    expect(gate.emitted).not.toContain('1С');
    expect(gate.emitted).toContain('сравнивать предложения');
  });

  it('drops an exact current claim when the question needs governed evidence', () => {
    const gate = generalGate({ currentDataRequired: true });

    gate.push('Цена пшеницы сегодня 15 000 руб. ');
    gate.push('Ориентируйтесь на структуру затрат. ');
    gate.flush();

    expect(gate.emitted).not.toContain('15 000');
    expect(gate.emitted).toContain('структуру затрат');
  });

  it('keeps buffering bounded when the model never emits a terminator', () => {
    const gate = generalGate({ maxPendingChars: 120 });
    const commits: string[] = [];

    for (let index = 0; index < 40; index += 1) {
      const commit = gate.push('слово '.repeat(5));
      if (commit.text) commits.push(commit.text);
    }

    expect(commits.length).toBeGreaterThan(0);
    expect(gate.withheld.length).toBeLessThanOrEqual(200);
  });

  it('releases the trailing fragment only at flush when it is too short for progressive release', () => {
    const gate = generalGate();

    expect(gate.push('Без завершающей точки').text).toBe('');
    expect(gate.flush().text).toBe('Без завершающей точки');
  });

  it('strips a raw link out of a released block and says so', () => {
    const gate = generalGate();

    const commit = gate.push('Подробности на https://example.com/page здесь. ');

    expect(commit.text).not.toContain('https://');
    expect(commit.flags).toContain('RAW_LINK_REMOVED');
  });
});

describe('ProviderStreamParser', () => {
  it('reads deltas split across arbitrary chunk boundaries', () => {
    const parser = new ProviderStreamParser();
    const wire = `${sseChunk('Пше')}${sseChunk('ница')}`;
    const cut = Math.floor(wire.length / 2);

    const first = parser.push(encode(wire.slice(0, cut)));
    const second = parser.push(encode(wire.slice(cut)));

    expect(`${first.content}${second.content}`).toBe('Пшеница');
  });

  it('survives a chunk boundary inside a multi-byte character', () => {
    const parser = new ProviderStreamParser();
    const bytes = encode(sseChunk('小麦发黄'));
    const cut = bytes.length - 6;

    const first = parser.push(bytes.slice(0, cut));
    const second = parser.push(bytes.slice(cut));

    expect(`${first.content}${second.content}`).toBe('小麦发黄');
  });

  it('reports the finish reason and usage without treating them as content', () => {
    const parser = new ProviderStreamParser();
    const wire = `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: 'length' }],
      usage: { prompt_tokens: 12, completion_tokens: 900 },
    })}\n\ndata: [DONE]\n\n`;

    const delta = parser.push(encode(wire));

    expect(delta).toMatchObject({ content: '', finishReason: 'length', promptTokens: 12, completionTokens: 900 });
    expect(parser.finished).toBe(true);
  });

  it('drops a record the provider did not finish writing rather than salvaging it', () => {
    const parser = new ProviderStreamParser();

    const delta = parser.push(encode('data: {"choices":[{"delta":{"content":"ок"\n\n'));

    expect(delta.content).toBe('');
  });
});
