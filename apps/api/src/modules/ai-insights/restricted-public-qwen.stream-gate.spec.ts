import {
  ProviderStreamParser,
  StreamingAnswerGate,
  economicComparisonFor,
  paymentTimingFromUser,
  storageCostFromUser,
  economicComparisonCopy,
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
    locale: 'ru',
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
  it.each([1, 2, 7, 48, 500])('screens live unsupported economic answers before publication at chunk size %i', (size) => {
    for (const answer of [
      'Продавать сейчас выгоднее. Основные факторы:\n1. Цена 12000 рублей.\n2. Хранение 200 рублей. Проверьте влажность и потери качества. ',
      'Если цена вырастет больше, хранение станет выгодным. Если рост будет меньше — лучше продавать сейчас. Уточните условия доставки. ',
      'Если перевозка маленькая, выгоднее по рейсу, если большая — по тонне. Сравните простой и погрузку. ',
      'If the load is small, per trip is cheaper. Compare loading and waiting charges. ',
      '如果数量少，按趟更划算。请核对装卸和等待费用。',
    ]) {
      const gate = generalGate({ economicComparison: 'storage' });
      let wire = '';
      for (let i = 0; i < answer.length; i += size) wire += gate.push(answer.slice(i, i + size)).text;
      wire += gate.flush().text;
      expect(wire).toBe(gate.emitted);
      expect(wire).not.toMatch(/выгод|лучше продавать|12000|200|cheaper|更划算|^\s*\d+[.)]\s*$/mu);
      expect(wire.length).toBeGreaterThan(10);
    }
  });

  it('holds an economic sentence before its final ranking and rejects undecided overflow', () => {
    const gate = generalGate({ economicComparison: 'transport', maxPendingChars: 150 });
    expect(gate.push('Если перевозка маленькая, а стоимость погрузки одинакова, то перевозка по рейсу ').text).toBe('');
    expect(gate.push('выгоднее. ').text).toBe('');
    expect(gate.push('а '.repeat(100)).violation).toBe('OUTPUT_LIMIT');
    expect(gate.emitted).toBe('');
  });

  it('still refuses secret and action claims before economic filtering', () => {
    const gate = generalGate({ economicComparison: 'storage' });
    expect(gate.push('Я перевёл деньги за хранение. ').violation).toBe('WRITE_CLAIM');
  });

  it('calculates only explicit user-owned storage units and period, not assistant inventions', () => {
    const history = [{ role: 'user' as const, text: 'Пшеница, 500 тонн, предлагают 12000 рублей за тонну. Хранение 200 рублей за тонну в месяц. Продавать сейчас или хранить?' }];
    expect(storageCostFromUser('Срок хранения два месяца. Насколько должна вырасти цена, чтобы покрыть только хранение?', history)).toBe(40000);
    expect(storageCostFromUser(history[0].text, [{ role: 'assistant', text: 'Срок хранения два месяца.' }])).toBeNull();
    expect(storageCostFromUser('Срок хранения два месяца.', [{ role: 'assistant', text: history[0].text }])).toBeNull();
    expect(storageCostFromUser('Срок хранения два месяца.', [...history, { role: 'user', text: 'Хранение 300 рублей за тонну в месяц.' }])).toBe(60000);
    expect(storageCostFromUser('Срок хранения два месяца.', [...history, { role: 'user', text: 'Хранение теперь 300, единицы неизвестны.' }])).toBeNull();
    expect(storageCostFromUser('Срок хранения два месяца.', [...history, { role: 'user', text: 'Хранение 300 рублей за тонну в год.' }])).toBeNull();
    expect(storageCostFromUser('Срок хранения два месяца.', [{ role: 'user', text: 'Хранение 200,25 руб/т/мес.' }])).toBe(40050);
    expect(storageCostFromUser('Срок хранения два или три месяца.', history)).toBeNull();
    expect(storageCostFromUser('Срок хранения 2.5 месяца.', history)).toBeNull();
    expect(storageCostFromUser('Срок хранения -2 месяца.', history)).toBeNull();
    expect(storageCostFromUser('Срок хранения 999 месяца.', history)).toBeNull();
  });

  it('does not inherit economics into plant or platform retention questions', () => {
    const history = [{ role: 'user' as const, text: 'Хранение зерна 200 рублей за тонну в месяц, продавать или хранить?' }];
    expect(economicComparisonFor('Срок хранения два месяца. Насколько должна вырасти цена?', history)).toBe('storage');
    expect(economicComparisonFor('Почему желтеют листья картофеля?', history)).toBeNull();
    expect(economicComparisonFor('Как долго платформа хранит персональные данные?', [])).toBeNull();
    expect(economicComparisonFor('Какова стоимость хранения документов платформой?', history)).toBeNull();
    expect(economicComparisonFor('Как хранить зерно после уборки?', history)).toBeNull();
    expect(economicComparisonFor('How to compare grain freight per trip and per tonne?', [])).toBe('transport');
    expect(economicComparisonCopy('storage', 'ru', 40000)).toContain('400 руб/т');
    expect(economicComparisonCopy('storage', 'ru', 40000)).toContain('только хранения');
    expect(economicComparisonCopy('storage', 'ru', 40000)).toContain('не доказывает общую выгодность');
  });

  it('computes deferred-payment premium only from explicit same-turn terms', () => {
    const question = 'Покупатель предлагает 12000 руб/т с оплатой сегодня или 12400 руб/т через 45 дней без банковской гарантии. Что выбрать?';
    const payment = paymentTimingFromUser(question);

    expect(economicComparisonFor(question, [])).toBe('payment_timing');
    expect(payment).toEqual({
      immediatePriceMinor: 1_200_000,
      delayedPriceMinor: 1_240_000,
      delayDays: 45,
      premiumMinor: 40_000,
      premiumBasisPoints: 333,
      guarantee: 'absent',
    });

    const copy = economicComparisonCopy('payment_timing', 'ru', null, payment);
    expect(copy).toContain('400 руб/т');
    expect(copy).toContain('3,33%');
    expect(copy).toContain('45 дней');
    expect(copy).toContain('банковской гарантии нет');
    expect(copy).not.toMatch(/выбирайте|выберите|лучше\s+(?:перв|втор|сейчас|отсроч)/iu);

    expect(paymentTimingFromUser('Покупатель предлагает 12000 руб/т или 12400 руб/т через 45 дней. Что выбрать?')).toBeNull();
    expect(paymentTimingFromUser('Покупатель предлагает 12000 руб/т сегодня или 12400 руб/т через 45–60 дней. Что выбрать?')).toBeNull();
    expect(paymentTimingFromUser('Покупатель предлагает 12000 рублей всего сегодня или 12400 рублей всего через 45 дней. Что выбрать?')).toBeNull();
  });

  it('screens model-authored payment selection and arithmetic before publication', () => {
    const gate = generalGate({ economicComparison: 'payment_timing' });
    const answer = 'Выбирайте оплату сегодня. Порог составляет 32,9% годовых. Отсутствие банковской гарантии повышает риск неплатежа. ';

    for (let offset = 0; offset < answer.length; offset += 11) gate.push(answer.slice(offset, offset + 11));
    gate.flush();

    expect(gate.emitted).not.toContain('Выбирайте');
    expect(gate.emitted).not.toContain('32,9');
    expect(gate.emitted).toContain('риск неплатежа');
  });

  it('invalidates older quantities after a unit, subject or ambiguous correction', () => {
    const history = [{ role: 'user' as const, text: 'Пшеница, хранение 200 рублей за тонну в месяц, срок два месяца. Какая стоимость?' }];
    expect(storageCostFromUser('Теперь тариф 300 рублей за тонну в месяц. Сколько стоит хранение за срок?', history)).toBeNull();
    expect(storageCostFromUser('Теперь один год. Насколько должна вырасти цена, чтобы покрыть только хранение?', history)).toBeNull();
    expect(storageCostFromUser('Какая стоимость хранения картофеля за два месяца?', history)).toBeNull();
    expect(storageCostFromUser('Какова стоимость хранения документов платформой?', history)).toBeNull();
    expect(storageCostFromUser('Какова стоимость хранения рапса за два месяца?', history)).toBeNull();
    expect(economicComparisonFor('По этим данным: хранение 200 рублей за тонну в месяц. Продавать сейчас или хранить?', [])).toBe('storage');
    expect(economicComparisonFor('По данным перевозчика, один тариф за рейс, другой за тонну. Как сравнить стоимость?', [])).toBe('transport');
    expect(storageCostFromUser('Сколько стоит хранение?', [...history, { role: 'user', text: 'Теперь тариф другой, значение уточню.' }])).toBeNull();
    for (const question of ['Теперь четыре месяца.', 'Срок хранения 2–3 месяца.', 'Срок хранения от 2 до 3 месяцев.']) {
      expect(storageCostFromUser(`${question} Насколько должна вырасти цена, чтобы покрыть только хранение?`, history)).toBeNull();
    }
    for (const rate of ['1 200', '- 200', '200–300', '1e3', '1e+3']) {
      expect(storageCostFromUser(`Хранение стоит ${rate} рублей за тонну в месяц. Срок хранения два месяца.`, [])).toBeNull();
    }
    expect(storageCostFromUser('Хранение бесплатно. Страхование стоит 200 рублей за тонну в месяц. Срок хранения два месяца.', [])).toBeNull();
    expect(storageCostFromUser('Хранение 200 рублей за тонну в месяц. Срок кредита два месяца.', [])).toBeNull();
    expect(storageCostFromUser('Не хранение 200 рублей за тонну в месяц, а страховка. Срок хранения два месяца.', [])).toBeNull();
    expect(storageCostFromUser('Хранение 200 рублей за тонну в месяц. Не срок хранения два месяца, а срок кредита.', [])).toBeNull();
  });

  it.each(['Продавайте сейчас.', 'Если показатель отрицательный — продавать сейчас.', 'Сегодня хранить, а не продавать.', 'Выбирайте оплату за рейс.', 'For small loads, choose the per-trip option.', 'If the result is negative, sell now.', '小批量应选按趟付费。', '现在卖。', 'Цена должна вырасти на четыреста рублей.'])('screens imperative and spelled-out economic claims: %s', (answer) => {
    const gate = generalGate({ economicComparison: 'storage' });
    gate.push(answer);
    gate.flush();
    expect(gate.emitted).toBe('');
  });

  it.each([1, 2, 7, 48, 500])('keeps numbered markers with their screened body at chunk size %i', (size) => {
    const gate = generalGate({ currentDataRequired: true });
    const answer = 'Основные факторы:\n1. Цена 12000 рублей за тонну.\n2. Хранение 200 рублей за тонну.\n3. Проверьте влажность и риск потери качества.\n';
    for (let i = 0; i < answer.length; i += size) gate.push(answer.slice(i, i + size));
    gate.flush();
    expect(gate.emitted).not.toMatch(/^\s*\d+[.)]\s*$/mu);
    expect(gate.emitted).not.toContain('12000');
    expect(gate.emitted).not.toContain('200');
    expect(gate.emitted).toContain('3. Проверьте влажность');
  });

  it('does not publish a numbered marker before receiving its body', () => {
    const gate = generalGate({ currentDataRequired: true });
    expect(gate.push('1. ').text).toBe('');
    expect(gate.push('Цена 12000 рублей за тонну. ').text).toBe('');
    expect(gate.push('2. ').text).toBe('');
    expect(gate.push('Уточните срок хранения. ').text).toBe('2. Уточните срок хранения.');
    gate.flush();
  });

  it('preserves a standalone numeric answer and drops trailing empty list markers', () => {
    const numeric = generalGate();
    expect(numeric.push('42. ').text).toBe('');
    expect(numeric.flush().text).toBe('42.');
    const list = generalGate();
    list.push('1. Проверьте влажность.\n2. ');
    list.flush();
    expect(list.emitted).toBe('1. Проверьте влажность.');
  });

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
      locale: 'ru',
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
      locale: 'ru',
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


  it('drops current sell advice and unsupported directional price claims before publication', () => {
    const gate = generalGate({ currentDataRequired: true });

    gate.push('Не продавайте сегодня. ');
    gate.push('Цена может быть ниже рыночной. ');
    gate.push('Сравните текущую оферту с подтверждённой котировкой. ');
    gate.flush();

    expect(gate.emitted).not.toContain('Не продавайте');
    expect(gate.emitted).not.toContain('ниже рыночной');
    expect(gate.emitted).toContain('Сравните текущую оферту');
  });

  it('drops ungrounded automatic platform behavior but keeps the participant decision boundary', () => {
    const verifiedGrounding: PublicGrounding = Object.freeze({
      ...grounding,
      answer: 'Расхождение фиксируется доказательствами. Важное решение принимает уполномоченный участник.',
    });
    const gate = new StreamingAnswerGate({
      answerMode: 'verified_platform',
      locale: 'ru',
      currentDataRequired: false,
      grounding: verifiedGrounding,
    });

    const automatic = gate.push('Система автоматически зафиксирует расхождение. ');
    gate.push('Важное решение принимает уполномоченный участник. ');
    gate.flush();

    expect(automatic.flags).toContain('UNSUPPORTED_PLATFORM_AUTONOMY_REMOVED');
    expect(gate.emitted).not.toContain('автоматически');
    expect(gate.emitted).toContain('уполномоченный участник');
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

  it('releases a complete Chinese sentence without requiring whitespace after 。', () => {
    const gate = generalGate({ locale: 'zh' });
    const first = gate.push('先检查田块排水和小麦根系。然后对照不同地块');

    expect(first.text).toBe('先检查田块排水和小麦根系。');
    expect(gate.withheld).toBe('然后对照不同地块');
    expect(gate.violation).toBeNull();
  });

  it('progresses through Han text without spaces or sentence punctuation and reconstructs it', () => {
    const gate = generalGate({ locale: 'zh' });
    const answer = '先观察叶片颜色和根系状态并记录田间湿度变化'.repeat(6);
    let firstAt = -1;
    for (let index = 0; index < answer.length; index += 3) {
      const commit = gate.push(answer.slice(index, index + 3));
      if (commit.text && firstAt < 0) firstAt = index + 3;
    }
    expect(firstAt).toBeGreaterThanOrEqual(48);
    expect(firstAt).toBeLessThan(answer.length);
    gate.flush();
    expect(gate.emitted).toBe(answer);
  });

  it.each([
    [['\n然后检查根系'], '\n然后检查根系'],
    [['\n', '然后检查根系'], '\n然后检查根系'],
    [[' ABC农机'], ' ABC农机'],
    [[' ', 'ABC农机'], ' ABC农机'],
    [['\n', ' ', '然后检查根系'], '\n然后检查根系'],
  ])('preserves a boundary arriving after a Han progressive fragment: %j', (deltas, suffix) => {
    const gate = generalGate({ locale: 'zh' });
    const prefix = '先观察叶片颜色和根系状态并记录田间湿度变化'.repeat(3);
    expect(gate.push(prefix).text).toBe(prefix);
    for (const delta of deltas) gate.push(delta);
    gate.flush();
    expect(gate.emitted).toBe(prefix + suffix);
  });

  it('keeps Chinese verified-platform output on complete-block semantics', () => {
    const gate = new StreamingAnswerGate({
      answerMode: 'verified_platform', locale: 'zh', currentDataRequired: false, grounding,
    });
    expect(gate.push('平台提供公开农业信息和查询说明').text).toBe('');
    expect(gate.push('。接下来可以核对资料').text).toBe('平台提供公开农业信息和查询说明。');
  });

  it('refuses a Chinese write claim assembled after a progressive fragment', () => {
    const gate = generalGate({ locale: 'zh' });
    gate.push('先检查地块水分并记录小麦根系情况再核对不同位置的叶片颜色与长势变化'.repeat(2) + '我');

    const refused = gate.push('签署了合同。');
    expect(refused.violation).toBe('WRITE_CLAIM');
    expect(gate.emitted).not.toContain('签署了');
  });

  it('withholds a split secret token after Chinese progressive output', () => {
    const gate = generalGate({ locale: 'zh' });
    gate.push('先检查地块水分并记录小麦根系情况再核对不同位置的叶片颜色与长势变化'.repeat(2));
    expect(gate.push('Bearer ').text).toBe('');

    const refused = gate.push('abcdefghijklmnop12345。');
    expect(refused.violation).toBe('SECRET');
    expect(gate.emitted).not.toContain('abcdefghijklmnop12345');
  });

  it('holds a Chinese pesticide prescription prefix until the unsafe block can be discarded', () => {
    const gate = generalGate({ locale: 'zh' });
    const premature = gate.push('使用药剂前先核对作物生育期并调查病害类型以及本地登记资料和标签要求记录现场温度与湿度后再推荐');
    expect(premature.text).toBe('');

    const rejected = gate.push('药剂含有某种有效成分。');
    expect(rejected.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(gate.emitted).toBe('');
    expect(gate.push('应检查田间排水和病叶分布。').text).toContain('应检查');
  });

  it('does not publish the first character of a split Chinese pesticide instruction', () => {
    const gate = generalGate({ locale: 'zh' });
    const prefix = '田间调查应记录作物生育期、病害分布与当地登记资料并核对土壤湿度及天气变化'.repeat(2);
    expect(gate.push(prefix + '使').text).toBe('');
    const rejected = gate.push('用药剂含有某种有效成分。');
    expect(rejected.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(gate.emitted).toBe('');
  });

  it('does not split an unfinished raw URL with Han path characters', () => {
    const gate = generalGate({ locale: 'zh' });
    const prefix = '先检查地块水分并记录小麦根系情况再核对不同位置的叶片颜色与长势变化'.repeat(2);
    const first = gate.push(prefix + 'https://example.com/私密路径');
    expect(first.text).toBe(prefix);
    expect(gate.withheld).toContain('https://example.com/私密路径');

    const next = gate.push('继续。');
    expect(next.text).not.toContain('https://');
    expect(next.flags).toContain('RAW_LINK_REMOVED');
    expect(gate.emitted).not.toContain('example.com');
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
