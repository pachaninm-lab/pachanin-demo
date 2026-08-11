#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { IDENTITY_AUTHORITY, normalizePublicQwenAssessment } from './tai-public-assessment-contract.mjs';

const liveBase = process.env.LIVE_BASE;
const targetSha = process.env.TARGET_SHA;
const evidenceDir = process.env.UI_EVIDENCE_DIR;
if (!liveBase || !/^[0-9a-f]{40}$/u.test(targetSha || '') || !evidenceDir) process.exit(2);
fs.mkdirSync(evidenceDir, { recursive: true });

const CASES = [
  {
    id: 'potato-fertilizer',
    locale: 'ru',
    question: 'Чем удобрять картошку',
    subject: ['картоф'],
    support: ['удобрен', 'калий', 'фосфор', 'азот', 'почв', 'органик', 'навоз'],
    supportGroups: [
      { id: 'soil-diagnostics', terms: ['почв', 'ph', 'рн', 'анализ', 'кислот'] },
      { id: 'macronutrients', terms: ['азот', 'фосфор', 'калий', 'npk', 'питан', 'удобрен'] },
      { id: 'organic-sources', terms: ['органик', 'навоз', 'компост', 'перегной', 'сидерат'] },
      { id: 'timing-stage', terms: ['фаз', 'рост', 'цветен', 'клубн', 'посадк', 'срок'] },
      { id: 'application-method', terms: ['внесен', 'локальн', 'рядк', 'подкорм', 'дробн'] },
    ],
  },
  {
    id: 'cucumber-yellow-leaves',
    locale: 'ru',
    question: 'Почему желтеют листья у огурцов в теплице?',
    subject: ['огур'],
    support: ['полив', 'питан', 'азот', 'корн', 'болезн', 'температур'],
    supportGroups: [
      { id: 'nutrition', terms: ['питан', 'азот', 'калий', 'магни', 'фосфор', 'дефицит', 'ph'] },
      { id: 'water-root', terms: ['полив', 'влаг', 'корн', 'переувлаж', 'засух'] },
      { id: 'disease-pests', terms: ['болезн', 'гриб', 'инфекц', 'вредител', 'тля', 'клещ'] },
      { id: 'climate', terms: ['температур', 'жар', 'холод', 'влажност'] },
    ],
  },
  {
  id: 'wheat-low-yield',
  locale: 'ru',
  question: 'Почему падает урожайность озимой пшеницы?',
  subject: ['пшениц'],
  support: ['почв', 'влаг', 'питан', 'болезн', 'сорняк', 'сорт'],
  supportGroups: [
    { id: 'nutrition', terms: ['питан', 'питательн', 'удобрен', 'подкорм', 'азот', 'фосфор', 'калий', 'дефицит'] },
    { id: 'water-climate', terms: ['влаг', 'влажн', 'засух', 'переувлаж', 'осад', 'дожд', 'температур', 'мороз', 'жар', 'погод'] },
    { id: 'soil-condition', terms: ['почв', 'рн', 'ph', 'структур', 'органик', 'уплотнен', 'кислот'] },
    { id: 'crop-health', terms: ['болезн', 'инфекц', 'вредител', 'сорняк', 'полеган'] },
    { id: 'agronomy-genetics', terms: ['сорт', 'семен', 'густот', 'посев', 'срок', 'предшествен', 'севооборот'] },
    { id: 'field-history', terms: ['история урожайности', 'история поля', 'участк', 'поле', 'неравномерн'] },
  ],
},
  {
    id: 'tomato-blossom-drop',
    locale: 'ru',
    question: 'Почему у томатов опадают цветки?',
    subject: ['томат'],
    support: ['температур', 'влажн', 'опыл', 'полив', 'питан'],
    supportGroups: [
      { id: 'water-root', terms: ['полив', 'влаг', 'засух', 'переувлаж', 'корн', 'вод'] },
      { id: 'temperature-humidity', terms: ['температур', 'жар', 'холод', 'перепад', 'влажност', 'микроклимат'] },
      { id: 'pollination', terms: ['опыл', 'пыльц', 'цветк', 'завяз'] },
      { id: 'nutrition', terms: ['питан', 'азот', 'калий', 'фосфор', 'подкорм', 'дефицит'] },
      { id: 'light-load', terms: ['свет', 'освещ', 'затен', 'нагрузк', 'плодонош'] },
    ],
  },
  {
    id: 'apple-scab',
    locale: 'ru',
    question: 'Как снизить риск парши в яблоневом саду?',
    subject: ['яблон', 'парш'],
    support: ['обработ', 'лист', 'влаг', 'санитар', 'фунгиц'],
    supportGroups: [
      { id: 'sanitation-inoculum', terms: ['санитар', 'удал', 'убир', 'опавш', 'мумифиц', 'остатк', 'источник инфекции', 'запас инфекции'] },
      { id: 'canopy-drying', terms: ['крон', 'обрез', 'прореж', 'проветр', 'высых', 'увлажнение листьев', 'листовой влажности'] },
      { id: 'weather-risk', terms: ['влажност', 'дожд', 'осад', 'рос', 'температур', 'погод'] },
      { id: 'monitoring-timing', terms: ['монитор', 'осмотр', 'фаз', 'срок', 'прогноз', 'история болезни'] },
      { id: 'labelled-protection', terms: ['фунгиц', 'зарегистрирован', 'этикет', 'защита растений', 'срок обработки'] },
    ],
  },
  {
    id: 'soil-acidity',
    locale: 'ru',
    question: 'Что делать с кислой почвой на участке?',
    subject: ['почв'],
    support: ['ph', 'извест', 'анализ', 'доломит', 'кислот'],
    supportGroups: [
      { id: 'measurement', terms: ['ph', 'рн', 'анализ', 'измер', 'кислот'] },
      { id: 'liming-material', terms: ['извест', 'доломит', 'мел', 'вапн', 'раскисл'] },
      { id: 'crop-target', terms: ['культур', 'картоф', 'томат', 'яблон', 'виноград', 'предпочит'] },
      { id: 'soil-buffer', terms: ['структур', 'механическ', 'глин', 'песчан', 'органик', 'буфер'] },
      { id: 'application-plan', terms: ['доз', 'внесен', 'задел', 'площад', 'срок'] },
    ],
  },
  {
    id: 'drip-irrigation',
    locale: 'ru',
    question: 'Как подобрать капельный полив для небольшого огорода?',
    subject: ['капель', 'полив'],
    support: ['давлен', 'расход', 'фильтр', 'лента', 'зон'],
    supportGroups: [
      { id: 'water-source-flow', terms: ['источник воды', 'скважин', 'колод', 'дебит', 'расход', 'поток', 'л/ч', 'литр'] },
      { id: 'pressure-hydraulics', terms: ['давлен', 'напор', 'редуктор', 'гидравл'] },
      { id: 'filtration-quality', terms: ['фильтр', 'примес', 'чистот', 'качество воды', 'засор'] },
      { id: 'lines-emitters', terms: ['лент', 'лини', 'эмиттер', 'капельниц', 'шаг', 'длин'] },
      { id: 'zoning-control', terms: ['зон', 'клапан', 'автомат', 'регулиров', 'контроллер'] },
      { id: 'crop-soil-relief', terms: ['культур', 'потребност', 'почв', 'рельеф', 'уклон', 'гряд'] },
    ],
  },
  {
    id: 'cow-milk-drop',
    locale: 'ru',
    question: 'Почему у коров снизился удой?',
    subject: ['коров', 'удой'],
    support: ['корм', 'здоров', 'вода', 'стресс', 'рацион', 'мастит'],
    supportGroups: [
      { id: 'ration-feed', terms: ['корм', 'рацион', 'белок', 'энерг', 'клетчат', 'минерал'] },
      { id: 'water', terms: ['вода', 'поен', 'водопотреб', 'доступ к воде'] },
      { id: 'health', terms: ['здоров', 'мастит', 'болезн', 'инфекц', 'анализ молока', 'аппетит'] },
      { id: 'stress-microclimate', terms: ['стресс', 'температур', 'жар', 'вентиляц', 'микроклимат', 'содержан'] },
      { id: 'lactation-stage', terms: ['лактац', 'стад', 'отел', 'стельн', 'возраст'] },
      { id: 'milking-records', terms: ['доен', 'оборудован', 'режим', 'учет', 'запис', 'продуктивност'] },
    ],
  },
  {
    id: 'pig-feed-conversion',
    locale: 'ru',
    question: 'Как улучшить конверсию корма у свиней?',
    subject: ['свин'],
    support: ['корм', 'рацион', 'здоров', 'микроклимат', 'вода'],
    supportGroups: [
      { id: 'ration-quality', terms: ['корм', 'рацион', 'белок', 'энерг', 'аминокислот', 'минерал', 'комбикорм'] },
      { id: 'water', terms: ['вода', 'поил', 'водоснабж', 'доступ к воде'] },
      { id: 'health', terms: ['здоров', 'болезн', 'инфекц', 'паразит', 'ветеринар'] },
      { id: 'microclimate-stress', terms: ['микроклимат', 'температур', 'вентиляц', 'стресс', 'плотност', 'чистот'] },
      { id: 'age-genetics', terms: ['возраст', 'стад', 'генет', 'пород', 'масса'] },
      { id: 'feeding-management', terms: ['режим кормлен', 'кормуш', 'доступность корма', 'учет конверс', 'помол'] },
    ],
  },
  {
    id: 'chicken-egg-drop',
    locale: 'ru',
    question: 'Почему куры стали хуже нестись?',
    subject: ['кур'],
    support: ['корм', 'свет', 'температур', 'стресс', 'здоров'],
    supportGroups: [
      { id: 'nutrition', terms: ['корм', 'рацион', 'кальц', 'фосфор', 'витамин', 'белок', 'минерал'] },
      { id: 'lighting', terms: ['свет', 'освещ', 'световой день', 'темнот'] },
      { id: 'climate', terms: ['температур', 'жар', 'холод', 'влажност', 'вентиляц', 'микроклимат'] },
      { id: 'health', terms: ['здоров', 'болезн', 'инфекц', 'паразит', 'симптом'] },
      { id: 'age-molt-stress', terms: ['возраст', 'линьк', 'стресс', 'перегруз', 'плотност'] },
      { id: 'water', terms: ['вода', 'поил', 'водоснабж'] },
    ],
  },
  {
    id: 'bee-wintering',
    locale: 'ru',
    question: 'Как подготовить пчёл к зимовке?',
    subject: ['пчел'],
    support: ['корм', 'клещ', 'семь', 'вентиляц', 'запас'],
    supportGroups: [
      { id: 'stores-feed', terms: ['мед', 'запас', 'корм', 'сироп', 'перг', 'нектар'] },
      { id: 'colony-strength', terms: ['семь', 'сил', 'матк', 'расплод', 'пчелин', 'клуб'] },
      { id: 'health-parasites', terms: ['клещ', 'варро', 'паразит', 'болезн', 'ноземат', 'акари', 'обработ'] },
      { id: 'hive-moisture', terms: ['улей', 'вентиляц', 'влаг', 'конденсат', 'леток', 'сырост'] },
      { id: 'insulation-climate', terms: ['утепл', 'ветр', 'мороз', 'температур', 'климат', 'зим'] },
      { id: 'protection-hygiene', terms: ['мыш', 'грызун', 'санитар', 'чистот', 'защит'] },
    ],
  },
  {
    id: 'tractor-overheat',
    locale: 'ru',
    question: 'Почему трактор перегревается под нагрузкой?',
    subject: ['трактор'],
    support: ['радиатор', 'охлажд', 'термостат', 'насос', 'нагруз'],
    supportGroups: [
      { id: 'cooling-airflow', terms: ['радиатор', 'охлажд', 'вентилятор', 'обдув', 'гряз', 'сот'] },
      { id: 'circulation-control', terms: ['термостат', 'насос', 'помп', 'циркуляц', 'антифриз', 'охлаждающей жидкости'] },
      { id: 'load-settings', terms: ['нагруз', 'оборот', 'скорост', 'передач', 'режим работ'] },
      { id: 'lubrication', terms: ['масл', 'смаз', 'давление масла'] },
      { id: 'mechanical-integrity', terms: ['ремень', 'утеч', 'прокладк', 'засор', 'износ'] },
    ],
  },
  {
    id: 'combine-losses',
    locale: 'ru',
    question: 'Как уменьшить потери зерна за комбайном?',
    subject: ['комбайн', 'зерн'],
    support: ['скорост', 'молотил', 'решет', 'вентилятор', 'жатк'],
    supportGroups: [
      { id: 'header', terms: ['жатк', 'мотовил', 'режущ', 'высота срез', 'подач'] },
      { id: 'threshing', terms: ['молотил', 'барабан', 'ротор', 'подбарабан', 'зазор', 'обмолот'] },
      { id: 'cleaning', terms: ['решет', 'вентилятор', 'очистк', 'воздушн', 'сход'] },
      { id: 'speed-feed', terms: ['скорост', 'подач', 'загрузк', 'пропускн'] },
      { id: 'crop-condition', terms: ['влажност', 'солом', 'полегл', 'урожайн', 'состояние культуры'] },
      { id: 'measurement-calibration', terms: ['замер', 'лоток', 'потер', 'калибр', 'провер'] },
    ],
  },
  {
    id: 'mower-vibration',
    locale: 'ru',
    question: 'Почему сильно вибрирует газонокосилка?',
    subject: ['газонокос'],
    support: ['нож', 'баланс', 'креплен', 'вал', 'подшип'],
    supportGroups: [
      { id: 'blade-balance', terms: ['нож', 'лезви', 'баланс', 'деформац', 'заточ'] },
      { id: 'fastening', terms: ['креплен', 'болт', 'гайк', 'ослаб'] },
      { id: 'shaft-bearing', terms: ['вал', 'шпиндел', 'подшип', 'люфт'] },
      { id: 'deck-debris', terms: ['дек', 'трава', 'гряз', 'налип', 'посторонн'] },
      { id: 'engine-mount', terms: ['двигател', 'опор', 'крепление двигателя', 'зажиган', 'цилиндр'] },
    ],
  },
  {
    id: 'grain-storage',
    locale: 'ru',
    question: 'Как безопасно хранить пшеницу после уборки?',
    subject: ['пшениц', 'хран'],
    support: ['влажн', 'температур', 'вентиляц', 'сушк', 'вредител'],
    supportGroups: [
      { id: 'moisture-drying', terms: ['влажн', 'сушк', 'досуш', 'сыр'] },
      { id: 'temperature-aeration', terms: ['температур', 'вентиляц', 'аэраци', 'охлажд', 'самосогрев'] },
      { id: 'sanitation-pests', terms: ['вредител', 'насеком', 'грызун', 'санитар', 'очистк', 'заражен'] },
      { id: 'monitoring-sampling', terms: ['монитор', 'контрол', 'проб', 'датчик', 'осмотр'] },
      { id: 'storage-structure', terms: ['силос', 'склад', 'бункер', 'гермет', 'насып', 'парт'] },
    ],
  },
  {
    id: 'farm-costs',
    locale: 'ru',
    question: 'Как уменьшить расходы небольшого хозяйства без потери урожайности?',
    subject: ['хозяйств', 'урожайн'],
    support: ['затрат', 'анализ', 'техник', 'удобрен', 'топлив', 'план'],
    supportGroups: [
      { id: 'cost-accounting', terms: ['затрат', 'себестоим', 'анализ', 'учет', 'бюджет'] },
      { id: 'inputs', terms: ['удобрен', 'семен', 'средств защиты', 'материал', 'норм внесен'] },
      { id: 'fuel-machinery', terms: ['топлив', 'техник', 'ремонт', 'амортизац', 'маршрут'] },
      { id: 'labor-logistics', terms: ['труд', 'персонал', 'логист', 'транспорт', 'склад'] },
      { id: 'yield-quality-risk', terms: ['урожайн', 'качеств', 'потер', 'риск', 'технолог'] },
      { id: 'procurement-planning', terms: ['закуп', 'поставщик', 'план', 'график', 'контракт'] },
    ],
  },
  {
    id: 'village-water',
    locale: 'ru',
    question: 'Как организовать водоснабжение фермы в деревне?',
    subject: ['вод', 'ферм'],
    support: ['скважин', 'насос', 'резерв', 'дебит', 'качество'],
    supportGroups: [
      { id: 'source-capacity', terms: ['скважин', 'колод', 'источник', 'дебит', 'производительност'] },
      { id: 'quality-treatment', terms: ['качество', 'анализ воды', 'фильтр', 'обеззараж', 'очистк'] },
      { id: 'pump-pressure', terms: ['насос', 'давлен', 'напор', 'гидроаккумулятор'] },
      { id: 'storage-reserve', terms: ['резерв', 'емкост', 'бак', 'запас воды'] },
      { id: 'distribution-freeze', terms: ['труб', 'разводк', 'утепл', 'замерзан', 'дренаж'] },
      { id: 'demand-biosecurity', terms: ['потребност', 'поголов', 'мойк', 'пожарн', 'биобезопас'] },
    ],
  },
  {
    id: 'farm-excel',
    locale: 'ru',
    question: 'Как в Excel посчитать себестоимость тонны зерна?',
    subject: ['excel', 'себестоим', 'зерн'],
    support: ['формул', 'затрат', 'тонн', 'сумм', 'объем'],
    supportGroups: [
      { id: 'cost-numerator', terms: ['затрат', 'сумм', 'расход', 'руб', 'стоимост'] },
      { id: 'output-denominator', terms: ['тонн', 'объем', 'масса', 'урожай', 'выпуск'] },
      { id: 'allocation', terms: ['распредел', 'постоянн', 'переменн', 'накладн', 'амортизац'] },
      { id: 'formula-table', terms: ['формул', 'excel', 'ячейк', 'таблиц', 'sum', 'делен'] },
      { id: 'units-validation', terms: ['единиц', 'провер', 'сверк', 'период', 'учет'] },
    ],
  },
  {
    id: 'potato-en',
    locale: 'en',
    question: 'What should I fertilize potatoes with?',
    subject: ['potato'],
    support: ['fertil', 'potassium', 'phosph', 'nitrogen', 'soil', 'manure'],
    supportGroups: [
      { id: 'soil-diagnostics', terms: ['soil', 'ph', 'test', 'analysis', 'acidity'] },
      { id: 'macronutrients', terms: ['nitrogen', 'phosph', 'potassium', 'npk', 'nutrient', 'fertil'] },
      { id: 'organic-sources', terms: ['manure', 'compost', 'organic', 'green manure'] },
      { id: 'timing-stage', terms: ['stage', 'growth', 'planting', 'flowering', 'tuber', 'timing'] },
      { id: 'application-method', terms: ['apply', 'band', 'side-dress', 'split application'] },
    ],
  },
  {
    id: 'cucumber-zh',
    locale: 'zh',
    question: '温室黄瓜叶子为什么发黄？',
    subject: ['黄瓜'],
    support: ['浇水', '营养', '氮', '根', '病', '温度'],
    supportGroups: [
      { id: 'nutrition', terms: ['营养', '氮', '钾', '镁', '磷', '缺素', '施肥'] },
      { id: 'water-root', terms: ['浇水', '水分', '根', '积水', '干旱', '灌溉'] },
      { id: 'disease-pests', terms: ['病', '真菌', '感染', '害虫', '蚜虫', '螨'] },
      { id: 'climate', terms: ['温度', '高温', '低温', '湿度', '通风'] },
    ],
  },
  {
    id: 'context-followup',
    locale: 'ru',
    question: 'А без орошения?',
    history: [{ role: 'user', content: 'Как повысить урожайность кукурузы?' }, { role: 'assistant', content: 'Нужно оценить гибрид, почву, питание, густоту и влагу.' }],
    subject: ['кукуруз', 'орошен', 'влаг'],
    support: ['засух', 'гибрид', 'густот', 'почв', 'срок'],
    supportGroups: [
      { id: 'drought-genetics', terms: ['засух', 'гибрид', 'засухоустойчив', 'генет'] },
      { id: 'soil-moisture', terms: ['почв', 'влаг', 'мульч', 'сохранен', 'обработк почвы'] },
      { id: 'plant-density', terms: ['густот', 'норма высева', 'растений на гектар', 'размещен'] },
      { id: 'sowing-timing', terms: ['срок', 'посев', 'сеять', 'фаз', 'вегетац'] },
      { id: 'nutrition', terms: ['питан', 'удобрен', 'азот', 'фосфор', 'калий'] },
      { id: 'field-risk', terms: ['осад', 'погод', 'рельеф', 'предшествен', 'сорняк'] },
    ],
  },
];

const UI_CASE_IDS = new Set(['potato-fertilizer', 'cucumber-yellow-leaves', 'cow-milk-drop', 'tractor-overheat', 'farm-costs']);
const FORBIDDEN = [
  'как защищаются данные',
  'доступ назначает сервер',
  'подписанной сессии',
  'данные разных организаций изолированы',
  'журнале аудита',
  'публичный режим не имеет доступа',
];

function normalize(value, locale = 'ru') {
  const tag = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return value.normalize('NFKC').toLocaleLowerCase(tag).replace(/ё/gu, 'е');
}

function assertAgriculturalAnswer(answer, testCase, boundary) {
  const normalized = normalize(answer, testCase.locale);
  if (answer.length < 80) throw new Error(`${testCase.id}_${boundary}_answer_too_short:${answer.length}`);
  if (!testCase.subject.some(term => normalized.includes(normalize(term, testCase.locale)))) {
    throw new Error(`${testCase.id}_${boundary}_subject_missing`);
  }
  const supportGroups = testCase.supportGroups || testCase.support.map(term => ({ id: term, terms: [term] }));
  const matchedGroups = supportGroups
    .filter(group => group.terms.some(term => normalized.includes(normalize(term, testCase.locale))))
    .map(group => group.id);
  if (matchedGroups.length < 2) {
    throw new Error(`${testCase.id}_${boundary}_substance_missing:${matchedGroups.join(',')}`);
  }
  const wrong = FORBIDDEN.find(term => normalized.includes(term));
  if (wrong) throw new Error(`${testCase.id}_${boundary}_wrong_platform_article:${wrong}`);
  return matchedGroups;
}

function parseSse(text) {
  const frames = [];
  for (const block of text.split('\n\n')) {
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) frames.push(JSON.parse(line.slice(6)));
    }
  }
  return frames;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
await page.addInitScript(() => window.sessionStorage.clear());
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

const evidence = [];
let manifestSha = null;
try {
  const response = await page.goto(`${liveBase}/platform-v7?lang=ru&release=${targetSha}&agro=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (!response?.ok()) throw new Error(`live_page_http_${response?.status()}`);

  const manifest = await page.evaluate(async sha => {
    const result = await fetch(`/manifest-pc-deploy.json?agro=${sha}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!result.ok) throw new Error(`manifest_http_${result.status}`);
    return result.json();
  }, targetSha);
  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);

  for (const testCase of CASES) {
    const sseText = await page.evaluate(async payload => {
      const result = await fetch('/api/public-platform-assistant?stream=1', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(240_000),
      });
      if (!result.ok) throw new Error(`agro_sse_http_${result.status}`);
      return result.text();
    }, { message: testCase.question, locale: testCase.locale, history: testCase.history || [] });

    const frames = parseSse(sseText);
    const assessmentFrame = frames.find(frame => frame.event === 'assessment');
    const assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
    const answer = frames.filter(frame => frame.event === 'token').map(frame => String(frame.text || '')).join('').trim();
    const done = frames.at(-1);
    const row = {
      id: testCase.id,
      locale: testCase.locale,
      question: testCase.question,
      answer: answer.slice(0, 4_000),
      answerCharacters: answer.length,
      source: assessment?.source ?? null,
      answerMode: assessment?.answerMode ?? null,
      // Identity is not published on the public contour; see the contract module.
      identityAuthority: IDENTITY_AUTHORITY,
      publicModelIdentityExposed: false,
      streamComplete: done?.event === 'done' && done.complete === true,
      status: 'PENDING',
    };
    evidence.push(row);
    const verified = normalizePublicQwenAssessment(assessment, testCase.id);
    row.streaming = verified.streaming;
    row.finishReason = verified.finishReason;
    row.truncated = verified.truncated;
    row.safetyFlags = verified.safetyFlags;
    if (done?.event !== 'done' || done.complete !== true) throw new Error(`${testCase.id}_stream_incomplete`);
    row.matchedTerms = assertAgriculturalAnswer(answer, testCase, 'endpoint');
    row.status = 'PASS';
  }

  const hidden = page.locator('.pc-public-assistant-shortcut');
  await hidden.waitFor({ state: 'attached', timeout: 30_000 });
  await hidden.evaluate(node => node.click());
  const dialog = page.locator('#pc-public-assistant-panel');
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  const composer = dialog.getByRole('textbox', { name: 'Спроси Гекту о земле, урожае или агробизнесе' });

  const answeredMessages = dialog.locator(
    '.pc-public-assistant-message[data-role="assistant"][data-stream-status="answered"]',
  );
  const userMessages = dialog.locator('.pc-public-assistant-message[data-role="user"]');

  for (const testCase of CASES.filter(item => UI_CASE_IDS.has(item.id))) {
    const answeredBefore = await answeredMessages.count();
    const usersBefore = await userMessages.count();

    await composer.fill(testCase.question);
    await dialog.getByRole('button', { name: 'Отправить' }).click();

    const submitted = userMessages.nth(usersBefore);
    await submitted.waitFor({ state: 'visible', timeout: 30_000 });
    const submittedQuestion = ((await submitted.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
    if (!normalize(submittedQuestion, testCase.locale).includes(normalize(testCase.question, testCase.locale))) {
      throw new Error(`${testCase.id}_ui_question_mismatch`);
    }

    const answered = answeredMessages.nth(answeredBefore);
    await answered.waitFor({ state: 'visible', timeout: 240_000 });
    const uiAnswer = ((await answered.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
    const row = evidence.find(item => item.id === testCase.id);
    row.ui = {
      viewport: '390x844',
      answer: uiAnswer.slice(0, 4_000),
      answerCharacters: uiAnswer.length,
      status: 'PENDING',
    };
    row.ui.matchedTerms = assertAgriculturalAnswer(uiAnswer, testCase, 'ui');
    row.ui.status = 'PASS';
  }

  if (await dialog.locator('[role="alert"]').count()) throw new Error('agro_ui_alert_present');
  if (pageErrors.length) throw new Error(`agro_page_errors:${pageErrors.join('|')}`);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-390x844.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance.v1', targetSha, manifestSha,
    endpointCaseCount: CASES.length, uiCaseCount: UI_CASE_IDS.size, cases: evidence,
    forbiddenPlatformArticleAbsent: true, status: 'PASS',
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-failure-390x844.png'), fullPage: true }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer-failure.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance-failure.v1', targetSha, manifestSha, completedCases: evidence, pageErrors, error: message, status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}

console.log('TAI_AGRO_WIDE_MOBILE_LIVE=PASS');
