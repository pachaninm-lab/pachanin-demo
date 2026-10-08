import {
  ProviderStreamParser,
  StreamingAnswerGate,
  economicBlockAllowed,
  economicComparisonFor,
  paymentTimingFromUser,
  saleProceedsFromUser,
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

describe('explicit sale proceeds after delivery', () => {
  const question = 'Пшеница: 100 тонн по 12 000 рублей за тонну. Доставка 80 000 рублей. Посчитай итоговую выручку после доставки и покажи расчёт.';
  it.each([
    [question, 112000000],
    ['Wheat: 100 tonnes at 12000 RUB per tonne. Delivery 80000 RUB. Calculate revenue after delivery.', 112000000],
    ['小麦100吨，价格12000卢布/吨。运输费80000卢布。计算净收入。', 112000000],
    ['Выручка: 1,5 тонны по 100,20 руб/т. Доставка 10,05 руб.', 14025],
    ['Выручка: 100 тонн по 12000 руб/т. Доставка 0 руб.', 120000000],
    ['Выручка: 1 тонна по 100 руб/т. Доставка 150 руб.', -5000],
    ['Выручка: 100 тонн по 12\u00a0000 руб/т. Доставка 80\u202f000 руб.', 112000000],
    ['Выручка: 100 тонн по 12000 руб/т. Стоимость доставки 80000 руб.', 112000000],
    ['Delivery cost 80000 RUB. Wheat: 100 tonnes at 12000 RUB/tonne. Calculate revenue.', 112000000],
    ['Продаю пшеницу: 100 тонн по 12000 руб/т. Доставка 80000 руб. Посчитай выручку.', 112000000],
    ['Revenue: 1 200 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.', 1432000000],
    ['计算净收入：小麦1200吨，价格12000卢布/吨。运输费80000卢布。', 1432000000],
    ['计算总收入：小麦100吨，价格：12000卢布/吨，运费80000卢布。', 112000000],
    ['Revenue: 0.125 tonnes at 100 RUB/tonne. Delivery 0 RUB.', 1250],
    ['Выручка: 0.125 тонны по 100 руб/т. Доставка 0 руб.', 1250],
    ['计算净收入：小麦0.125吨，价格100卢布/吨。运输费0卢布。', 1250],
    ['Revenue: wheat delivery 80000 RUB. Wheat 100 tonnes at 12000 RUB/tonne.', 112000000],
    ['Выручка: пшеница доставка 80000 руб. Пшеница 100 тонн по 12000 руб/т.', 112000000],
    ['Revenue: corn maize 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.', 112000000],
    ['Revenue: corn 玉米 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.', 112000000],
  ])('calculates only supplied amounts: %s', (input, proceeds) => {
    const sale = saleProceedsFromUser(String(input));
    expect(sale?.proceedsMinor).toBe(proceeds);
    expect(economicComparisonFor(String(input), [])).toBe('sale_proceeds');
    for (const locale of ['ru', 'en', 'zh'] as const) {
      expect(economicComparisonCopy('sale_proceeds', locale, null, null, sale)).toContain(String(Number(proceeds) / 100));
    }
  });
  it.each([
    'Выручка: 100 тонн по 12000 руб/т.',
    'Выручка: 100 тонн. Доставка 80000 руб.',
    'Выручка: по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 800 руб/т.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 800 руб за тонну.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб. Хранение 1000 руб.',
    'Выручка: 100 или 200 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: -100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по -12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка -80000 руб.',
    'Выручка: не 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 0 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 0 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 USD/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 12 00 руб/т. Доставка 80000 руб.',
    'Выручка: 0,001 тонны по 0,01 руб/т. Доставка 0 руб.',
    'Выручка: 0.001 тонны по 0,01 руб/т. Доставка 0 руб.',
    'Revenue: 1,200 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.',
    '计算净收入：小麦1,200吨，价格12000卢布/吨。运输费80000卢布。',
    'Выручка: 1,200 тонны по 12000 руб/т. Доставка 80000 руб.',
    'Revenue: 0,125 tonnes at 100 RUB/tonne. Delivery 0 RUB.',
    'Выручка: 1.200 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Revenue: 1.200 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.',
    '计算净收入：小麦1.200吨，价格12000卢布/吨。运输费80000卢布。',
    'Выручка: 12.000 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 123.456 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 1 200.500 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Revenue: 00.125 tonnes at 100 RUB/tonne. Delivery 0 RUB.',
    'Revenue: 100 tons at 12000 RUB/tonne. Delivery 80000 RUB.',
    'How much revenue: 1,200 tonnes at 12000 RUB/tonne. Delivery 80000 RUB?',
    'How much revenue from 100 tonnes?',
    'How much revenue?',
    'What is the revenue?',
    'Сколько выручки?',
    '销售收入是多少？',
    '总收入是多少？',
    'How much are the proceeds from selling 100 tonnes?',
    'How much would the revenue be from 100 tonnes?',
    'How much is the revenue from 100 tonnes?',
    'How much will the net proceeds be after delivery?',
    'How much could our revenue be from selling 100 tonnes?',
    'How much were proceeds from selling 100 tonnes?',
    "What does the revenue from 100 tonnes amount to?",
    "What did our proceeds from selling 100 tonnes come to?",
    "What might revenue be from 100 tonnes?",
    "How much may the revenue be from 100 tonnes?",
    "What would your revenue be from 100 tonnes?",
    "How much could their proceeds be after delivery?",
    "What is this revenue from selling 100 tonnes?",
    "What has that revenue been for 100 tonnes?",
    "What has the revenue been for 100 tonnes?",
    "What had our proceeds been after delivery?",
    "What has revenue been?",
    "What have the proceeds been from selling 100 tonnes?",
    "What had our net proceeds been after delivery?",
    "How much has revenue from 100 tonnes amounted to?",
    "How much had the proceeds from selling 100 tonnes come to?",
    "What would revenue have been from 100 tonnes?",
    "What could proceeds have been after delivery?",
    "How much does the revenue from 100 tonnes amount to?",
    "How much do the proceeds from selling 100 tonnes amount to?",
    "How much did the revenue from 100 tonnes come to?",
    "How much do the proceeds amount to?",
    "How much did revenue come to?",
    "How much does our net revenue amount to?",
    "How much do our proceeds from 100 tonnes come to?",
    "What would revenue be?",
    "What should our proceeds be after delivery?",
    'What would revenue be from 100 tonnes?',
    'What is total revenue from 100 tonnes?',
    "What's revenue from 100 tonnes?",
    'What could the revenue be from 100 tonnes?',
    'What should our proceeds be after delivery?',
    '出售100吨小麦的收入是多少？',
    '销售100吨小麦的收入有多少？',
    '销售100吨小麦的收入金额是多少？',
    '出售100吨小麦的收入？',
    'What is the revenue from selling 100 tonnes?',
    'What is the revenue after delivery?',
    '总收入的金额是多少？',
    '销售收入大概有多少？',
    '净收入总共多少？',
    '请确认总收入是多少？',
    '请确认小麦100吨总收入是多少？',
    '小麦100吨总收入是多少？',
    '计算总收入',
    'What amount of revenue will 100 tonnes generate?',
    'What amount of revenue?',
    'Revenue?',
    'Revenue for 100 tonnes?',
    'Net proceeds for 100 tonnes?',
    'Выручка?',
    'Выручка от 100 тонн пшеницы?',
    '销售收入？',
    'What is the amount of revenue from 100 tonnes?',
    'What sum of revenue will 100 tonnes generate?',
    'Какова сумма выручки от 100 тонн пшеницы?',
    'Каков размер выручки от 100 тонн пшеницы?',
    'Каков размер выручки?',
    '销售100吨小麦会获得多少收入？',
    '出售100吨小麦能获得多少收入？',

    'How much revenue would 100 tonnes of wheat generate?',
    'Сколько выручки принесут 100 тонн пшеницы?',
    '100吨小麦能有多少销售收入？',

    'Какая выручка от 100 тонн?',
    '小麦100吨，净收入是多少？',
    'What would the proceeds be for 100 tonnes?',

    'Какая выручка: 1.200 тонн по 12000 руб/т. Доставка 80000 руб?',
    '净收入是多少：小麦1,200吨，价格12000卢布/吨。运输费80000卢布？',
    'What would the proceeds be for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?',
    'Сколько составит выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб?',
    'How much revenue: 100 tonnes at 12000 USD/tonne. Delivery 80000 RUB?',

    'Revenue: 100 tonnes at 12000 RUB/ton. Delivery 80000 RUB.',
    'Revenue: 100 tons at 12000 RUB/ton. Delivery 80000 RUB.',
    'Посчитай выручку: 100 тонн по 12000 руб/т. Доставка 80000 руб. Выведи в документе.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб. На платформе.',
    'Revenue: corn delivery 80000 RUB. Wheat 100 tonnes at 12000 RUB/tonne.',
    'Revenue: wheat 100 tonnes at 12000 RUB/tonne. Corn delivery 80000 RUB.',
    'Выручка: кукуруза доставка 80000 руб. Пшеница 100 тонн по 12000 руб/т.',
    'Выручка: пшеница 100 тонн по 12000 руб/т. Рис доставка 80000 руб.',
    '计算净收入：玉米运输费80000卢布。小麦100吨，价格12000卢布/吨。',
    'Revenue: wheat 100 tonnes at 12000 RUB/tonne. Soy delivery 80000 RUB.',
    'Revenue: barley 100 tonnes at 12000 RUB/tonne. Rye delivery 80000 RUB.',
    'Revenue: rice 100 tonnes at 12000 RUB/tonne. Canola delivery 80000 RUB.',
    'Revenue: sunflower 100 tonnes at 12000 RUB/tonne. Corn delivery 80000 RUB.',
    'Выручка: 999999999 тонн по 999999999 руб/т. Доставка 0 руб.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб. НДС включён.',
    'Выручка: пшеница 100 тонн. Цена сои 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн примерно по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб в месяц.',
    'Revenue: 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB each trip.',
    'Посчитай выручку: стоимость хранения 100 тонн по 12000 руб/т и доставка 80000 руб.',
    'Выручка: себестоимость 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Выручка: тариф на сушку 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Revenue: storage costs for 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.',
    'Revenue: procurement of 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.',
    'Выручка: покупаю 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Посчитай выручку от перепродажи: купил 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    'Revenue: bought 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB.',
    '计算净收入：买了100吨，价格12000卢布/吨。运输费80000卢布。',
    'Пшеница: 100 тонн по 12000 руб/т. Доставка 80000 руб. Я заплатил эту цену; посчитай выручку.',
    'Wheat: 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB. This is what I paid; calculate revenue.',
    '小麦100吨，价格12000卢布/吨。运输费80000卢布。这是采购价，计算净收入。',
    'Выручка: страховка 100 тонн по 12000 руб/т. Доставка 80000 руб.',
    '计算净收入：仓储100吨，价格12000卢布/吨。运输费80000卢布。',
    'Выручка: 100 тонн по 12000 руб/т. За каждый рейс доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 руб/т. Доставка 80000 руб., за каждый рейс.',
    'Выручка: 100 тонн по 12000 руб/т. Ежемесячная доставка 80000 руб.',
    'Выручка: 100 тонн по 12000 руб/т. За один рейс доставка 80000 руб.',
    'Revenue: 100 tonnes at 12000 RUB/tonne. Each trip: delivery 80000 RUB.',
    'Revenue: 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB, each trip.',
    'Revenue: 100 tonnes at 12000 RUB/tonne. Delivery 80000 RUB. Per trip.',
    'Revenue: 100 tonnes at 12000 RUB/tonne. Monthly delivery 80000 RUB.',
    '计算净收入：小麦100吨，价格12000卢布/吨。每趟运输费80000卢布。',
    '计算净收入：小麦100吨，价格12000卢布/吨。运输费80000卢布，每趟。',
  ])('does not infer or round ambiguous inputs: %s', (input) => {
    expect(saleProceedsFromUser(input)).toBeNull();
    expect(economicComparisonFor(input, [{ role: 'assistant', text: question }])).toBe('sale_proceeds');
    expect(economicComparisonCopy('sale_proceeds', 'en', null, null, saleProceedsFromUser(input))).toContain('Specify the quantity');
  });
  it('does not infer quantity or delivery from history and labels the limited result', () => {
    expect(economicComparisonFor('Посчитай выручку', [{ role: 'user', text: question }])).toBe('sale_proceeds');
    expect(economicComparisonCopy('sale_proceeds', 'ru', null, null, saleProceedsFromUser('Посчитай выручку'))).not.toContain('1120000');
    const copy = economicComparisonCopy('sale_proceeds', 'ru', null, null, saleProceedsFromUser(question));
    expect(copy).toContain('100 т × 12000 руб/т = 1200000 руб');
    expect(copy).toContain('1200000 − 80000 = 1120000 руб');
    expect(copy).toContain('а не прибыль');
    expect(copy).toContain('Текущая рыночная цена не проверялась');
  });
  it.each([
    'Как повысить выручку хозяйства, которое выращивает 100 тонн пшеницы?',
    'How can I increase revenue from 100 tonnes of wheat?',
    'What strategies can increase revenue from 100 tonnes of wheat?',
    'What are the revenue strategies for 100 tonnes of wheat?',
    'What would improve revenue from 100 tonnes of wheat?',
    'Какая стратегия увеличит выручку от 100 тонн пшеницы?',
    'How can I improve revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?',
    'What is revenue?',
    'What is the revenue definition?',
    'How much would the revenue improve from 100 tonnes of wheat?',
    'How much can I increase revenue from 100 tonnes of wheat?',
    'How much is the revenue definition useful for farmers?',
    'What could revenue recognition mean for farmers?',
    'What should revenue recognition principles require?',
    "What might your revenue be recognized as under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What does their revenue recognition principle require for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "How much could their proceeds improve from selling 100 tonnes?",
    "What is this revenue definition for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Can revenue, from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB, be recognized under IFRS?",
    "Как следует учитывать выручку, полученную от 100 тонн по 12000 руб/т с доставкой 80000 руб, по МСФО?",
    "Can revenue; from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB; be recognized under IFRS?",
    "Can revenue—generated from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB—be recognized under IFRS?",
    "Как следует учитывать выручку(полученную от 100 тонн по 12000 руб/т с доставкой 80000 руб)по МСФО?",
    "Can revenue: from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB be recognized under IFRS?",
    "Can revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB be recognized under IFRS?",
    "Is revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB recognized under IFRS?",
    "Как следует учитывать выручку от 100 тонн по 12000 руб/т с доставкой 80000 руб по МСФО?",
    "Can revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB be recognized as income?",
    "Is revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB recognized as income?",
    "Как следует учитывать выручку от 100 тонн по 12000 руб/т с доставкой 80000 руб?",
    "How should revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB be recorded under IFRS?",
    "Why is revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB recognized as income?",
    "Under IFRS, how should revenue from 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB be recognized?",
    "How should revenue be accounted for under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "How is revenue recognized under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Under IFRS, what should revenue be accounted for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Explain how revenue is measured under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Should revenue be accounted for under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Under IFRS, what could revenue be disclosed as for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "How should our proceeds be measured for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "Explain how revenue can be valued for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What is revenue recognized as under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "How can revenue recognition principles apply to 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be accounted for under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be measured under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be disclosed under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be valued under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be reconciled under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be interpreted under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be allocated under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be documented under IFRS for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What should revenue be recognized as under IFRS?",
    "What would proceeds be called in accounting?",
    "What can revenue be used for?",
    "What should the revenue be recognized as for 100 tonnes at 12000 RUB/tonne with delivery 80000 RUB?",
    "What would our proceeds be called in accounting for 100 tonnes?",
    "What can total revenue be used for on a farm selling 100 tonnes?",
    "What should revenue be defined as?",
    "What can revenue be classified as under IFRS?",
    "What would revenue be from crop diversification?",
    "What should revenue be for accounting purposes?",
    "What's revenue?",
    'What is total revenue?',
    'What are proceeds?',
    'What is the revenue after tax definition?',
    'What is the revenue for accounting purposes?',
    'What is the revenue from crop diversification?',
    'What is the revenue for 100 tonnes for accounting purposes?',
    'What is the revenue from crop diversification for 100 tonnes?',
    '出售100吨小麦的收入的定义是多少？',
    'What is the revenue recognition principle?',
    'Revenue recognition principle for 100 tonnes of wheat?',
    'Revenue from crop diversification?',
    '如何提高100吨小麦的总收入？',
    '总收入的定义是什么？',
    '如何提高销售收入和总收入？',
    '总收入的含义是多少？',
    '销售收入的含义是多少？',
    '净收入的会计含义是多少？',
    '总收入的意思是多少？',
    '总收入的释义是多少？',
    '总收入的定义是多少？',
    '销售收入的定义是多少？',
    '净收入的会计定义是多少？',
    '总收入的确认原则是多少？',
    '小麦100吨，总收入的定义是多少？',
    'Revenue after tax definition?',
    'Net proceeds from crop rotation benefits?',
    'Выручка считается доходом?',
    'Какая выручка считается доходом?',
    'Каков размер выручки по определению бухгалтерского учёта?',

    '如何提高100吨小麦的销售收入？',
    'Как рассчитать выручку хозяйства?',
    'How do I calculate revenue?',
    '怎么计算净收入？',
    'Как отразить выручку в документе бухгалтерского учёта?',
  ])('retains model handling of conceptual/contextual revenue questions: %s', (input) => {
    expect(economicComparisonFor(input, [])).not.toBe('sale_proceeds');
  });
  it.each([
    'Gross revenue is one million two hundred thousand; proceeds after delivery are nine hundred thousand. ',
    'Выручка — миллион двести тысяч; после доставки остаётся девятьсот тысяч. ',
    '销售收入为一百二十万，扣除运输费后为九十万。',
    'Остаётся девятьсот тысяч. ',
  ].flatMap((claim) => [1, 2, 7, 500].map((size) => [claim, size] as const)))('does not publish model sale arithmetic in words: %s, chunk %i', (claim, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'ru', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const flags: string[] = [];
    for (let index = 0; index < claim.length; index += size) flags.push(...gate.push(claim.slice(index, index + size)).flags);
    flags.push(...gate.flush().flags);
    expect(gate.emitted).toBe('');
    expect(flags).toContain('UNVERIFIED_ECONOMIC_CLAIM_REMOVED');
  });
  it.each([1, 7, 511, 5000])('discards long boundary-free sale prose with bounded safety state, chunk %i', (size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'ru', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = 'Harmless'.repeat(2000);
    for (let index = 0; index < prose.length; index += size) {
      expect(gate.push(prose.slice(index, index + size)).violation).toBeNull();
      expect(gate.withheld.length <= 3000).toBe(true);
    }
    expect(gate.flush().violation).toBeNull();
    expect(gate.emitted).toBe('');
  });
  it.each([
    ['I transferred money', 'WRITE_CLAIM'],
    ['Bearer ' + ' '.repeat(5000) + 'abcdefghijklmnop12345', 'SECRET'],
    ['sk-proj-abcdefghijklmnop12345', 'SECRET'],
    ['sk-proj-**' + 'a'.repeat(700) + '**', 'SECRET'],
    ['sk-' + '_'.repeat(40), 'SECRET'],
    ['Bearer <tag ' + 'x'.repeat(500) + '>abcdefghijklmnop12345', 'SECRET'],
  ].flatMap(([claim, violation]) => [1, 7, 511, 5000].map((size) => [claim, violation, size] as const)))('checks late and split safety claims in discarded sale prose: %s, chunk %i', (claim, violation, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = 'Harmless '.repeat(1600) + claim + ' ';
    for (let index = 0; index < prose.length; index += size) gate.push(prose.slice(index, index + size));
    gate.flush();
    expect(gate.violation).toBe(violation);
    expect(gate.emitted).toBe('');
  });
  it('keeps prescription removal evidence for split discarded sale prose', () => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = 'Harmless '.repeat(500) + 'Use fungicide at 2 l/ha';
    const flags: string[] = [];
    for (const character of prose) flags.push(...gate.push(character).flags);
    flags.push(...gate.flush().flags);
    expect(gate.violation).toBeNull();
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(gate.emitted).toBe('');
  });
  it.each([
    ['<think>I transferred money</think>', 'WRITE_CLAIM'],
    ["I trans<!--" + 'x'.repeat(5000) + "--!>ferred money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<!--" + 'x'.repeat(5000) + "--!>ijklmnop12345", "SECRET"],
    ["I trans<!--" + 'x'.repeat(5000) + "--!>&#102;erred money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<!--" + 'x'.repeat(5000) + "--!>&#105;jklmnop12345", "SECRET"],
    ["I trans<!foo data='" + 'x'.repeat(5000) + ">ferred money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<!foo data='" + 'x'.repeat(5000) + ">ijklmnop12345", "SECRET"],
    ["I trans<?foo data='" + 'x'.repeat(5000) + ">ferred money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<?foo data='" + 'x'.repeat(5000) + ">ijklmnop12345", "SECRET"],
    ["I trans<em data=&quot;" + 'x'.repeat(5000) + ">ferred</em> money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<em data=&#39;" + 'x'.repeat(5000) + ">ijklmnop</em>12345", "SECRET"],
    ["I trans<em data=&quot;" + 'x'.repeat(5000) + ">&#102;erred</em> money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<em data=&#39;" + 'x'.repeat(5000) + ">&#105;jklmnop</em>12345", "SECRET"],
    ["I trans<em data=a'" + 'x'.repeat(5000) + ">ferred</em> money", "WRITE_CLAIM"],
    ["I trans<em data=a\"" + 'x'.repeat(5000) + ">ferred</em> money", "WRITE_CLAIM"],
    ["Bearer abcdefgh<em data=a'" + 'x'.repeat(5000) + ">ijklmnop</em>12345", "SECRET"],
    ["Bearer abcdefgh<em data=a\"" + 'x'.repeat(5000) + ">ijklmnop</em>12345", "SECRET"],
    ["I trans<em data=a'" + 'x'.repeat(5000) + " data-next=\"safe > safe\">ferred</em> money", "WRITE_CLAIM"],
    ["I trans<em a\"=" + 'x'.repeat(5000) + ">ferred</em> money", "WRITE_CLAIM"],
    ["I trans<em data=a&#39;" + 'x'.repeat(5000) + ">ferred</em> money", "WRITE_CLAIM"],
    ["I trans~~ferred~~ money", "WRITE_CLAIM"],
    ["<think>I trans~~ferred~~ money</think>", "WRITE_CLAIM"],
    ["<think title=\"I trans~~ferred~~ money\">harmless</think>", "WRITE_CLAIM"],
    ["I trans&#126;&#126;ferred&#126;&#126; money", "WRITE_CLAIM"],
    ["<think title=\"I trans<em>[~~fer~~](https://example.invalid/" + 'x'.repeat(5000) + ")</em>red money\">harmless</think>", "WRITE_CLAIM"],
    ["Bearer abcd~efgh~ijklmn", "SECRET"],
    ["Bearer abcd~~efgh~~ijklmnop", "SECRET"],
    ['I\uFEFFtransferred money', 'WRITE_CLAIM'],
    ['Bearer\uFEFFabcdefghijklmnop12345', 'SECRET'],
    ['Bearer\uFEFF' + '\u200B'.repeat(5000) + 'abcdefghijklmnop12345', 'SECRET'],
    ['Bearer&#xFEFF;' + '&#x200B;'.repeat(500) + 'abcdefghijklmnop12345', 'SECRET'],
    ['Bearer\uFEFF' + '\u200B'.repeat(5000) + 'abcdefgh\uFEFFijklmnop12345', 'SECRET'],
    ['sk-' + 'a'.repeat(5) + '-Bearer\uFEFF' + 'b'.repeat(40), 'SECRET'],
    ['<think title="I\uFEFFtrans<em title=\u0027' + 'x'.repeat(5000) + '\u0027>*fer*</em>red money">harmless</think>', 'WRITE_CLAIM'],
    ['<think I trans**ferred** money', 'WRITE_CLAIM'],
    ['<think>I trans*ferred* money</think>', 'WRITE_CLAIM'],
    ['<think>I trans<em>ferred</em> money</think>', 'WRITE_CLAIM'],
    ['I trans&#x66;erred money', 'WRITE_CLAIM'],
    ['I trans&lt;em&gt;ferred&lt;/em&gt; money', 'WRITE_CLAIM'],
    ['Bearer abcdefgh&lt;em&gt;ijklmnop&lt;/em&gt;12345', 'SECRET'],
    ['I trans&#60;em&#62;&#42;ferred&#42;&#60;/em&#62; money', 'WRITE_CLAIM'],
    ['sk-&#95;&lt;em&gt;' + '&#95;'.repeat(39) + '&lt;/em&gt;', 'SECRET'],
    ['I trans<em title="a > b">ferred</em> money', 'WRITE_CLAIM'],
    ['I trans[ferred](https://example.invalid/' + 'x'.repeat(5000) + ') money', 'WRITE_CLAIM'],
    ['<think title="I trans<em>[fer](https://example.invalid/' + 'x'.repeat(5000) + ')</em>red money">harmless</think>', 'WRITE_CLAIM'],
    ['<think title="Bearer abcdefgh<em>[ijklmnop](https://example.invalid/' + 'x'.repeat(5000) + ')</em>12345">harmless</think>', 'SECRET'],
    ["I trans[fer](https://example.invalid/o'reilly/" + 'x'.repeat(5000) + ')red money', 'WRITE_CLAIM'],
    ['I trans[fer](https://example.invalid/escaped\\)/' + 'x'.repeat(5000) + ')red money', 'WRITE_CLAIM'],
    ['Bearer abcdefgh[ijklmnop](https://example.invalid/escaped\\)/' + 'x'.repeat(5000) + ')12345', 'SECRET'],
    ["Bearer abcdefgh[ijklmnop](https://example.invalid/o'reilly/" + 'x'.repeat(5000) + ')12345', 'SECRET'],
    ['I trans[fer](https://example.invalid/' + 'x'.repeat(5000) + ' "a ) title")red money', 'WRITE_CLAIM'],
    ["I trans[fer](<https://example.invalid/o'reilly/" + 'x'.repeat(5000) + '>)red money', 'WRITE_CLAIM'],
    ['I trans[fer](<https://example.invalid/a)/' + 'x'.repeat(5000) + '>)red money', 'WRITE_CLAIM'],
    ['<think title="I trans<em title=\u0027' + 'x'.repeat(5000) + '\u0027>fer</em>red money">harmless</think>', 'WRITE_CLAIM'],
    ['<think title="Bearer abcdefgh<em title=\u0027' + 'x'.repeat(5000) + '\u0027>ijklmnop</em>12345">harmless</think>', 'SECRET'],
    ['<think title="<em title=\u0027I trans<strong title=\u0022' + 'x'.repeat(5000) + '\u0022>fer</strong>red money\u0027>">harmless</think>', 'WRITE_CLAIM'],
    ['<think title="<em title=\u0027Bearer abcdefgh<strong title=\u0022' + 'x'.repeat(5000) + '\u0022>ijklmnop</strong>12345\u0027>">harmless</think>', 'SECRET'],
    ['<think title="I trans<em>ferred</em> money">harmless</think>', 'WRITE_CLAIM'],
    ['<think title="Bearer abcdefgh<em>ijklmnop</em>12345">harmless</think>', 'SECRET'],
    ['Bearer abcdefgh[ijklmnop](https://example.invalid/' + 'x'.repeat(5000) + ')12345', 'SECRET'],
    ['I trans&lt;!-- \u0027 > --&gt;ferred money', 'WRITE_CLAIM'],
    ['Bearer abcdefgh<!-- \u0027 > -->ijklmnop12345', 'SECRET'],
    ['Bearer abcdefgh<em title="a > b">ijklmnop</em>12345', 'SECRET'],
    ['<think I trans&#102;erred money', 'WRITE_CLAIM'],
    ['<think Bearer abcdefgh&#105;jklmnop12345', 'SECRET'],
    ['Bearer abcdefgh&#x69;jklmnop12345', 'SECRET'],
    ['I trans&#102;erred money', 'WRITE_CLAIM'],
    ['I trans&#102erred money', 'WRITE_CLAIM'],
    ['Bearer&nbsp;abcdefghijklmnop12345', 'SECRET'],
    ['Bearer&Tab;abcdefghijklmnop12345', 'SECRET'],
    ['sk-' + '&#95;'.repeat(40), 'SECRET'],
    ['I trans&#42;ferred&#42; money', 'WRITE_CLAIM'],
    ['&yacy; перевёл деньги', 'WRITE_CLAIM'],
    ['I trans&#x' + '0'.repeat(5000) + '66;erred money', 'WRITE_CLAIM'],
    ['<think>Bearer abcdefgh<em>ijklmnop</em>12345</think>', 'SECRET'],
    ['I trans<em title="' + 'x'.repeat(5000) + '">ferred</em> money', 'WRITE_CLAIM'],
    ['Bearer abcdefgh<em title="' + 'x'.repeat(5000) + '">ijklmnop</em>12345', 'SECRET'],
    ['<think>I trans_ferred_ money</think>', 'WRITE_CLAIM'],
    ['<think>Bearer abcdefgh*ijklmnop*12345</think>', 'SECRET'],
    ['<think>Bearer abcdefgh_ijklmnop_12345</think>', 'SECRET'],
    ['<think I trans*ferred* money', 'WRITE_CLAIM'],
    ['<think Bearer abcdefgh*ijklmnop*12345', 'SECRET'],
    ['<think Bearer **abcdefghijklmnop12345**', 'SECRET'],

    ['<analysis>Bearer abcdefghijklmnop12345</analysis>', 'SECRET'],
    ['I <tag ' + 'x'.repeat(5000) + '>transferred money', 'WRITE_CLAIM'],
  ].flatMap(([claim, violation]) => [1, 7, 511, 5000].map((size) => [claim, violation, size] as const)))('validates original trace/markup contents before discard: %s, chunk %i', (claim, violation, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    for (let index = 0; index < claim.length; index += size) gate.push(claim.slice(index, index + size));
    gate.flush();
    expect(gate.violation).toBe(violation);
    expect(gate.emitted).toBe('');
  });

  it.each([
    ['I trans[fer][' + 'r'.repeat(321) + ']red money\n\n[' + 'r'.repeat(321) + ']: https://example.invalid/', 'WRITE_CLAIM'],
    ['Bearer abcdefgh[ijklmnop][' + 'r'.repeat(321) + ']12345\n\n[' + 'r'.repeat(321) + ']: https://example.invalid/', 'SECRET'],
    ['I trans[fer][' + 'r'.repeat(900) + ']red money\n\n[' + 'r'.repeat(900) + ']: https://example.invalid/', 'WRITE_CLAIM'],
    ['Bearer abcdefgh[ijklmnop][' + 'r'.repeat(900) + ']12345\n\n[' + 'r'.repeat(900) + ']: https://example.invalid/', 'SECRET'],
    ['<think title="I trans<em>[fer][' + 'r'.repeat(321) + ']</em>red money">harmless</think>\n\n[' + 'r'.repeat(321) + ']: https://example.invalid/', 'WRITE_CLAIM'],
    ['<think title="Bearer abcdefgh<em>[ijklmnop][' + 'r'.repeat(321) + ']</em>12345">harmless</think>\n\n[' + 'r'.repeat(321) + ']: https://example.invalid/', 'SECRET'],
    ['I trans[fer][' + 'r'.repeat(321) + '\\]r]red money\n\n[' + 'r'.repeat(321) + '\\]r]: https://example.invalid/', 'WRITE_CLAIM'],
    ['Bearer abcdefgh[ijklmnop][' + 'r'.repeat(321) + '\\]r]12345\n\n[' + 'r'.repeat(321) + '\\]r]: https://example.invalid/', 'SECRET'],
  ].flatMap(([claim, violation]) => [1, 7, 511, 5000].map((size) => [claim, violation, size] as const)))('checks long reference-style Markdown labels in sale prose: %s, chunk %i', (claim, violation, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    for (let index = 0; index < claim.length; index += size) gate.push(claim.slice(index, index + size));
    gate.flush();
    expect(gate.violation).toBe(violation);
    expect(gate.emitted).toBe('');
  });
  it.each([
    '&#x200B;', '&#8203;', '\u200B', '\u200C', '\u2060',
    '&#x00AD;', '&#x202E;', '&#xE0001;', '\u{E0001}',
    '&ZeroWidthSpace;', '&shy;', '&#x034F;', '\uFE0F',
  ].flatMap((invisible) => [
    ['I trans' + invisible + 'ferred money', 'WRITE_CLAIM'],
    ['Bearer abcdefgh' + invisible + 'ijklmnop12345', 'SECRET'],
  ].flatMap(([claim, violation]) => [1, 7, 511, 5000].map((size) => [claim, violation, size] as const))))('rejects invisible token splitting in discarded sale prose: %s, chunk %i', (claim, violation, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    for (let index = 0; index < claim.length; index += size) gate.push(claim.slice(index, index + size));
    gate.flush();
    expect(gate.violation).toBe(violation);
    expect(gate.emitted).toBe('');
  });
  it.each([1, 7, 511, 5000])('does not repeatedly decode literal escaped character references, chunk %i', (size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = 'I trans&amp;#102;erred money';
    for (let index = 0; index < prose.length; index += size) gate.push(prose.slice(index, index + size));
    expect(gate.flush().violation).toBeNull();
    expect(gate.violation).toBeNull();
    expect(gate.emitted).toBe('');
  });
  it.each([1, 7, 511, 5000])('decodes a trailing semicolonless reference at flush, chunk %i', (size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = 'Bearer abcdefghijklmno&#112';
    for (let index = 0; index < prose.length; index += size) gate.push(prose.slice(index, index + size));
    expect(gate.flush().violation).toBe('SECRET');
    expect(gate.emitted).toBe('');
  });
  it.each(['<think>', '```analysis\n', '{"analysis":"', '<tag '].flatMap((prefix) => [1, 7, 511, 5000].map((size) => [prefix, size] as const)))('discards long unclosed constructs without holding their contents: %s, chunk %i', (prefix, size) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'en', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    const prose = prefix + 'Harmless'.repeat(2000);
    for (let index = 0; index < prose.length; index += size) {
      expect(gate.push(prose.slice(index, index + size)).violation).toBeNull();
      expect(gate.withheld.length <= 3000).toBe(true);
    }
    expect(gate.flush().violation).toBeNull();
    expect(gate.emitted).toBe('');
  });
  it('retains qualitative model commentary for existing non-sale comparisons', () => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'ru', currentDataRequired: false, grounding, economicComparison: 'storage' });
    gate.push('Проверьте условия приёмки. ');
    gate.flush();
    expect(gate.emitted).toContain('Проверьте условия приёмки');
  });
  it.each([
    ['Я перевёл деньги за хранение. ', 'WRITE_CLAIM'],
    ['Используйте ключ sk-proj-abcdefghijklmnop12345. ', 'SECRET'],
  ] as const)('retains fail-closed action/secret validation before sale prose suppression: %s', (text, violation) => {
    const gate = new StreamingAnswerGate({ answerMode: 'general_agro', locale: 'ru', currentDataRequired: false, grounding, economicComparison: 'sale_proceeds' });
    expect(gate.push(text).violation).toBe(violation);
    expect(gate.emitted).toBe('');
  });
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

describe('storage intent corrections', () => {
  it.each([
    'Уточнение: отгрузка обоим покупателям сразу, хранить зерно 30 дней не нужно. Пересмотри риски отсрочки оплаты, не добавляя расходов на хранение.',
    'Хранение не нужно. Сравни расходы при отсрочке оплаты.',
    'Не включай стоимость хранения при сравнении отсрочки оплаты.',
    'Не добавляй расходы на хранение. Отгрузка покупателю сразу.',
    'Без хранения: сравни цену при оплате сразу и через 30 дней.',
    'Расходы на хранение не учитывай; сравни условия оплаты.',
    'Storage is not needed; compare payment costs.',
    'No storage costs; compare the payment deferral risk.',
    "Don't include storage costs; shipment is immediate. What are the payment risks?",
    'No need to store grain; compare the price of deferred payment.',
    'Storage is not required; compare the price of deferred payment.',
    '不需要储存粮食。比较延期付款的成本。',
    '无需仓储；比较付款风险和成本。',
    '不要计入仓储费用，只比较延期付款的风险和成本。',
    '仓储不需要，比较延期付款的成本。',
    "We don't need storage; compare payment costs.",
    "We don't need to store grain; compare payment costs.",
    'We do not need to store grain; compare payment costs.',
    'Без хранения есть возможность рассчитать прибыль. Сравни расходы.',
    'Without storage costs, there is a way to calculate profit. Compare costs.',
    'Without storage, there is no possibility of extra expense; compare payment costs.',
    'Без хранения нет возможности понести дополнительные расходы; сравни условия оплаты.',
    'We do not require storage; compare payment costs.',
    'Compare payment costs assuming no storage.',
    'Compare payment costs assuming no storage is needed.',
    'Compare payment costs assuming no storage for this deal.',
    'Compare payment costs assuming no storage is needed for this deal.',
    'Compare payment costs assuming no storage is required for the shipment.',
    'Not excluding storage costs was a mistake; compare payment costs.',
    'We discussed storage yesterday. Exclude storage costs and compare payment costs.',
    'We discussed storage yesterday and now exclude storage costs; compare payment costs.',
    'Исключи расходы на хранение; сравни условия оплаты.',
    'Исключи из расчёта расходы на хранение; сравни расходы по оплате.',
    'Исключите из сметы стоимость хранения; сравните условия оплаты.',
    'Исключите стоимость хранения; сравните условия оплаты.',
    'Compare payment costs assuming no storage is required.',
    'Compare payment costs assuming no storage for the shipment.',
    'Compare payment costs excluding storage.',
    'Compare payment costs omitting storage costs.',
    'Нам не нужно хранение; сравни расходы при отсрочке оплаты.',
    'Нам не требуется хранение; сравни расходы при отсрочке оплаты.',
  ])('does not calculate an explicitly excluded storage topic: %s', (question) => {
    const history = [
      { role: 'user' as const, text: 'Хранение стоит 100 руб/т в месяц. Срок два месяца.' },
      { role: 'assistant' as const, text: 'Нужно покрыть расходы на хранение.' },
    ];
    expect(economicComparisonFor(question, history)).toBe('qualitative');
    const gate = generalGate({ economicComparison: economicComparisonFor(question, history) });
    gate.push('Проверьте платёжеспособность покупателя и условия отсрочки.');
    gate.flush();
    expect(gate.emitted).not.toContain('Для покрытия только хранения');
  });

  it.each([
    'Сколько должна вырасти цена, чтобы покрыть хранение два месяца по 100 руб/т в месяц?',
    'Не нужно продавать сразу. Сколько стоит хранение три месяца?',
    'Хранение не нужно для А. Но Б хранит три месяца. Сравни расходы.',
    'Хранение не нужно, но если хранить два месяца по 100 руб/т в месяц, какой нужен рост цены?',
    'Не исключайте расходы на хранение: сколько должна вырасти цена?',
    'Storage is not needed for A, but B stores for three months. Compare prices.',
    'Do not ignore storage costs. How much should the price rise?',
    'No storage is needed today. However if storing for two months, what price rise covers the cost?',
    '无需仓储，但如果储存两个月，每月每吨100卢布，需要涨价多少才能覆盖仓储成本？',
    '不要忽略仓储成本，需要涨价多少？',
    'Хранение не нужно для А, для Б хранить зерно три месяца. Сравни расходы.',
    'No storage for A, B stores grain for three months. Compare costs.',
    '无需仓储用于A，B储存粮食三个月。比较成本。',
    'Хранение не нужно исключать. Сравни расходы.',
    'Storage is not needed to exclude other costs. Compare storage costs.',
    '无需忽略仓储成本，需要涨价多少？',
    'Storage for A costs 100 and storage for B is not needed. Compare costs.',
    'Storage for A is needed and storage for B is not required. Compare costs.',
    'Хранение А стоит 100 и хранение Б не нужно. Сравни расходы.',
    'Хранение А нужно и хранение Б не требуется. Сравни расходы.',
    '仓储A成本100而仓储B不需要。比较成本。',
    '仓储A成本100而仓储B无需安排。比较成本。',
    'We cannot ship without storage; compare costs.',
    'No storage option is cheap; compare costs.',
    'We cannot avoid storage; compare costs.',
    'No storage costs are negligible; compare costs.',
    'Без хранения нельзя отгрузить зерно. Сравни расходы.',
    'Без расходов на хранение нельзя рассчитать прибыль. Сравни расходы.',
    'Без расходов на хранение невозможно рассчитать прибыль. Сравни расходы.',
    'Без расходов на хранение прибыль рассчитать не получится. Сравни расходы.',
    'Without storage costs, profit cannot be calculated. Compare costs.',
    'Without storage, shipping is impossible. Compare costs.',
    'Без хранения нет возможности рассчитать прибыль. Сравни расходы.',
    'Without storage costs, there is no way to calculate profit. Compare costs.',
    'Without storage, there is no possibility of shipping grain. Compare costs.',
    'Compare costs without excluding storage.',
    "Don't exclude storage costs; compare payment costs.",
    'Compare payment costs assuming no storage option is cheap.',
    'Never exclude storage costs; compare costs.',
    'Never ignore storage costs; compare costs.',
    'Compare payment costs assuming no storage for this deal is cheap.',
    'Compare storage costs; no storage is needed to exclude delivery costs.',
  ])('keeps actual or hypothetical storage comparisons screened: %s', (question) => {
    expect(economicComparisonFor(question, [])).toBe('storage');
  });

  it.each([
    ['Хранение не требуется; сравни расходы по оплате.', 'Срок один месяц.'],
    ['No storage costs; compare payment prices.', 'The payment duration is one month.'],
    ['无需仓储，比较延期付款的成本。', '期限是一个月。'],
  ])('does not resurrect an excluded topic from user history: %s', (previous, question) => {
    expect(economicComparisonFor(question, [{ role: 'user', text: previous }])).toBe('qualitative');
  });

  it('preserves supported same-turn payment arithmetic before storage exclusion', () => {
    const question = '12000 руб/т с оплатой сегодня или 12400 руб/т через 30 дней. Хранение не нужно.';
    expect(economicComparisonFor(question, [])).toBe('payment_timing');
    expect(paymentTimingFromUser(question)?.premiumMinor).toBe(40000);
    expect(paymentTimingFromUser(question)?.delayDays).toBe(30);
  });

  it('preserves freight comparison priority when storage is excluded', () => {
    expect(economicComparisonFor('Без хранения. Сравни тариф перевозчика за рейс и за тонну.', [])).toBe('transport');
  });

  it('preserves history-based actual storage follow-up', () => {
    expect(economicComparisonFor('А срок три месяца?', [{ role: 'user', text: 'Сколько стоят расходы на хранение?' }])).toBe('storage');
  });

  it('keeps a non-economic excluded-storage question outside the monetary screen', () => {
    expect(economicComparisonFor('Хранение не нужно. Как проверить всхожесть зерна?', [])).toBeNull();
  });

  it.each([
    ['Storage is not needed; compare payment costs.', 'Actually, what if we store it for one month?'],
    ['Хранение не нужно. Сравни расходы при отсрочке оплаты.', 'А если хранить зерно один месяц?'],
    ['无需仓储；比较付款风险和成本。', '如果储存一个月呢？'],
  ])('lets newly reintroduced storage override its historical exclusion: %s', (previous, question) => {
    expect(economicComparisonFor(question, [{ role: 'user', text: previous }])).toBe('storage');
  });

  it.each([
    'Do not mention storage again. The payment duration is one month.',
    "Don't discuss storage again. The payment duration is one month.",
    'Your previous answer mentioned storage. The payment duration is one month.',
    'You said to store the grain. I asked about payment duration: one month.',
    'Do not mention storage costs again; compare payment costs for one month.',
    'Не упоминай хранение снова. Срок оплаты один месяц.',
    'Не обсуждай хранение. Срок оплаты один месяц.',
    'Не говори о хранении снова. Срок оплаты один месяц.',
    'Earlier we talked about storage for one month. The payment duration is one month.',
    'Ты говорил про хранение. Срок оплаты один месяц.',
    'Ты предложил хранить зерно. Вопрос про срок оплаты: один месяц.',
    'Ранее я говорил о хранении один месяц. Сейчас вопрос про срок оплаты: один месяц.',
    'Раньше мы обсуждали хранение один месяц. Сейчас вопрос про срок оплаты: один месяц.',
    'I previously said to store grain for one month. The payment duration is one month.',
    '不要再提仓储。付款期限是一个月。',
    '不要讨论储存。付款期限是一个月。',
    '你之前的回答提到仓储。付款期限是一个月。',
    '你说储存粮食，但问题是付款期限一个月。',
    '我之前说过储存一个月。现在问题是付款期限一个月。',
    'I discussed storage with my manager and now need its cost excluded.',
    'I discussed storage with my manager and now need its cost to be omitted.',
    'I discussed storage with my manager and now need its cost to not be included.',
    'I discussed storage with my manager and now need its cost not to be included.',
    'I discussed storage with my manager and now need its cost not to be counted.',
    'I discussed storage with my manager and now need its cost to not be counted.',
    'Я обсуждал хранение и теперь мне нужна его стоимость исключённой из сравнения.',
    '我之前说过储存，现在需要它的成本不计入比较。',
  ])('does not treat a negative or historical storage reference as renewed intent: %s', (question) => {
    const history = [{ role: 'user' as const, text: 'Storage is not needed; compare payment costs.' }];
    expect(economicComparisonFor(question, history)).toBe('qualitative');
    const gate = generalGate({ economicComparison: economicComparisonFor(question, history) });
    gate.push('Choose deferred payment: profit will be 400 RUB per tonne.');
    gate.flush();
    expect(gate.emitted).not.toContain('400');
  });

  it.each([
    'What about storage for one month?',
    'Storage is required; the duration is one month.',
    'А если хранение один месяц?',
    'Хранение нужно; срок один месяц.',
    '如果仓储一个月呢？',
    '需要仓储；期限是一个月。',
    'Do not mention storage for A, but B stores for one month. Compare costs.',
    'Do not mention storage for A, B stores for one month. Compare costs.',
    'Не упоминай хранение для А, для Б нужно хранить зерно один месяц. Сравни расходы.',
    '需要仓储一个月，而之前的回答提到的是付款期限。',
    'Нужно хранить зерно один месяц по договору. Сравни расходы.',
    'Say we store it for one month. What would it cost?',
    "Let's talk about storage for one month. What would it cost?",
    "Let's discuss storage for one month. What would it cost?",
    'Скажем, хранить зерно один месяц. Сравни расходы.',
    'Я планирую хранить зерно один месяц. Сравни расходы.',
    'I would store grain for one month. What would it cost?',
    '我考虑储存一个月。比较成本。',
    'Ранее я говорил о хранении один месяц, но если хранить два месяца, какие расходы?',
    'I discussed storage with my manager and now need its cost for one month.',
    'Я обсуждал хранение с руководителем и теперь мне нужна его стоимость за один месяц.',
    '我之前说过储存，现在需要它的成本，期限一个月。',
    'I discussed storage with my manager and now need its cost; exclude delivery costs.',
  ])('recognizes affirmative renewed storage while retaining mixed-clause protection: %s', (question) => {
    const history = [{ role: 'user' as const, text: 'Storage is not needed; compare payment costs.' }];
    expect(economicComparisonFor(question, history)).toBe('storage');
  });

  it('retains economic screening for a duration correction that currently excludes storage', () => {
    const question = 'Хранение не нужно. Срок два месяца.';
    const history = [{ role: 'user' as const, text: 'Сколько стоят расходы на хранение?' }];
    const gate = generalGate({ economicComparison: economicComparisonFor(question, history) });
    gate.push('Выбирайте отсрочку оплаты: прибыль составит 400 руб/т.');
    gate.flush();
    expect(gate.emitted).not.toContain('400');
    expect(economicComparisonFor(question, history)).toBe('qualitative');
  });

  it.each([
    'Составь короткий чек-лист подготовки зернохранилища к загрузке новой партии: что осмотреть, проверить и записать? Не нужны препараты и нормы расхода.',
    'Как подготовить зернохранилище? Не указывай нормы расхода препаратов.',
    'Как подготовить зернохранилище? Без норм расхода препаратов.',
    'Как подготовить зернохранилище? Не говори о норме расхода препаратов.',
    'Подготовь зернохранилище без таблицы с нормами расхода препаратов.',
    'При подготовке зернохранилища не указывай норму расхода препаратов.',
    'Оцените состояние зернохранилища перед загрузкой.',
    'Как проверить трубы вентиляции зернохранилища?',
    'Как оценить влажность зерна при хранении?',
    'Какой процент всхожести останется после хранения зерна?',
    'Какой процент влажности допустим при хранении зерна?',
    'What percentage of seeds germinate after storage?',
    'What application rate is used for grain storage pests?',
    '粮食储存时的含水率是多少？',
    '储存后种子的发芽率是多少？',
    'Какой сорт лучше выбрать для отсроченного посева?',
    'Which herbicide is better for deferred application?',
  ])('does not attach a financial comparison to application-rate exclusions: %s', (question) => {
    expect(economicComparisonFor(question, [])).toBeNull();
  });

  it.each([
    'Storage is not needed. Compare payment terms.',
    'Storage costs should not be included; compare payment terms.',
    'Storage costs are excluded; compare payment terms.',
    'Storage costs were excluded; compare payment terms.',
    'Storage costs have been excluded; compare payment terms.',
    'Storage costs had been excluded; compare payment terms.',
    'Расходы на хранение были исключены; сравни условия оплаты.',
    'Стоимость хранения исключена; сравни условия оплаты.',
    'Расходы на хранение не должны включаться; сравни условия оплаты.',
    'Хранение не нужно. Что выбрать: оплату сейчас или с отсрочкой?',
  ])('screens excluded-storage payment choice without a price cue: %s', (question) => {
    expect(economicComparisonFor(question, [])).toBe('qualitative');
  });

  it.each([
    'Не исключи расходы на хранение; сравни расходы.',
    'Не исключите из сметы стоимость хранения',
    'Storage costs should not be excluded; compare costs.',
    'Storage costs are not excluded; compare costs.',
    'Storage costs were not excluded; compare costs.',
    'Storage costs have not been excluded; compare costs.',
    'Расходы на хранение не были исключены; сравни расходы.',
    'Стоимость хранения не исключена; сравни расходы.',
    'Расходы на хранение не должны исключаться; сравни расходы.',
  ])('preserves Russian negative exclusion imperatives: %s', (question) => {
    expect(economicComparisonFor(question, [])).toBe('storage');
  });

  it('still screens financial costs alongside application-rate wording', () => {
    expect(economicComparisonFor('Какая стоимость хранения? Нормы расхода препаратов не нужны.', [])).toBe('storage');
  });

  it('does not mistake seed germination guarantees for payment selection', () => {
    expect(economicComparisonFor('Какой сорт с гарантированной всхожестью лучше выбрать?', [])).toBeNull();
  });

  it.each([
    'Оцените стоимость хранения зерна.',
    'Рассчитай себестоимость хранения зерна.',
    'Какой перерасход средств на хранение зерна?',
    'Рассчитай наценку после хранения зерна.',
    'Рассчитай уценку после хранения зерна.',
    'Какие расценки на хранение зерна?',
    'Какой процент окупит хранение зерна?',
    'Какой процент начисляют за хранение зерна?',
    'Какая процентная ставка за хранение зерна?',
    'Какая годовая процентная ставка за хранение зерна?',
    'Укажи ставку в процентах за хранение зерна.',
    'Какая ставка процента за хранение зерна?',
    'What annual interest rate is charged for grain storage?',
    'What monthly interest rate applies to storing grain?',
    '粮食仓储的年利率是多少？',
    '粮食仓储的月利率是多少？',
    'Какова себестоимость хранения за месяц?',
    'Расходы на хранение 200 рублей за тонну в месяц. Сравни цену.',
    'Сравни цены продажи зерна после хранения.',
    'Какова стоимость хранения? Без норм расхода препаратов.',
  ])('retains financial screening with word-bounded monetary terms: %s', (question) => {
    expect(economicComparisonFor(question, [])).toBe('storage');
  });

  it.each([
    ['ru', 'Хранение не нужно. Сравни расходы при отсрочке оплаты.', 'Выбирайте отсрочку оплаты: прибыль составит 400 руб/т.', 'Проверьте условия оплаты.'],
    ['en', 'Storage is not needed; compare payment costs.', 'Choose deferred payment: profit will be 400 RUB per tonne.', 'Check the buyer and payment terms.'],
    ['zh', '不需要储存粮食。比较延期付款的成本。', '选择延期付款，每吨可获利400卢布。', '核对交易对手和付款条件。'],
  ])('keeps economic screening and qualitative text without storage arithmetic: %s', (locale, question, unsupported, qualitative) => {
    for (const chunkSize of [1, 2, 7, 48, 500]) {
      const gate = generalGate({ locale: locale as 'ru' | 'en' | 'zh', economicComparison: economicComparisonFor(question, []) });
      const content = `${unsupported}\n\n${qualitative} `;
      for (let index = 0; index < content.length; index += chunkSize) {
        gate.push(content.slice(index, index + chunkSize));
        expect(gate.emitted).not.toContain('400');
      }
      gate.flush();
      expect(gate.emitted).not.toContain(unsupported);
      expect(gate.emitted).toContain(qualitative);
    }
  });
});

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

  it('does not confuse delivery wording with an interest-rate claim', () => {
    expect(economicBlockAllowed('Уточните условия доставки.')).toBe(true);
    expect(economicBlockAllowed('Сравните риск качества и условия доставки.')).toBe(true);
    expect(economicBlockAllowed('Ставка финансирования составляет 18%.')).toBe(false);
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

    expect(paymentTimingFromUser('Покупатель предлагает 12 000 руб/т с оплатой сегодня или 12 400 руб/т через 45 дней без банковской гарантии. Что выбрать?')).toEqual(payment);
    expect(paymentTimingFromUser('Покупатель предлагает 12\u202F000 руб/т с оплатой сегодня или 12\u202F400 руб/т через 45 дней без банковской гарантии. Что выбрать?')).toEqual(payment);

    const copy = economicComparisonCopy('payment_timing', 'ru', null, payment);
    expect(copy).toContain('400 руб/т');
    expect(copy).toContain('3,33%');
    expect(copy).toContain('45 дней');
    expect(copy).toContain('банковской гарантии нет');
    expect(copy).not.toMatch(/выбирайте|выберите|лучше\s+(?:перв|втор|сейчас|отсроч)/iu);

    const lowerPayment = paymentTimingFromUser('Покупатель предлагает 12400 руб/т с оплатой сегодня или 12000 руб/т через 45 дней. Что выбрать?');
    expect(lowerPayment).not.toBeNull();
    const lowerCopy = economicComparisonCopy('payment_timing', 'ru', null, lowerPayment);
    expect(lowerCopy).toContain('уменьшает цену на 400 руб/т');
    expect(lowerCopy).not.toContain('уменьшает 400 руб/т к цене');

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

  it('withholds a bare crop-protection product prefix until dose or interval safety is decidable', () => {
    const doseGate = generalGate();
    expect(doseGate.push('Фунгицид Альто Супер ' ).text).toBe('');
    const doseVerdict = doseGate.push('0,4 л/га. Сначала уточните регион и фазу культуры. ');
    doseGate.flush();
    expect(doseVerdict.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(doseGate.emitted).not.toContain('Альто Супер');
    expect(doseGate.emitted).not.toContain('0,4 л/га');
    expect(doseGate.emitted).toContain('уточните регион');

    const namedDoseGate = generalGate();
    expect(namedDoseGate.push('Для защиты яблони используйте Альто Супер в период повышенного риска ' ).text).toBe('');
    const namedDoseVerdict = namedDoseGate.push('в дозе 0,4 л/га. Сначала уточните регион и диагноз. ');
    namedDoseGate.flush();
    expect(namedDoseVerdict.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(namedDoseGate.emitted).not.toContain('Альто Супер');
    expect(namedDoseGate.emitted).not.toContain('0,4 л/га');
    expect(namedDoseGate.emitted).toContain('уточните регион');

    const intervalGate = generalGate();
    expect(intervalGate.push('Фунгицид X: повтор обработки ' ).text).toBe('');
    const intervalVerdict = intervalGate.push('через 10 дней. Осмотрите динамику пятен. ');
    intervalGate.flush();
    expect(intervalVerdict.flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(intervalGate.emitted).not.toContain('10 дней');
    expect(intervalGate.emitted).toContain('Осмотрите динамику пятен');
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
