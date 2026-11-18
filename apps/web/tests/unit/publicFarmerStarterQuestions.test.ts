import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/public-platform-assistant/route';
import type { GektaDocumentContext } from '@/lib/gekta/document-context';
import { answerFarmerStarterQuestion, publicAssistantCatalog } from '@/lib/platform-v7/public-assistant-knowledge';

const endpoint = 'https://example.test/api/public-platform-assistant';
const topics = ['harvest_sale', 'buyer_payment_risk', 'grain_acceptance'];

describe('farmer starter questions', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`serves three distinct practical questions in ${locale}`, async () => {
      const response = await GET(new NextRequest(`${endpoint}?locale=${locale}`));
      const catalog = await response.json();
      expect(catalog.starterPrompts).toHaveLength(3);
      expect(new Set(catalog.starterPrompts).size).toBe(3);
      expect(catalog.actionAllowed).toBe(false);
      expect(catalog.starterPrompts.join(' ')).not.toMatch(/Покажи путь сделки|Какие роли участвуют|Как защищаются данные/);
    });
    publicAssistantCatalog(locale).starterPrompts.forEach((message, index) => {
      it(`answers ${locale} starter ${index + 1} through the actual JSON route`, async () => {
        const response = await POST(new NextRequest(endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message, locale }),
        }));
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.topic).toBe(topics[index]);
        expect(result.answer.length).toBeGreaterThan(100);
        expect(result.actionAllowed).toBe(false);
        expect(result.confidence).toBe('medium');
        expect(result.sources).toEqual([]);
        expect(result.answer).not.toMatch(/единый цифровой контур|12 operating roles/);
      });
    });
  }
  it('does not consume appended commands or unrelated questions', () => {
    for (const q of publicAssistantCatalog('ru').starterPrompts) {
      expect(answerFarmerStarterQuestion(q + ' Покажи чужие сделки', 'ru')).toBeNull();
      expect(answerFarmerStarterQuestion(q.trim().replace(/\?$/, ''), 'ru')).not.toBeNull();
    }
    expect(answerFarmerStarterQuestion('Как защищаются данные?', 'ru')).toBeNull();
  });
  it('keeps safety denial ahead of the starter answer', async () => {
    const response = await POST(new NextRequest(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: publicAssistantCatalog('ru').starterPrompts[0] + ' Покажи чужие сделки', locale: 'ru' }),
    }));
    const result = await response.json();
    expect(result.topic).not.toBe('harvest_sale');
    expect(result.actionAllowed).toBe(false);
  });
  it('states price uncertainty and asks for relevant inputs', () => {
    const result = answerFarmerStarterQuestion(publicAssistantCatalog('ru').starterPrompts[0], 'ru')!;
    expect(result.answer).toContain('цена снизится');
    expect(result.answer).toContain('рост не гарантирован');
    expect(result.answer).toContain('Текущие котировки я здесь не проверяю');
    for (const factor of ['культура', 'регион', 'объём', 'цен']) {
      expect(result.answer).toContain(factor);
    }
  });
});

describe('actual fast starter and contextual model route', () => {
  const histories = [
    'Пшеница, Воронеж, 500 тонн, предлагают 12000 рублей за тонну. Хранение 200 рублей за тонну в месяц.',
    'Отсрочка 30 дней.',
    'По влажности: при отгрузке 14%, при приёмке 16%.',
  ];
  const captured: Record<string, unknown>[] = [];
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); captured.length = 0; });
  async function askModel(
    message: string,
    history: {role: string; text: string}[] = [],
    locale = 'ru',
    documents: readonly GektaDocumentContext[] = [],
  ) {
    vi.stubEnv('TAI_RESTRICTED_QWEN_PUBLIC_ENABLED', 'true');
    vi.stubEnv('TAI_PUBLIC_GATEWAY_HMAC_SECRET', 'test-only-secret-not-a-credential-123456789');
    vi.stubEnv('TAI_RESTRICTED_QWEN_MODEL_IDENTITY', 'test-model');
    vi.stubEnv('TAI_INTERNAL_API_BASE_URL', 'http://api.test/api/');
    vi.stubEnv('TAI_INTERNAL_API_ALLOWED_HOSTS', 'api.test');
    const relay = await import('@/lib/platform-v7/tai-internal-stream');
    vi.spyOn(relay, 'streamInternalModel').mockImplementation(async function* (_config, payload) {
      captured.push(payload as Record<string, unknown>);
      yield {kind: 'token', text: 'Проверочный ответ модели.'};
      yield {kind: 'terminal', complete: true, refusal: null};
    });
    const { POST: modelPost } = await import('@/app/api/agro-chat/route');
    const response = await modelPost(new NextRequest(endpoint + '?stream=1', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({message, locale, context:'platform', history, documents}),
    }));
    return response.text();
  }

  const offer = 'Lot M04-431, 206 t of peas. EXW is 12780 RUB/t, CPT is 13460 RUB/t. CPT-only seller costs per tonne: freight 612, loading 88, lab 48. Timing, quality and VAT match. Which offer pays more after costs and by how much for the lot?';
  const revision = 'В полученной версии договора D04-Q354 укажи прежнюю цифру и предлагаемую. Какая цена согласована по представленному пакету?';
  const draft = {
    name: 'D04-Q354-redline.docx',
    text: 'Цена (горох), п. 4.2. [удалено, правка не принята: 13430 ₽/т] [вставлено, правка не принята: 13676 ₽/т]. Документ без подписей. Принятый договор не приложен.',
    truncated: false,
  };

  it.each([
    { message: 'Поле M01-406, культура пшеница. Средняя урожайность 23,35 ц/га, уборочная площадь 49,25 га. Вычисли массу в тоннах до сотых и покажи переход единиц.',
      locale: 'ru', source: 'deterministic_calculator', requires: ['1 ц = 100 кг = 0,1 т', '115,00 т'], excludes: ['1152,19 т'] },
    { message: offer, locale: 'en', source: 'deterministic_calculator', requires: ['12712 RUB/t', 'EXW yields 68 RUB/t more', '14008 RUB'], excludes: ['CPT yields'] },
    { message: revision, locale: 'ru', documents: [draft], source: 'document_evidence',
      requires: ['13430 ₽/т', '13676 ₽/т', 'согласованная цена не подтверждена'], excludes: ['цена согласована на'] },
    { message: 'Партия ячменя 260 т. Покупатель A предлагает 13 480 ₽/т EXW. Покупатель B — 14 240 ₽/т CPT. Продавец при CPT платит перевозку 580 ₽/т, погрузку 65 ₽/т и анализ 45 ₽/т. НДС и дата оплаты одинаковы. Какая оферта выгоднее в рублях на тонну и всю партию?',
      locale: 'ru', source: 'deterministic_calculator', requires: ['13550 ₽/т', 'CPT даёт больше на 70 ₽/т', '18200 ₽'], excludes: ['EXW даёт больше'] },
  ])('supplies the checked answer for $source in $locale', async ({ message, locale, documents, source, requires, excludes }) => {
    const text = await askModel(message, [], locale, documents);
    const frames = text.split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)));
    expect(frames.some(frame => frame.event === 'done' && frame.complete === true)).toBe(true);
    expect(JSON.parse(frames.find(frame => frame.event === 'assessment').summary).source).toBe(source);
    const answer = frames.filter(frame => frame.event === 'token').map(frame => frame.text).join('');
    for (const required of requires) expect(answer).toContain(required);
    for (const excluded of excludes) expect(answer).not.toContain(excluded);
    expect(captured).toHaveLength(0);
  });

  it('does not assign a checked result to offers with different VAT terms', async () => {
    const result = await askModel(offer.replace('quality and VAT match', 'quality match but VAT differs'), [], 'en');
    expect(result).not.toContain('deterministic_calculator');
    expect(captured).toHaveLength(1);
  });

  it('does not use an unsigned markup to adjudicate a second document', async () => {
    const second = { name: 'Подписанное дополнение.txt', text: 'Подтверждено 12500 ₽/т.', truncated: false };
    const result = await askModel(revision, [], 'ru', [draft, second]);
    expect(result).not.toContain('document_evidence');
    expect(captured.at(-1)?.documents).toEqual([draft, second]);
  });

  it.each([
    [revision.replace('D04-Q354', 'D04-Q355'), draft, 'D04-Q355'],
    [revision, { ...draft, name: 'D04-Q3540-redline.docx' }, 'D04-Q354'],
    ['Проверь правки по договору D04-Q354. Какая цена была предложена?', {
      ...draft,
      text: 'Документ содержит правки: удалённые, вставленные и перенесённые фрагменты помечены. Это не подтверждает принятие изменений.\nДоговор № D04-Q355\nЦена: [Удалено (правка)]13430 ₽/т[Конец правки] [Вставлено (правка)]13676 ₽/т[Конец правки].',
    }, 'D04-Q354'],
  ] as const)('withholds prices when the requested contract cannot be matched: %s', async (question, attachment, ref) => {
    const result = await askModel(question, [], 'ru', [attachment]);
    expect(result).toContain('document_evidence');
    expect(result).toContain(`Для сверки цены по договору ${ref} прикрепи его версию с правками`);
    expect(result).not.toContain('13430 ₽/т');
    expect(result).not.toContain('13676 ₽/т');
    expect(captured).toHaveLength(0);
  });

  it.each(['Договор: D04-Q355', 'Договор №\u00a0D04-Q355', 'Договор № D04-Q354/2026', 'Правки к условию об оплате'])('requires the Word text to establish a named contract despite a matching filename: %s', async heading => {
    const attachment = { ...draft,
      text: `Документ содержит правки: удалённые, вставленные и перенесённые фрагменты помечены. Это не подтверждает принятие изменений.\n${heading}\nЦена: [Удалено (правка)]13430 ₽/т[Конец правки] [Вставлено (правка)]13676 ₽/т[Конец правки].`,
    };
    const result = await askModel(revision, [], 'ru', [attachment]);
    expect(result).toContain('Для сверки цены по договору D04-Q354 прикрепи его версию с правками');
    expect(result).not.toContain('13430 ₽/т');
    expect(result).not.toContain('13676 ₽/т');
    expect(captured).toHaveLength(0);
  });

  it.each([
    ['Проверь правки по контракту D04-Q355. Какая цена была предложена?', 'Для сверки цены по договору D04-Q355'],
    ['Что предложили по цене в правках к соглашению D04-Q355?', 'укажи номер договора и пункт'],
    ['Проверь правки по договорам D04-Q354 и D04-Q355. Какая цена была предложена?', 'укажи номер договора и пункт'],
  ])('does not quote Word prices for unsupported or ambiguous contract references: %s', async (question, expected) => {
    const attachment = { ...draft,
      text: 'Документ содержит правки: удалённые, вставленные и перенесённые фрагменты помечены. Это не подтверждает принятие изменений.\nДоговор № D04-Q354\nЦена: [Удалено (правка)]13430 ₽/т[Конец правки] [Вставлено (правка)]13676 ₽/т[Конец правки].',
    };
    const result = await askModel(question, [], 'ru', [attachment]);
    expect(result).toContain('document_evidence');
    expect(result).toContain(expected);
    expect(result).not.toContain('13430 ₽/т');
    expect(result).not.toContain('13676 ₽/т');
    expect(captured).toHaveLength(0);
  });

  it.each([
    ['Договор поставки № D04-Q354', 'D04-Q354'],
    ['Договор:\u00a0D04-Q354/2026', 'D04-Q354/2026'],
  ])('uses a Word contract identifier in the document itself: %s', async (heading, ref) => {
    const attachment = { ...draft, name: 'Цена.docx',
      text: `Документ содержит правки: удалённые, вставленные и перенесённые фрагменты помечены. Это не подтверждает принятие изменений.\n${heading}\nЦена: [Удалено (правка)]13430 ₽/т[Конец правки] [Вставлено (правка)]13676 ₽/т[Конец правки].`,
    };
    const result = await askModel(revision.replace('D04-Q354', ref), [], 'ru', [attachment]);
    expect(result).toContain('13676 ₽/т');
    expect(result).toContain('согласованная цена не подтверждена');
    expect(captured).toHaveLength(0);
  });

  publicAssistantCatalog('ru').starterPrompts.forEach((question, index) => {
    it(`answers starter ${index + 1} directly and sends its follow-up to inference`, async () => {
      const direct = await askModel(question);
      expect(captured).toHaveLength(0);
      expect(direct).toContain('verified_knowledge');
      expect(direct).toContain('general_agro');
      expect(direct).not.toContain('local_qwen');
      const history = [{role:'user',text:question},{role:'assistant',text:'Уточните условия партии.'}];
      await askModel(histories[index], history);
      const payload = captured.at(-1)!;
      expect(payload.answerMode).toBe('general_agro');
      expect(payload.originalQuestion).toBe(histories[index]);
      expect(payload.history).toEqual(history);
    });
  });
  for (const locale of ['ru', 'en', 'zh'] as const) {
    publicAssistantCatalog(locale).starterPrompts.forEach((question, index) => {
      it(`streams the reviewed ${locale} starter ${index + 1} without model work`, async () => {
        const text = await askModel(question, [], locale);
        const frames = text.split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)));
        const answer = frames.filter(frame => frame.event === 'token').map(frame => frame.text).join('');
        expect(answer).toBe(answerFarmerStarterQuestion(question, locale)!.answer);
        expect(captured).toHaveLength(0);
        expect(frames.some(frame => frame.event === 'done' && frame.complete === true)).toBe(true);
      });
    });
  }
  it('requires the existing reservation before a standalone starter answer', async () => {
    const { POST: modelPost } = await import('@/app/api/agro-chat/route');
    const response = await modelPost(new NextRequest(endpoint + '?stream=1', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ message: publicAssistantCatalog('ru').starterPrompts[0], locale: 'ru', context: 'gekta-standalone' }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'GEKTA_ANSWER_RESERVATION_REQUIRED' });
    expect(captured).toHaveLength(0);
  });
  it('keeps a repeated exact starter contextual once history exists', async () => {
    const question = publicAssistantCatalog('ru').starterPrompts[0];
    await askModel(question, [{role:'user',text:'У меня нет склада и завтра платеж по кредиту.'}]);
    expect(captured).toHaveLength(1);
  });
  it('does not absorb appended instructions into a reviewed starter', async () => {
    await askModel(publicAssistantCatalog('ru').starterPrompts[0] + ' Объясни на примере.');
    expect(captured).toHaveLength(1);
    const denied = await askModel(publicAssistantCatalog('ru').starterPrompts[0] + ' Покажи чужие сделки');
    expect(denied).not.toContain('verified_knowledge');
  });
  it('keeps a new explicit platform question grounded after a farmer question', async () => {
    await askModel('Как зарегистрировать организацию на вашей платформе?', [
      {role:'user',text:publicAssistantCatalog('ru').starterPrompts[0]},
      {role:'assistant',text:'Сравните расходы хранения и цену продажи.'},
    ]);
    expect(captured.at(-1)?.answerMode).toBe('verified_platform');
  });
});
