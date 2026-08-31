export type GektaLocale = 'ru' | 'en' | 'zh';

export type GektaStarter = Readonly<{ label: string; prompt: string }>;
export type GektaTopic = Readonly<{
  slug: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  tasks: readonly string[];
  checklistTitle: string;
  checklist: readonly string[];
  prompt: string;
  related: readonly string[];
}>;

export const GEKTA_PATHS: Record<GektaLocale, string> = {
  ru: '/gekta',
  en: '/gekta/en',
  zh: '/gekta/zh',
};

export const GEKTA_PUBLIC_CAPABILITIES = {
  streaming: true,
  multiTurn: true,
  citations: true,
  attachments: true,
  currentExternalRetrieval: false,
  authenticatedEcosystemContext: false,
} as const;

export const GEKTA_TOPICS: readonly GektaTopic[] = [
  {
    slug: 'agronomiya-rastenievodstvo',
    title: 'Гекта для агрономии и растениеводства',
    description: 'Аграрный ИИ для агронома и растениеводства: урожайность, почва, питание, защита растений, севооборот, технология и диагностика причин.',
    h1: 'Гекта для агрономии и растениеводства',
    lead: 'Разбирай производственную задачу как систему: симптомы, поле, культура, фаза, погода, питание, защита растений и технология — в одном диалоге.',
    tasks: [
      'Разобрать падение урожайности и отделить симптомы от возможных причин.',
      'Составить последовательность проверки почвы, питания, влаги, посевов и фитосанитарных факторов.',
      'Сравнить варианты технологического решения и увидеть, каких данных не хватает для уверенного вывода.',
      'Структурировать наблюдения по полю, результаты анализов, нормы и расчёты.',
    ],
    checklistTitle: 'Что полезно дать Гекте для точного разбора',
    checklist: ['культура и сорт/гибрид', 'регион и тип почвы', 'фаза развития', 'предшественник и севооборот', 'питание и обработки', 'погода и влагообеспечение', 'симптомы и динамика по участкам'],
    prompt: 'Почему снижается урожайность озимой пшеницы и что проверить в первую очередь? Составь приоритетную диагностику по шагам.',
    related: ['hranenie-logistika', 'agrobiznes', 'dokumenty-raschety'],
  },
  {
    slug: 'zhivotnovodstvo',
    title: 'Гекта для животноводства',
    description: 'ИИ для животноводства: кормление, микроклимат, продуктивность, содержание, биобезопасность, технологические показатели и экономика.',
    h1: 'Гекта для животноводства',
    lead: 'Связывай условия содержания, рацион, микроклимат, продуктивность и экономику, чтобы быстрее находить факторы, которые требуют проверки.',
    tasks: [
      'Разобрать снижение продуктивности и построить карту вероятных факторов.',
      'Проверить риски теплового стресса, микроклимата и содержания.',
      'Структурировать данные по рациону, воде, группе животных и технологическим показателям.',
      'Сравнить варианты изменения процесса с учётом операционных ограничений хозяйства.',
    ],
    checklistTitle: 'Что подготовить для разбора',
    checklist: ['вид и группа животных', 'возраст и продуктивность', 'рацион и доступ к воде', 'температура и влажность', 'вентиляция и плотность содержания', 'изменение показателей во времени', 'недавние изменения технологии'],
    prompt: 'Как оценить риск теплового стресса у КРС и что изменить в хозяйстве? Дай чек-лист измерений и приоритет действий.',
    related: ['agrobiznes', 'dokumenty-raschety', 'selhoztehnika'],
  },
  {
    slug: 'selhoztehnika',
    title: 'Гекта для сельскохозяйственной техники',
    description: 'ИИ для сельхозтехники: диагностика неисправностей, расход топлива, обслуживание, эксплуатация, сравнение причин и вариантов ремонта.',
    h1: 'Гекта для сельскохозяйственной техники',
    lead: 'Переходи от симптома к проверкам: режим работы, нагрузка, расход, ошибки, обслуживание и экономика ремонта — без случайной замены деталей.',
    tasks: [
      'Составить диагностическое дерево по симптому и расставить проверки по вероятности и цене ошибки.',
      'Разобрать рост расхода топлива, перегрев, потерю мощности, гидравлику и другие эксплуатационные отклонения.',
      'Подготовить перечень измерений и данных перед сервисом или ремонтом.',
      'Сравнить ремонт, обслуживание и замену узла с учётом простоя и стоимости.',
    ],
    checklistTitle: 'Что сообщить о машине',
    checklist: ['марка и модель', 'моточасы', 'симптом и момент появления', 'нагрузка и режим', 'ошибки/индикация', 'последнее обслуживание', 'расход топлива и жидкости', 'что уже проверяли или меняли'],
    prompt: 'Почему трактор начал расходовать больше топлива и с чего начать диагностику? Построй дерево причин от быстрых проверок к дорогим.',
    related: ['agrobiznes', 'dokumenty-raschety', 'agronomiya-rastenievodstvo'],
  },
  {
    slug: 'agrobiznes',
    title: 'Гекта для экономики хозяйства и агробизнеса',
    description: 'ИИ для агробизнеса: себестоимость, маржинальность, сценарии производства, закупки, хранения, продажи и инвестиционных решений.',
    h1: 'Гекта для экономики хозяйства и агробизнеса',
    lead: 'Собирай экономику решения в одной модели: затраты, объём, цена, потери, логистика, хранение, риски и чувствительность результата.',
    tasks: [
      'Разложить себестоимость культуры или направления по управляемым статьям.',
      'Посчитать маржу, точку безубыточности и чувствительность к цене, урожайности и затратам.',
      'Сравнить сценарии продать сейчас, хранить, переработать или изменить технологию.',
      'Подготовить прозрачное объяснение расчёта для руководителя, партнёра или финансовой организации.',
    ],
    checklistTitle: 'Минимальные данные для расчёта',
    checklist: ['площадь/объём', 'урожайность или выпуск', 'цена реализации', 'семена/корма/материалы', 'ГСМ и энергия', 'оплата труда', 'ремонт и амортизация', 'хранение и логистика', 'финансирование и прочие расходы'],
    prompt: 'Рассчитай структуру себестоимости пшеницы и покажи, где хозяйство теряет маржу. Сначала дай таблицу данных, которые мне нужно заполнить.',
    related: ['hranenie-logistika', 'dokumenty-raschety', 'agronomiya-rastenievodstvo'],
  },
  {
    slug: 'hranenie-logistika',
    title: 'Гекта для хранения, качества и логистики',
    description: 'ИИ для хранения и агрологистики: режимы хранения, качество, потери, сушka, транспортировка, элеваторные и операционные риски.',
    h1: 'Гекта для хранения, качества и логистики',
    lead: 'Связывай качество партии, режим хранения, время, маршрут и стоимость, чтобы видеть не только операцию, но и риск потери денег или качества.',
    tasks: [
      'Разобрать режим хранения и причины потери качества.',
      'Составить контрольные точки по температуре, влажности, вентиляции и состоянию продукции.',
      'Сравнить варианты логистики с учётом времени, стоимости, качества и ограничений.',
      'Структурировать расхождения по партии, измерениям, документам и ответственности.',
    ],
    checklistTitle: 'Что влияет на решение',
    checklist: ['вид продукции и партия', 'исходное качество/влажность', 'температурный режим', 'условия помещения или силоса', 'срок хранения', 'частота контроля', 'маршрут и время перевозки', 'ограничения по качеству и приёмке'],
    prompt: 'Как выбрать режим хранения картофеля и снизить потери качества? Дай режимы, контрольные точки и признаки, когда нужно вмешаться.',
    related: ['agrobiznes', 'dokumenty-raschety', 'agronomiya-rastenievodstvo'],
  },
  {
    slug: 'dokumenty-raschety',
    title: 'Гекта для документов и расчётов в сельском хозяйстве',
    description: 'Аграрный ИИ для документов, таблиц и расчётов: структурирование, сравнение данных, поиск расхождений и подготовка рабочих материалов.',
    h1: 'Гекта для документов и расчётов в сельском хозяйстве',
    lead: 'Разбирай документы и цифры в контексте реальной аграрной задачи: что указано, где расхождение, что влияет на решение и что нужно проверить.',
    tasks: [
      'Сделать краткую структуру документа и выделить существенные для решения условия.',
      'Сравнить несколько наборов данных или документов и перечислить расхождения.',
      'Проверить арифметику, единицы измерения и логику расчёта.',
      'Сформировать таблицу, чек-лист или рабочий материал по результату анализа.',
    ],
    checklistTitle: 'Безопасная работа с файлами',
    checklist: ['прикладывай только необходимые материалы', 'не отправляй пароли и токены', 'удаляй лишние персональные данные', 'проверяй итоговые юридически значимые решения у профильного специалиста', 'для критичных цифр указывай единицы и период'],
    prompt: 'Я хочу сравнить два расчёта по хозяйству. Скажи, какие файлы и вводные приложить, чтобы найти расхождения и проверить единицы измерения.',
    related: ['agrobiznes', 'hranenie-logistika', 'selhoztehnika'],
  },
  {
    slug: 'dacha-lph',
    title: 'Гекта для дачи, огорода и личного хозяйства',
    description: 'Аграрный ИИ для дачи, огорода и ЛПХ: растения, почва, полив, питание, болезни, вредители, хранение урожая и практические вопросы.',
    h1: 'Гекта для дачи, огорода и личного хозяйства',
    lead: 'Можно задать простой вопрос обычными словами. Гекта уточняет признаки и условия, чтобы не сводить ответ к одной случайной причине.',
    tasks: [
      'Разобрать пожелтение, пятна, увядание и другие признаки у растений.',
      'Сравнить вероятные проблемы полива, питания, почвы, болезней и вредителей.',
      'Составить понятную последовательность наблюдений и безопасных первых действий.',
      'Подобрать вопросы для уточнения, если по одному фото или описанию уверенный вывод невозможен.',
    ],
    checklistTitle: 'Что помогает сузить причины',
    checklist: ['какая культура и возраст растения', 'где растёт — грунт/теплица/горшок', 'как давно появились признаки', 'какие листья или части поражены первыми', 'полив и подкормки', 'температура и освещение', 'есть ли насекомые, налёт, запах или повреждения'],
    prompt: 'На листьях томатов появились пятна. Какие причины проверить и какие данные нужны, чтобы сузить диагноз без гадания?',
    related: ['agronomiya-rastenievodstvo', 'hranenie-logistika', 'dokumenty-raschety'],
  },
] as const;

export const GEKTA_COPY = {
  ru: {
    htmlLang: 'ru',
    brandLine: 'ГЕКТА · Аграрный интеллект',
    h1: 'Гекта — аграрный ИИ для сельского хозяйства и агробизнеса',
    lead: 'Один диалог для задач от поля, фермы и сельхозтехники до хранения, логистики, документов и экономики хозяйства. Опиши ситуацию обычными словами — Гекта удерживает контекст, уточняет недостающее, сравнивает варианты и помогает перейти к конкретному решению.',
    maker: 'Самостоятельный AI-продукт экосистемы «Прозрачная Цена».',
    placeholder: 'Спроси о культуре, поле, хозяйстве, технике, животноводстве, хранении или агробизнесе',
    starters: [
      { label: 'Растениеводство', prompt: 'Почему снижается урожайность озимой пшеницы и что проверить в первую очередь?' },
      { label: 'Защита растений', prompt: 'На листьях появились пятна. Какие причины проверить и какие данные нужны для уточнения?' },
      { label: 'Животноводство', prompt: 'Как оценить риск теплового стресса у КРС и что изменить в хозяйстве?' },
      { label: 'Сельхозтехника', prompt: 'Почему трактор начал расходовать больше топлива и с чего начать диагностику?' },
      { label: 'Экономика', prompt: 'Рассчитай структуру себестоимости пшеницы и покажи, где хозяйство теряет маржу.' },
      { label: 'Хранение', prompt: 'Как выбрать режим хранения картофеля и снизить потери качества?' },
    ] as readonly GektaStarter[],
    marketingTitle: 'Не просто чат. Аграрный контекст в одном диалоге.',
    marketingText: [
      'Гекта создана для задач сельского хозяйства. Она понимает аграрную терминологию, учитывает контекст предыдущих сообщений, связывает данные между собой, помогает проверить гипотезы и объясняет логику вывода понятным языком.',
      'В одном разговоре можно перейти от состояния культуры к питанию растений, от технической неисправности к экономике ремонта, от качества зерна к хранению, логистике, документам или условиям сделки — без переключения между десятками отдельных сервисов.',
    ],
    valueCards: [
      ['Понимает контекст', 'Не заставляет повторять исходные данные в каждом сообщении и учитывает ход разговора.'],
      ['Работает с причинами, а не только ответами', 'Помогает отделить симптомы от возможных причин и выстраивает последовательность проверки.'],
      ['Показывает следующий шаг', 'Ответ заканчивается конкретными действиями, проверками, расчётами или недостающими данными.'],
      ['Работает с источниками', 'Когда ответ содержит подтверждённые источники, Гекта показывает, откуда получена информация.'],
    ] as const,
    capabilityTitle: 'ИИ для сельского хозяйства — от поля до экономики хозяйства',
    capabilities: [
      ['Растениеводство и агрономия', 'Гекта помогает разбирать урожайность, питание растений, почву, севооборот, посев, вегетацию, орошение, стрессовые факторы, болезни, вредителей, сорняки и технологические решения.'],
      ['Животноводство', 'Гекта помогает работать с кормлением, содержанием, микроклиматом, продуктивностью, технологическими показателями, биобезопасностью и экономикой животноводства.'],
      ['Сельскохозяйственная техника', 'Гекта помогает диагностировать неисправности, сравнивать возможные причины, планировать обслуживание, анализировать расход топлива, эксплуатацию и варианты ремонта.'],
      ['Хранение, качество и логистика', 'Гекта помогает разбирать сушку, хранение, температурные режимы, качество продукции, потери, транспортировку и связанные операционные риски.'],
      ['Экономика и агробизнес', 'Гекта считает себестоимость, маржинальность и сценарии, помогает сравнивать варианты закупки, производства, хранения, продажи и инвестиций в хозяйстве.'],
      ['Документы и расчёты', 'Гекта помогает читать, сравнивать и структурировать поддерживаемые документы, таблицы и расчёты, находить расхождения и подготавливать понятные рабочие материалы.'],
    ] as const,
    audienceTitle: 'Для тех, кто принимает решения в сельском хозяйстве',
    audiences: ['Фермер', 'Агроном', 'Руководитель хозяйства', 'Инженер и механизатор', 'Специалист по животноводству', 'Элеватор и хранение', 'Закупщик и продавец', 'Логистика', 'Агробизнес', 'ЛПХ', 'Дачник и огородник'],
    audienceText: 'Гекта одинаково естественно принимает простой вопрос владельца огорода и сложную производственную задачу хозяйства. Глубина ответа меняется вместе с задачей: от понятного объяснения до расчёта, сравнительного анализа, документа или последовательности профессиональных проверок.',
    trustTitle: 'Факты, предположения и риски не смешиваются',
    trustText: [
      'Гекта отделяет известные факты от предположений, отмечает недостающие данные и показывает ограничения вывода.',
      'Если ответ зависит от изменяющейся информации, подтверждённый источник должен быть указан в ответе. Когда текущего подтверждения нет, Гекта сообщает об ограничении вместо уверенного предположения.',
    ],
    howTitle: 'От вопроса к решению без сложных меню',
    how: [
      ['1. Опиши ситуацию', 'Напиши вопрос так, как объяснил бы его специалисту.'],
      ['2. Гекта собирает контекст', 'Она учитывает предыдущий разговор, уточняет критически важные данные и использует доступные источники и инструменты.'],
      ['3. Получи понятный результат', 'Ответ содержит вывод, аргументы, следующий шаг, расчёты или источники — в зависимости от задачи.'],
    ] as const,
    principle: 'Пользователь не обязан заранее выбирать «модуль растениеводства», «модуль техники» или «модуль экономики». Гекта сама определяет контекст разговора.',
    creatorTitle: 'Гекта создана «Прозрачной Ценой»',
    creatorText: ['Гекта — самостоятельный продукт экосистемы «Прозрачная Цена».', '«Прозрачная Цена» создаёт цифровую инфраструктуру для сельскохозяйственного рынка и реальных отраслевых процессов. Гекта превращает этот отраслевой контекст в интеллектуальный интерфейс: помогает работать с вопросами, документами, данными, расчётами и решениями на естественном языке.'],
    faqTitle: 'Вопросы о Гекте',
    faq: [
      ['Что такое Гекта?', 'Гекта — специализированный аграрный ИИ для сельского хозяйства и агробизнеса. Она помогает решать задачи растениеводства, животноводства, сельхозтехники, хранения, логистики, экономики, документов и других связанных направлений в одном диалоге.'],
      ['Чем Гекта отличается от универсального ИИ?', 'Гекта ориентирована на сельскохозяйственный контекст. Она понимает отраслевые термины, удерживает структуру аграрной задачи, работает с доступными профильными источниками, расчётами и помогает перейти от общего ответа к конкретной последовательности действий.'],
      ['Может ли Гекта работать как помощник агронома?', 'Да. Гекта помогает анализировать состояние культур, урожайность, питание, почву, технологию выращивания, болезни, вредителей, сорняки и другие факторы. При недостатке данных она уточняет условия и показывает, что необходимо проверить.'],
      ['Гекта подходит только крупным хозяйствам?', 'Нет. Ей можно пользоваться для задач предприятий, фермерских хозяйств, ЛПХ, дачи и огорода. Сложность ответа адаптируется к вопросу пользователя.'],
      ['Может ли Гекта работать с документами и таблицами?', 'Да. Поддерживаемые документы можно приложить к разговору: Гекта помогает структурировать их содержание, сравнивать данные, находить расхождения и формировать рабочий результат.'],
      ['Использует ли Гекта актуальную информацию?', 'Гекта не должна выдавать изменяющиеся данные за актуальный факт без подтверждения. Если в ответе есть подтверждённый источник, он показывается пользователю; если подтверждения недостаточно, ограничение отмечается прямо.'],
      ['Сохраняет ли Гекта контекст разговора?', 'Да. Внутри диалога Гекта учитывает предыдущие сообщения и связанные с задачей факты, поэтому пользователю не требуется повторять исходные данные в каждом вопросе.'],
      ['Кто создал Гекту?', 'Гекта создана командой «Прозрачной Цены» как самостоятельный AI-продукт для сельского хозяйства и агробизнеса.'],
    ] as const,
  },
  en: {
    htmlLang: 'en',
    brandLine: 'GEKTA · Agricultural intelligence',
    h1: 'Gekta — agricultural AI for farming and agribusiness',
    lead: 'One conversation for work from crops, farms and machinery to storage, logistics, documents and farm economics. Describe the situation naturally — Gekta keeps context, asks for missing facts, compares options and helps turn analysis into a concrete next step.',
    maker: 'An independent AI product in the Prozrachnaya Tsena ecosystem.',
    placeholder: 'Ask about crops, fields, farms, machinery, livestock, storage or agribusiness',
    starters: [
      { label: 'Crop production', prompt: 'Why is winter wheat yield declining, and what should I check first?' },
      { label: 'Crop protection', prompt: 'Spots appeared on the leaves. What causes should I check and what data is needed?' },
      { label: 'Livestock', prompt: 'How can I assess heat-stress risk in cattle and what should change on the farm?' },
      { label: 'Machinery', prompt: 'Why did a tractor start using more fuel, and where should diagnosis begin?' },
      { label: 'Economics', prompt: 'Build a wheat cost structure and show where the farm may be losing margin.' },
      { label: 'Storage', prompt: 'How should potatoes be stored to reduce quality losses?' },
    ] as readonly GektaStarter[],
    marketingTitle: 'More than chat. Agricultural context in one conversation.',
    marketingText: ['Gekta is built for agricultural work. It understands domain terminology, follows previous messages, connects related facts, helps test hypotheses and explains the logic of a conclusion clearly.', 'A conversation can move from crop condition to nutrition, from a machinery fault to repair economics, or from grain quality to storage, logistics and documents without forcing the user through separate product modules.'],
    valueCards: [['Keeps context', 'Uses the course of the conversation so key inputs do not need to be repeated.'], ['Works through causes', 'Helps separate symptoms from possible causes and orders the checks.'], ['Shows the next step', 'Turns an answer into actions, checks, calculations or missing inputs.'], ['Shows sources', 'When an answer contains verified sources, Gekta shows where the information came from.']] as const,
    capabilityTitle: 'Agricultural AI from the field to farm economics',
    capabilities: [['Crops and agronomy', 'Work through yield, crop nutrition, soil, rotations, irrigation, stress, disease, pests, weeds and production decisions.'], ['Livestock', 'Work through feeding, housing, climate, productivity, biosecurity, production indicators and livestock economics.'], ['Agricultural machinery', 'Diagnose faults, compare causes, plan service and analyse fuel use, operation and repair choices.'], ['Storage, quality and logistics', 'Work through drying, storage regimes, product quality, losses, transport and operational risk.'], ['Economics and agribusiness', 'Calculate cost, margin and scenarios and compare production, storage, sale and investment options.'], ['Documents and calculations', 'Read, compare and structure supported documents, tables and calculations and surface discrepancies.']] as const,
    audienceTitle: 'For people making agricultural decisions',
    audiences: ['Farmer', 'Agronomist', 'Farm manager', 'Engineer and machinery operator', 'Livestock specialist', 'Storage and elevator teams', 'Buyer and seller', 'Logistics', 'Agribusiness', 'Smallholding', 'Home grower'],
    audienceText: 'Gekta handles both a simple home-growing question and a detailed farm production problem. The depth follows the task: from a clear explanation to a calculation, comparison, document or professional checklist.',
    trustTitle: 'Facts, assumptions and risks stay separate',
    trustText: ['Gekta distinguishes known facts from assumptions, marks missing inputs and states the limits of a conclusion.', 'When an answer depends on changing information, a verified source should be shown. If current verification is unavailable, Gekta states the limitation instead of presenting an assumption as fact.'],
    howTitle: 'From question to decision without complex menus',
    how: [['1. Describe the situation', 'Write the question as you would explain it to a specialist.'], ['2. Gekta builds context', 'It uses the prior conversation, asks for critical missing inputs and uses available sources and tools.'], ['3. Get a usable result', 'The response contains a conclusion, reasoning, next step, calculations or sources as the task requires.']] as const,
    principle: 'You do not need to choose an agronomy, machinery or economics module in advance. Gekta determines the conversation context.',
    creatorTitle: 'Gekta is created by Prozrachnaya Tsena',
    creatorText: ['Gekta is an independent product in the Prozrachnaya Tsena ecosystem.', 'Prozrachnaya Tsena builds digital infrastructure for agricultural markets and real industry processes. Gekta turns that domain context into a natural-language interface for questions, documents, data, calculations and decisions.'],
    faqTitle: 'Questions about Gekta',
    faq: [['What is Gekta?', 'Gekta is specialised agricultural AI for farming and agribusiness, covering crops, livestock, machinery, storage, logistics, economics, documents and related work in one conversation.'], ['How is Gekta different from general-purpose AI?', 'Gekta is oriented around agricultural context, terminology, structured diagnosis, available domain sources and calculations.'], ['Can Gekta assist an agronomist?', 'Yes. It can help analyse crop condition, yield, nutrition, soil, production technology, disease, pests and weeds and identify missing field data.'], ['Is Gekta only for large farms?', 'No. It can be used for enterprises, farms, smallholdings, gardens and home growing.'], ['Can Gekta work with documents and tables?', 'Yes. Supported documents can be attached to a conversation for structured analysis, comparison and discrepancy checking.'], ['Does Gekta use current information?', 'Gekta should not present changing information as current without verification. Verified sources are shown when available; otherwise the limitation is stated.'], ['Does Gekta keep conversation context?', 'Yes. Within a conversation it uses previous messages so the user does not have to repeat the same inputs.'], ['Who created Gekta?', 'Gekta is created by the Prozrachnaya Tsena team as an independent AI product for agriculture and agribusiness.']] as const,
  },
  zh: {
    htmlLang: 'zh-CN',
    brandLine: 'GEKTA · 农业智能',
    h1: 'Gekta — 面向农业生产与农业经营的农业 AI',
    lead: '一个对话覆盖作物、农场、农业机械、仓储、物流、文件与经营经济。用自然语言描述情况，Gekta 会保持上下文、补充关键问题、比较方案并帮助形成明确的下一步。',
    maker: '“透明价格”生态中的独立 AI 产品。',
    placeholder: '询问作物、田块、农场、机械、畜牧、仓储或农业经营问题',
    starters: [
      { label: '种植业', prompt: '冬小麦产量下降可能有哪些原因，应该先检查什么？' },
      { label: '植物保护', prompt: '叶片出现斑点。应检查哪些原因，还需要哪些信息？' },
      { label: '畜牧业', prompt: '如何评估牛群热应激风险，农场应该调整什么？' },
      { label: '农业机械', prompt: '拖拉机油耗增加可能是什么原因，应从哪里开始诊断？' },
      { label: '经营经济', prompt: '计算小麦成本结构，并说明农场可能在哪些环节损失利润。' },
      { label: '仓储', prompt: '如何选择马铃薯储存条件并降低品质损失？' },
    ] as readonly GektaStarter[],
    marketingTitle: '不只是聊天，而是在一个对话中保持农业上下文。',
    marketingText: ['Gekta 面向农业任务设计，能够理解农业术语、延续前文信息、关联事实、帮助检验假设，并清楚解释结论依据。', '同一个对话可以从作物状态转到营养管理，从机械故障转到维修经济，也可以从粮食品质转到仓储、物流和文件，而不要求用户先选择多个独立模块。'],
    valueCards: [['保持上下文', '结合对话过程，不要求反复输入同一组基础信息。'], ['分析原因', '帮助区分症状和可能原因，并安排检查顺序。'], ['给出下一步', '把回答落实为行动、检查、计算或需要补充的数据。'], ['展示来源', '当回答包含已确认来源时，Gekta 会展示信息出处。']] as const,
    capabilityTitle: '从田间到农场经济的农业 AI',
    capabilities: [['种植业与农艺', '分析产量、营养、土壤、轮作、灌溉、胁迫、病虫草害和生产决策。'], ['畜牧业', '分析饲喂、饲养环境、微气候、生产性能、生物安全和经营指标。'], ['农业机械', '诊断故障、比较原因、规划维护，并分析油耗、使用和维修方案。'], ['仓储、质量与物流', '分析干燥、储存条件、产品质量、损耗、运输和运营风险。'], ['经营经济与农业企业', '计算成本、利润和情景，比较生产、储存、销售与投资方案。'], ['文件与计算', '读取、比较和整理支持的文件、表格与计算，发现差异并形成工作结果。']] as const,
    audienceTitle: '面向农业决策者',
    audiences: ['农户', '农艺师', '农场负责人', '工程师与机手', '畜牧技术人员', '仓储与粮库人员', '采购与销售', '物流', '农业企业', '家庭小农场', '园艺种植者'],
    audienceText: 'Gekta 既可以回答家庭种植中的简单问题，也可以处理农场的复杂生产任务。回答深度会随任务变化，从清晰解释到计算、比较、文件和专业检查流程。',
    trustTitle: '事实、假设与风险分开表达',
    trustText: ['Gekta 会区分已知事实与假设，标明缺失数据，并说明结论边界。', '当回答依赖变化信息时，应给出已确认来源；如果无法完成当前确认，Gekta 会明确说明限制，而不是把假设当作事实。'],
    howTitle: '无需复杂菜单，从问题直接到可执行结果',
    how: [['1. 描述情况', '像向专业人员说明一样直接写出问题。'], ['2. Gekta 建立上下文', '结合前文，追问关键缺失数据，并使用可用的来源和工具。'], ['3. 获得清晰结果', '根据任务给出结论、依据、下一步、计算或来源。']] as const,
    principle: '用户无需预先选择“种植业模块”“机械模块”或“经济模块”，Gekta 会根据对话判断上下文。',
    creatorTitle: 'Gekta 由“透明价格”创建',
    creatorText: ['Gekta 是“透明价格”生态中的独立产品。', '“透明价格”建设面向农业市场和真实行业流程的数字基础设施。Gekta 将行业上下文转化为自然语言智能界面，用于问题、文件、数据、计算和决策。'],
    faqTitle: '关于 Gekta 的常见问题',
    faq: [['什么是 Gekta？', 'Gekta 是面向农业生产与农业经营的专业农业 AI，在一个对话中覆盖种植、畜牧、农业机械、仓储、物流、经济和文件等任务。'], ['Gekta 与通用 AI 有什么不同？', 'Gekta 以农业上下文为核心，理解行业术语，并围绕诊断流程、可用行业来源和计算组织回答。'], ['Gekta 可以作为农艺师助手吗？', '可以。它可以帮助分析作物状态、产量、营养、土壤、生产技术、病虫草害，并指出缺失的田间数据。'], ['Gekta 只适合大型农场吗？', '不是。企业、农场、家庭小农场、菜园和园艺种植都可以使用。'], ['Gekta 可以处理文件和表格吗？', '可以。支持的文件可以附加到对话中，用于结构化分析、比较和差异检查。'], ['Gekta 会使用实时信息吗？', '对于不断变化的信息，Gekta 不应在未经确认时把它当作当前事实。存在已确认来源时会展示来源，否则会明确说明限制。'], ['Gekta 会保留对话上下文吗？', '会。在同一对话中，它会结合之前的消息，因此不需要反复输入相同背景。'], ['谁创建了 Gekta？', 'Gekta 由“透明价格”团队创建，是面向农业和农业经营的独立 AI 产品。']] as const,
  },
} as const;

export function getGektaCopy(locale: GektaLocale) {
  return GEKTA_COPY[locale];
}

export function getGektaTopic(slug: string): GektaTopic | undefined {
  return GEKTA_TOPICS.find((topic) => topic.slug === slug);
}
