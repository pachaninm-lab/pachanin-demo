import type { GektaLocale, GektaStarter } from './content';

export type GektaCapabilityGroup = Readonly<{
  /** Short heading for the direction. */
  title: string;
  /** Always-visible one-line summary. Stays in the server HTML. */
  summary: string;
  /** The user problem this direction actually solves. */
  problem: string;
  /** Concrete work items. Rendered inside a disclosure, still in the server HTML. */
  items: readonly string[];
}>;

export type GektaAudienceCard = Readonly<{ role: string; value: string }>;

export type GektaProductCopy = Readonly<{
  ctaLead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  capabilityLead: string;
  capabilityDetailsLabel: string;
  capabilityGroups: readonly GektaCapabilityGroup[];
  examplesTitle: string;
  examplesLead: string;
  examplesMore: string;
  examplesLess: string;
  extraStarters: readonly GektaStarter[];
  audienceLead: string;
  audienceCards: readonly GektaAudienceCard[];
  legalTitle: string;
}>;

const ru: GektaProductCopy = {
  ctaLead: 'Начните с вопроса своими словами — Гекта уточнит недостающее и доведёт разговор до конкретного шага.',
  ctaPrimary: 'Продолжить разговор с Гектой',
  ctaSecondary: 'Перейти в «Прозрачную Цену»',
  capabilityLead: 'Гекта работает с производственными, техническими и экономическими задачами хозяйства в одном разговоре. Ниже — направления, реальные рабочие сценарии и проблема пользователя, которую каждое из них закрывает.',
  capabilityDetailsLabel: 'Что именно можно сделать',
  capabilityGroups: [
    {
      title: 'Растениеводство и агрономия',
      summary: 'Урожайность, состояние культур, почва, питание растений, защита растений, болезни, вредители и сорняки.',
      problem: 'Симптом на поле обычно объясняют одной случайной причиной. Гекта помогает удержать все версии сразу и проверять их по порядку.',
      items: [
        'Разобрать снижение урожайности и отделить симптомы от возможных причин.',
        'Построить последовательность проверки почвы, питания, влаги, посева и фитосанитарного состояния.',
        'Сопоставить фазу развития, погоду, предшественника и технологию с наблюдаемой картиной.',
        'Разобрать признаки болезней, вредителей и сорняков и понять, каких данных не хватает для уверенного вывода.',
        'Сравнить варианты технологического решения и последствия каждого из них.',
      ],
    },
    {
      title: 'Животноводство',
      summary: 'Кормление, условия содержания, микроклимат, продуктивность и технологические показатели.',
      problem: 'Падение продуктивности редко имеет один источник. Гекта помогает разложить его на управляемые факторы.',
      items: [
        'Построить карту вероятных факторов при снижении продуктивности.',
        'Оценить риск теплового стресса, вентиляции, плотности содержания и доступа к воде.',
        'Структурировать данные по рациону, группе животных и динамике показателей.',
        'Сравнить варианты изменения процесса с учётом ограничений хозяйства.',
      ],
    },
    {
      title: 'Сельскохозяйственная техника',
      summary: 'Эксплуатация, обслуживание, диагностика неисправностей и расход топлива.',
      problem: 'Замена узлов «по очереди» стоит денег и простоя. Гекта помогает выстроить проверки от дешёвых к дорогим.',
      items: [
        'Составить диагностическое дерево по симптому и расставить проверки по цене ошибки.',
        'Разобрать рост расхода топлива, перегрев, потерю мощности и другие отклонения.',
        'Подготовить перечень измерений и данных перед обращением в сервис.',
        'Сравнить ремонт, обслуживание и замену узла с учётом простоя и стоимости.',
      ],
    },
    {
      title: 'Хранение, качество и логистика',
      summary: 'Режимы хранения, качество продукции, потери, сушка, перевозка и операционные ограничения.',
      problem: 'Потеря качества замечается поздно. Гекта помогает заранее назначить контрольные точки и признаки вмешательства.',
      items: [
        'Разобрать режим хранения и вероятные причины потери качества.',
        'Назначить контрольные точки по температуре, влажности, вентиляции и состоянию партии.',
        'Сравнить варианты логистики по времени, стоимости, качеству и ограничениям приёмки.',
        'Структурировать расхождения по партии, измерениям и ответственности.',
      ],
    },
    {
      title: 'Экономика хозяйства',
      summary: 'Себестоимость, маржинальность, сценарные расчёты и сравнение вариантов решения.',
      problem: 'Решение «продать или хранить» часто принимается без модели. Гекта собирает расчёт и показывает чувствительность результата.',
      items: [
        'Разложить себестоимость культуры или направления по управляемым статьям.',
        'Посчитать маржу, точку безубыточности и чувствительность к цене, урожайности и затратам.',
        'Сравнить сценарии: продать сейчас, хранить, переработать или изменить технологию.',
        'Подготовить объяснение расчёта для руководителя, партнёра или финансовой организации.',
      ],
    },
    {
      title: 'Документы, таблицы и расчёты',
      summary: 'Структурирование данных, сравнение вариантов, поиск расхождений и проверка расчётов.',
      problem: 'Расхождение между документами и фактом находят вручную и поздно. Гекта помогает сверить данные системно.',
      items: [
        'Сделать структуру документа и выделить существенные для решения условия.',
        'Сравнить несколько наборов данных и перечислить расхождения.',
        'Проверить арифметику, единицы измерения и логику расчёта.',
        'Сформировать таблицу, чек-лист или рабочий материал по результату разбора.',
      ],
    },
    {
      title: 'Как Гекта ведёт разговор',
      summary: 'Многошаговый анализ, работа с контекстом, вложения и подтверждённые источники.',
      problem: 'Обычный чат теряет исходные данные. Гекта удерживает контекст задачи и честно показывает границы вывода.',
      items: [
        'Учитывает предыдущие сообщения, поэтому исходные данные не нужно повторять.',
        'Ведёт многошаговый разбор: уточняет условия, проверяет гипотезы, сравнивает варианты.',
        'Принимает поддерживаемые вложения — документы и таблицы — в пределах заявленных ограничений.',
        'Показывает подтверждённые источники, когда они действительно присутствуют в ответе.',
        'Отмечает недостающие данные и ограничения вместо уверенного предположения.',
      ],
    },
  ],
  examplesTitle: 'Примеры запросов',
  examplesLead: 'Выберите пример, чтобы начать разговор, или задайте Гекте свой вопрос.',
  examplesMore: 'Показать больше примеров',
  examplesLess: 'Свернуть примеры',
  extraStarters: [
    { label: 'Урожайность', prompt: 'Урожайность на поле ниже плановой. Составь порядок проверки причин от самых вероятных к редким.' },
    { label: 'Удобрения', prompt: 'Как спланировать питание культуры по фазам развития и какие данные по почве для этого нужны?' },
    { label: 'Болезни растений', prompt: 'Как отличить болезнь растения от дефицита питания или повреждения по внешним признакам?' },
    { label: 'Сорняки', prompt: 'Составь план борьбы с сорняками в севообороте и объясни, от чего зависит выбор.' },
    { label: 'Севооборот', prompt: 'Помоги оценить севооборот на ближайшие три года с учётом культур, почвы и экономики.' },
    { label: 'Почва', prompt: 'Какие показатели почвы стоит проверить в первую очередь и как читать результаты анализа?' },
    { label: 'Тепловой стресс', prompt: 'Какие признаки теплового стресса у животных и какие измерения подтвердят проблему?' },
    { label: 'Кормление', prompt: 'Как проверить рацион при снижении продуктивности и какие данные нужно собрать?' },
    { label: 'Трактор', prompt: 'Трактор теряет мощность под нагрузкой. Построй порядок диагностики от простых проверок к дорогим.' },
    { label: 'Расход топлива', prompt: 'Расход топлива вырос на 15%. Какие причины проверить и как их разделить между техникой и условиями работы?' },
    { label: 'Хранение зерна', prompt: 'Как организовать контроль зерна при хранении и по каким признакам вмешиваться немедленно?' },
    { label: 'Картофель', prompt: 'Как выбрать режим хранения картофеля и снизить потери качества за сезон?' },
    { label: 'Логистика', prompt: 'Сравни варианты перевозки партии по времени, стоимости и риску потери качества.' },
    { label: 'Себестоимость', prompt: 'Помоги собрать себестоимость по культуре: дай таблицу статей, которые мне нужно заполнить.' },
    { label: 'Маржа', prompt: 'Посчитай маржу и точку безубыточности и покажи чувствительность к цене и урожайности.' },
    { label: 'Документы', prompt: 'Помоги разобрать документ по хозяйству: какие условия существенны для решения и что проверить.' },
    { label: 'Расчёты', prompt: 'Проверь мой расчёт: арифметику, единицы измерения и логику, и объясни найденные ошибки.' },
    { label: 'Сравнение вариантов', prompt: 'Сравни два варианта решения по хозяйству и покажи, какие данные меняют вывод.' },
    { label: 'Подготовка решения', prompt: 'Помоги подготовить решение: собери аргументы, риски, недостающие данные и следующий шаг.' },
  ],
  audienceLead: 'Гекта одинаково естественно принимает простой вопрос и сложную производственную задачу. Глубина ответа меняется вместе с задачей — от понятного объяснения до расчёта, сравнения вариантов и последовательности профессиональных проверок.',
  audienceCards: [
    { role: 'Руководитель / владелец хозяйства', value: 'Экономика, сценарии, риски, сравнение вариантов и подготовка решения.' },
    { role: 'Фермер / КФХ', value: 'Производственные задачи, технология, техника, экономика и практические вопросы хозяйства.' },
    { role: 'Агроном', value: 'Культуры, почва, питание, защита растений и диагностика факторов урожайности.' },
    { role: 'Инженер / механизатор', value: 'Техника, эксплуатация, обслуживание и поиск причин неисправностей.' },
    { role: 'Специалист по животноводству', value: 'Рацион, содержание, микроклимат и продуктивность.' },
    { role: 'Хранение / логистика / коммерческий блок', value: 'Качество, хранение, перевозка, документы, стоимость и сценарии.' },
  ],
  legalTitle: 'Документы и условия',
};

const en: GektaProductCopy = {
  ctaLead: 'Start with a question in your own words — Gekta asks for what is missing and drives the conversation to a concrete step.',
  ctaPrimary: 'Continue with Gekta',
  ctaSecondary: 'Open Prozrachnaya Tsena',
  capabilityLead: 'Gekta works through production, technical and economic farm tasks in one conversation. Below are the directions, the real work behind each of them and the problem each one solves.',
  capabilityDetailsLabel: 'What you can actually do',
  capabilityGroups: [
    {
      title: 'Crops and agronomy',
      summary: 'Yield, crop condition, soil, nutrition, crop protection, disease, pests and weeds.',
      problem: 'A field symptom is usually explained by one random cause. Gekta keeps every version on the table and checks them in order.',
      items: [
        'Work through a yield decline and separate symptoms from possible causes.',
        'Build the order of checks across soil, nutrition, moisture, sowing and plant health.',
        'Match growth stage, weather, previous crop and technology against what is observed.',
        'Work through disease, pest and weed signs and identify the missing data.',
        'Compare production options and the consequences of each.',
      ],
    },
    {
      title: 'Livestock',
      summary: 'Feeding, housing, climate, productivity and production indicators.',
      problem: 'A productivity drop rarely has one source. Gekta breaks it into factors you can act on.',
      items: [
        'Map the likely factors behind a productivity decline.',
        'Assess heat stress, ventilation, stocking density and water access risk.',
        'Structure ration, group and trend data.',
        'Compare process changes against the constraints of the farm.',
      ],
    },
    {
      title: 'Agricultural machinery',
      summary: 'Operation, service, fault diagnosis and fuel consumption.',
      problem: 'Replacing parts one by one costs money and downtime. Gekta orders the checks from cheap to expensive.',
      items: [
        'Build a diagnostic tree from the symptom and order checks by cost of error.',
        'Work through rising fuel use, overheating, power loss and other deviations.',
        'Prepare the measurements and data to bring to a service visit.',
        'Compare repair, service and replacement against downtime and cost.',
      ],
    },
    {
      title: 'Storage, quality and logistics',
      summary: 'Storage regimes, product quality, losses, drying, transport and operational limits.',
      problem: 'Quality loss is noticed late. Gekta sets the control points and intervention signals in advance.',
      items: [
        'Work through the storage regime and the likely causes of quality loss.',
        'Set control points for temperature, humidity, ventilation and batch condition.',
        'Compare logistics options by time, cost, quality and acceptance limits.',
        'Structure discrepancies across batch, measurements and responsibility.',
      ],
    },
    {
      title: 'Farm economics',
      summary: 'Cost structure, margin, scenario calculations and option comparison.',
      problem: 'Sell-or-store decisions are often made without a model. Gekta builds the calculation and shows what the result is sensitive to.',
      items: [
        'Break the cost of a crop or enterprise into controllable items.',
        'Calculate margin, break-even and sensitivity to price, yield and cost.',
        'Compare scenarios: sell now, store, process or change the technology.',
        'Prepare an explanation of the calculation for a manager, partner or lender.',
      ],
    },
    {
      title: 'Documents, tables and calculations',
      summary: 'Structuring data, comparing options, finding discrepancies and checking calculations.',
      problem: 'Discrepancies between documents and reality are found by hand and late. Gekta checks them systematically.',
      items: [
        'Structure a document and surface the terms that matter for the decision.',
        'Compare several data sets and list the discrepancies.',
        'Check arithmetic, units and calculation logic.',
        'Produce a table, checklist or working note from the analysis.',
      ],
    },
    {
      title: 'How Gekta holds a conversation',
      summary: 'Multi-step analysis, conversation context, attachments and verified sources.',
      problem: 'An ordinary chat loses the inputs. Gekta keeps the task context and states the limits of a conclusion.',
      items: [
        'Uses previous messages, so inputs do not have to be repeated.',
        'Runs multi-step analysis: clarifies conditions, tests hypotheses, compares options.',
        'Accepts supported attachments — documents and tables — within the stated limits.',
        'Shows verified sources when they are genuinely present in the answer.',
        'Marks missing data and limitations instead of presenting an assumption as fact.',
      ],
    },
  ],
  examplesTitle: 'Example requests',
  examplesLead: 'Pick an example to start the conversation, or ask Gekta your own question.',
  examplesMore: 'Show more examples',
  examplesLess: 'Hide extra examples',
  extraStarters: [
    { label: 'Yield', prompt: 'Field yield is below plan. Order the possible causes from most to least likely and tell me what to check first.' },
    { label: 'Fertiliser', prompt: 'How should crop nutrition be planned by growth stage, and which soil data is required?' },
    { label: 'Plant disease', prompt: 'How do I tell plant disease apart from a nutrient deficiency or physical damage by visible signs?' },
    { label: 'Weeds', prompt: 'Build a weed control plan across the rotation and explain what the choice depends on.' },
    { label: 'Rotation', prompt: 'Help me assess a three-year rotation against crops, soil and economics.' },
    { label: 'Soil', prompt: 'Which soil indicators should be checked first and how should the analysis be read?' },
    { label: 'Heat stress', prompt: 'What are the signs of heat stress in livestock and which measurements would confirm it?' },
    { label: 'Feeding', prompt: 'How do I check the ration when productivity drops, and what data should I collect?' },
    { label: 'Tractor', prompt: 'A tractor loses power under load. Order the diagnosis from simple checks to expensive ones.' },
    { label: 'Fuel use', prompt: 'Fuel use is up 15%. Which causes should I check and how do I separate machine from operating conditions?' },
    { label: 'Grain storage', prompt: 'How should stored grain be monitored, and which signs require immediate intervention?' },
    { label: 'Potatoes', prompt: 'How should potatoes be stored to reduce quality losses across the season?' },
    { label: 'Logistics', prompt: 'Compare transport options for a batch by time, cost and quality risk.' },
    { label: 'Cost', prompt: 'Help me build a crop cost structure: give me the table of items I need to fill in.' },
    { label: 'Margin', prompt: 'Calculate margin and break-even and show sensitivity to price and yield.' },
    { label: 'Documents', prompt: 'Help me work through a farm document: which terms matter for the decision and what should be checked.' },
    { label: 'Calculations', prompt: 'Check my calculation — arithmetic, units and logic — and explain the errors you find.' },
    { label: 'Option comparison', prompt: 'Compare two options for the farm and show which data would change the conclusion.' },
    { label: 'Decision prep', prompt: 'Help me prepare a decision: arguments, risks, missing data and the next step.' },
  ],
  audienceLead: 'Gekta takes a simple question and a detailed production problem equally naturally. The depth follows the task — from a clear explanation to a calculation, an option comparison or a professional sequence of checks.',
  audienceCards: [
    { role: 'Farm owner / manager', value: 'Economics, scenarios, risks, option comparison and decision preparation.' },
    { role: 'Farmer / family farm', value: 'Production work, technology, machinery, economics and practical farm questions.' },
    { role: 'Agronomist', value: 'Crops, soil, nutrition, crop protection and diagnosis of yield factors.' },
    { role: 'Engineer / machinery operator', value: 'Machinery, operation, service and root-cause search for faults.' },
    { role: 'Livestock specialist', value: 'Ration, housing, climate and productivity.' },
    { role: 'Storage / logistics / commercial', value: 'Quality, storage, transport, documents, cost and scenarios.' },
  ],
  legalTitle: 'Documents and terms',
};

const zh: GektaProductCopy = {
  ctaLead: '用自己的话提出问题即可 — Gekta 会补充缺失信息，并把对话推进到具体的下一步。',
  ctaPrimary: '继续与 Gekta 对话',
  ctaSecondary: '前往“透明价格”',
  capabilityLead: 'Gekta 在同一个对话中处理农场的生产、技术与经营任务。以下是各个方向、真实的工作场景，以及每个方向所解决的实际问题。',
  capabilityDetailsLabel: '具体可以做什么',
  capabilityGroups: [
    {
      title: '种植业与农艺',
      summary: '产量、作物状态、土壤、营养、植物保护、病害、虫害与杂草。',
      problem: '田间症状常被归结为单一偶然原因。Gekta 会同时保留多种可能，并按顺序逐一验证。',
      items: [
        '分析产量下降，把症状与可能原因区分开。',
        '建立土壤、营养、水分、播种与植保状况的检查顺序。',
        '将生育期、天气、前茬与技术方案与观察到的情况相互对照。',
        '分析病害、虫害与杂草特征，并指出缺少哪些数据。',
        '比较不同技术方案及其后果。',
      ],
    },
    {
      title: '畜牧业',
      summary: '饲喂、饲养条件、微气候、生产性能与技术指标。',
      problem: '产能下降很少只有一个原因。Gekta 会把它拆解为可以着手处理的因素。',
      items: [
        '梳理产能下降背后的可能因素。',
        '评估热应激、通风、饲养密度与饮水条件的风险。',
        '整理日粮、畜群与指标变化数据。',
        '结合农场约束条件比较工艺调整方案。',
      ],
    },
    {
      title: '农业机械',
      summary: '使用、维护、故障诊断与油耗。',
      problem: '逐个更换零件既费钱又停机。Gekta 会把检查从便宜到昂贵排序。',
      items: [
        '根据症状建立诊断树，并按出错代价排序检查项。',
        '分析油耗升高、过热、动力下降等异常。',
        '在送修前准备好需要的测量与数据。',
        '结合停机与成本比较维修、保养与更换方案。',
      ],
    },
    {
      title: '仓储、质量与物流',
      summary: '储存条件、产品质量、损耗、干燥、运输与运营限制。',
      problem: '质量损失往往发现得太晚。Gekta 会提前设定控制点与干预信号。',
      items: [
        '分析储存条件与质量损失的可能原因。',
        '设定温度、湿度、通风与批次状态的控制点。',
        '按时间、成本、质量与验收限制比较物流方案。',
        '整理批次、测量与责任方面的差异。',
      ],
    },
    {
      title: '经营经济',
      summary: '成本、利润率、情景测算与方案比较。',
      problem: '“现在卖还是储存”常常没有模型支撑。Gekta 会建立测算并显示结果的敏感性。',
      items: [
        '把作物或业务的成本拆分为可控项目。',
        '计算利润、盈亏平衡点，以及对价格、产量和成本的敏感性。',
        '比较情景：现在出售、储存、加工或调整技术方案。',
        '为管理者、合作方或金融机构准备测算说明。',
      ],
    },
    {
      title: '文件、表格与计算',
      summary: '数据结构化、方案比较、差异查找与计算校验。',
      problem: '文件与实际之间的差异靠人工发现且往往太晚。Gekta 会系统地进行核对。',
      items: [
        '梳理文件结构，突出对决策重要的条款。',
        '比较多组数据并列出差异。',
        '校验算术、计量单位与计算逻辑。',
        '根据分析结果生成表格、检查清单或工作材料。',
      ],
    },
    {
      title: 'Gekta 如何进行对话',
      summary: '多步分析、对话上下文、附件与已确认来源。',
      problem: '普通聊天会丢失原始信息。Gekta 会保持任务上下文，并说明结论的边界。',
      items: [
        '结合前文消息，无需反复输入相同背景。',
        '进行多步分析：澄清条件、检验假设、比较方案。',
        '在声明的限制内接收受支持的附件 — 文件与表格。',
        '当回答中确实存在已确认来源时展示来源。',
        '标明缺失数据与限制，而不是把假设当作事实。',
      ],
    },
  ],
  examplesTitle: '示例请求',
  examplesLead: '选择一个示例开始对话，或直接向 Gekta 提出自己的问题。',
  examplesMore: '显示更多示例',
  examplesLess: '收起示例',
  extraStarters: [
    { label: '产量', prompt: '田块产量低于计划。请按可能性从高到低排列原因，并说明先检查什么。' },
    { label: '肥料', prompt: '如何按生育期规划作物营养？需要哪些土壤数据？' },
    { label: '植物病害', prompt: '如何通过外观特征区分植物病害、营养缺乏与物理损伤？' },
    { label: '杂草', prompt: '请制定轮作中的杂草防治方案，并说明选择依据。' },
    { label: '轮作', prompt: '请结合作物、土壤与经济情况评估未来三年的轮作安排。' },
    { label: '土壤', prompt: '应优先检测哪些土壤指标？分析结果该如何解读？' },
    { label: '热应激', prompt: '牲畜热应激有哪些表现？哪些测量可以确认问题？' },
    { label: '饲喂', prompt: '生产性能下降时如何检查日粮？需要收集哪些数据？' },
    { label: '拖拉机', prompt: '拖拉机负载时动力下降。请按由简到繁的顺序安排诊断。' },
    { label: '油耗', prompt: '油耗上升了 15%。应检查哪些原因？如何区分机械与作业条件的影响？' },
    { label: '粮食储存', prompt: '储粮期间如何组织监测？出现哪些迹象需要立即处理？' },
    { label: '马铃薯', prompt: '如何选择马铃薯储存条件，以降低整季的品质损失？' },
    { label: '物流', prompt: '请按时间、成本与质量风险比较该批次的运输方案。' },
    { label: '成本', prompt: '请帮我建立作物成本结构：先给出我需要填写的项目表。' },
    { label: '利润', prompt: '请计算利润与盈亏平衡点，并显示对价格与产量的敏感性。' },
    { label: '文件', prompt: '请帮我分析一份农场文件：哪些条款对决策重要，还需要核对什么。' },
    { label: '计算', prompt: '请检查我的计算：算术、单位与逻辑，并解释发现的错误。' },
    { label: '方案比较', prompt: '请比较农场的两个方案，并说明哪些数据会改变结论。' },
    { label: '决策准备', prompt: '请帮我准备决策：论据、风险、缺失数据与下一步。' },
  ],
  audienceLead: 'Gekta 既能自然处理简单问题，也能处理复杂的生产任务。回答深度随任务变化 — 从清晰解释到测算、方案比较，或一整套专业检查流程。',
  audienceCards: [
    { role: '农场负责人 / 所有者', value: '经营经济、情景、风险、方案比较与决策准备。' },
    { role: '农户 / 家庭农场', value: '生产任务、技术、机械、经济与日常经营问题。' },
    { role: '农艺师', value: '作物、土壤、营养、植物保护与产量因素诊断。' },
    { role: '工程师 / 机手', value: '机械、使用、维护与故障原因排查。' },
    { role: '畜牧技术人员', value: '日粮、饲养、微气候与生产性能。' },
    { role: '仓储 / 物流 / 商务', value: '质量、储存、运输、文件、成本与情景。' },
  ],
  legalTitle: '文件与条款',
};

const PRODUCT_COPY: Record<GektaLocale, GektaProductCopy> = { ru, en, zh };

export function getGektaProductCopy(locale: GektaLocale): GektaProductCopy {
  return PRODUCT_COPY[locale];
}
