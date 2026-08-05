#!/usr/bin/env python3
from pathlib import Path

TARGET = Path('scripts/tai-potato-mobile-live-acceptance.mjs')


def replace_once(text: str, old: str, new: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one exact anchor, found {count}: {old[:120]!r}')
    return text.replace(old, new, 1)


text = TARGET.read_text(encoding='utf-8')
replacements = [
    (
        "  { id: 'potato-fertilizer', locale: 'ru', question: 'Чем удобрять картошку', subject: ['картоф'], support: ['удобрен', 'калий', 'фосфор', 'азот', 'почв', 'органик', 'навоз'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'tomato-blossom-drop', locale: 'ru', question: 'Почему у томатов опадают цветки?', subject: ['томат'], support: ['температур', 'влажн', 'опыл', 'полив', 'питан'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'apple-scab', locale: 'ru', question: 'Как снизить риск парши в яблоневом саду?', subject: ['яблон', 'парш'], support: ['обработ', 'лист', 'влаг', 'санитар', 'фунгиц'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'soil-acidity', locale: 'ru', question: 'Что делать с кислой почвой на участке?', subject: ['почв'], support: ['ph', 'извест', 'анализ', 'доломит', 'кислот'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'drip-irrigation', locale: 'ru', question: 'Как подобрать капельный полив для небольшого огорода?', subject: ['капель', 'полив'], support: ['давлен', 'расход', 'фильтр', 'лента', 'зон'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'cow-milk-drop', locale: 'ru', question: 'Почему у коров снизился удой?', subject: ['коров', 'удой'], support: ['корм', 'здоров', 'вода', 'стресс', 'рацион', 'мастит'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'pig-feed-conversion', locale: 'ru', question: 'Как улучшить конверсию корма у свиней?', subject: ['свин'], support: ['корм', 'рацион', 'здоров', 'микроклимат', 'вода'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'chicken-egg-drop', locale: 'ru', question: 'Почему куры стали хуже нестись?', subject: ['кур'], support: ['корм', 'свет', 'температур', 'стресс', 'здоров'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'bee-wintering', locale: 'ru', question: 'Как подготовить пчёл к зимовке?', subject: ['пчел'], support: ['корм', 'клещ', 'семь', 'вентиляц', 'запас'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'tractor-overheat', locale: 'ru', question: 'Почему трактор перегревается под нагрузкой?', subject: ['трактор'], support: ['радиатор', 'охлажд', 'термостат', 'насос', 'нагруз'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'combine-losses', locale: 'ru', question: 'Как уменьшить потери зерна за комбайном?', subject: ['комбайн', 'зерн'], support: ['скорост', 'молотил', 'решет', 'вентилятор', 'жатк'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'mower-vibration', locale: 'ru', question: 'Почему сильно вибрирует газонокосилка?', subject: ['газонокос'], support: ['нож', 'баланс', 'креплен', 'вал', 'подшип'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'grain-storage', locale: 'ru', question: 'Как безопасно хранить пшеницу после уборки?', subject: ['пшениц', 'хран'], support: ['влажн', 'температур', 'вентиляц', 'сушк', 'вредител'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'farm-costs', locale: 'ru', question: 'Как уменьшить расходы небольшого хозяйства без потери урожайности?', subject: ['хозяйств', 'урожайн'], support: ['затрат', 'анализ', 'техник', 'удобрен', 'топлив', 'план'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'village-water', locale: 'ru', question: 'Как организовать водоснабжение фермы в деревне?', subject: ['вод', 'ферм'], support: ['скважин', 'насос', 'резерв', 'дебит', 'качество'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'farm-excel', locale: 'ru', question: 'Как в Excel посчитать себестоимость тонны зерна?', subject: ['excel', 'себестоим', 'зерн'], support: ['формул', 'затрат', 'тонн', 'сумм', 'объем'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'potato-en', locale: 'en', question: 'What should I fertilize potatoes with?', subject: ['potato'], support: ['fertil', 'potassium', 'phosph', 'nitrogen', 'soil', 'manure'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'cucumber-zh', locale: 'zh', question: '温室黄瓜叶子为什么发黄？', subject: ['黄瓜'], support: ['浇水', '营养', '氮', '根', '病', '温度'] },",
        """  {
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
  },""",
    ),
    (
        "  { id: 'context-followup', locale: 'ru', question: 'А без орошения?', history: [{ role: 'user', content: 'Как повысить урожайность кукурузы?' }, { role: 'assistant', content: 'Нужно оценить гибрид, почву, питание, густоту и влагу.' }], subject: ['кукуруз', 'орошен', 'влаг'], support: ['засух', 'гибрид', 'густот', 'почв', 'срок'] },",
        """  {
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
  },""",
    ),
]

for old, new in replacements:
    text = replace_once(text, old, new)

TARGET.write_text(text, encoding='utf-8')
print(f'updated {TARGET} with {len(replacements)} semantic case definitions')
