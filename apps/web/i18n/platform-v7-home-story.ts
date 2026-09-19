type WidenCopy<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly WidenCopy<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: WidenCopy<T[Key]> }
      : T;

const copies = {
  ru: {
    nav: {
      difference: 'Отличия',
      functions: 'Возможности',
      deal: 'Сделка в работе',
      roles: 'Для участников',
      tai: 'Гекта',
      trust: 'Доверие',
    },
    heroDeal: {
      sampleLabel: 'Вымышленный пример Сделки',
      product: 'Пшеница · 1 200 тонн',
      route: 'Краснодарский край → Ростовская область',
      status: 'Контекст примера',
      stageLabel: 'Этап Сделки',
      stage: 'Приёмка и качество',
      deviationLabel: 'Отклонение',
      deviation: 'Показатель белка ниже условия договора',
      ownerLabel: 'Ответственный',
      owner: 'Покупатель',
      actionLabel: 'Следующий шаг',
      action: 'Подтвердить пересчёт или открыть разногласие',
      settlementLabel: 'Основание расчёта',
      settlement: 'Требует решения участника',
      proof: 'Действия, документы и решения сохраняются в единой истории Сделки.',
    },
    proof: [
      { label: 'Одна Сделка', text: 'Все события связаны с одной историей исполнения' },
      { label: 'Ролевые действия', text: 'Каждый участник видит только относящиеся к нему данные и действия' },
      { label: 'Проверяемые основания', text: 'Решение связано с участником, источником и основанием' },
      { label: 'Гекта внутри процесса', text: 'ИИ объясняет факты и риск, но не подменяет полномочия' },
    ],
    difference: {
      eyebrow: 'Ключевое отличие',
      title: 'Маркетплейс помогает договориться. Прозрачная Цена помогает исполнить',
      lead: 'Сравнивается модель продукта, а не конкретный конкурент. Работа не заканчивается после выбора контрагента и цены.',
      headers: ['Критерий', 'Типичный каталог / marketplace', 'Прозрачная Цена'],
      rows: [
        { criterion: 'Главный результат', typical: 'Контакт сторон и согласованные условия.', platform: 'Исполненная и закрытая Сделка с проверяемой историей.' },
        { criterion: 'Объект управления', typical: 'Объявление, заявка или заказ.', platform: 'Условия, роли, события, документы и решения одной Сделки.' },
        { criterion: 'После цены', typical: 'Переход в почту, таблицы и внешние системы.', platform: 'Поставка, приёмка, качество, документы, спор и расчётные основания продолжаются в одном процессе.' },
        { criterion: 'Ответственность', typical: 'Часто определяется вне системы.', platform: 'Отклонение связано с ответственным, основанием, сроком и допустимым действием.' },
        { criterion: 'ИИ', typical: 'Поиск, рекомендации или общий чат.', platform: 'Гекта анализирует конкретную Сделку, источники и ролевые ограничения.' },
        { criterion: 'Доказательства', typical: 'Переписка и отдельные файлы.', platform: 'Версии, события, решения и основания связаны с одной Сделкой.' },
      ],
      boundary: 'Платформа не заявляет, что заменяет ERP, банк, лабораторию или логистическую систему. Она связывает относящиеся к Сделке данные и действия только через определённые источники и полномочия.',
      moreLabel: 'Показать все отличия',
    },
    functions: {
      eyebrow: 'Возможности платформы',
      title: 'Ключевые задачи агросделки — в одной рабочей системе',
      lead: 'Функции связаны не с каталогом модулей, а с результатом исполнения одной Сделки.',
      items: [
        { index: '01', title: 'Цена', text: 'Предложения, допуск и торги.', result: 'Коммерческие условия зафиксированы в истории Сделки.' },
        { index: '02', title: 'Сделка', text: 'Договор, роли, версии условий и полномочия.', result: 'Понятны обязанности каждого участника.' },
        { index: '03', title: 'Поставка', text: 'Заявка, транспорт, маршрут, водитель и контрольные точки.', result: 'События движения партии связаны со Сделкой.' },
        { index: '04', title: 'Приёмка', text: 'Вес, качество, лаборатория, расхождения и повторные проверки.', result: 'Фактическое исполнение сопоставлено с условиями.' },
        { index: '05', title: 'Документы', text: 'Связь документа с событием и партией, версии, комплектность и подписи.', result: 'Основание не теряется в переписке.' },
        { index: '06', title: 'Деньги', text: 'Финансовый сценарий, удержания, частичные расчёты, возвраты и сверка.', result: 'Видно, какие основания позволяют или блокируют финансовое действие.' },
        { index: '07', title: 'Спор', text: 'Позиции сторон, доказательства, сроки и решение.', result: 'Спор рассматривается по одной версии фактов.' },
        { index: '08', title: 'Контроль', text: 'Гекта, аналитика, API, ERP/1С, логистика, лаборатория и финансы.', result: 'Внешние данные связываются со Сделкой по источнику и полномочиям.' },
      ],
      summaryTitle: 'Одна Сделка связывает функции между собой',
      summaryText: 'Событие в поставке меняет приёмку, документы, риск, доступное действие и расчётные основания.',
      moreLabel: 'Показать все возможности',
      resultLabel: 'Результат',
    },
    process: {
      eyebrow: 'Путь Сделки',
      title: 'После согласования условий — связанное исполнение',
      lead: 'Пользователю видны текущая задача, основание перехода, ответственный и следующий шаг.',
      phases: [
        { index: '01', title: 'Условия', text: 'Товар, объём, качество, базис и допуск.', result: 'Есть основание перейти к выбору стороны.' },
        { index: '02', title: 'Выбор стороны', text: 'Предложения, торги и фиксация цены.', result: 'Коммерческие условия согласованы.' },
        { index: '03', title: 'Обязательства', text: 'Договор, участники, документы и финансовый сценарий.', result: 'Есть основание перейти к исполнению.' },
        { index: '04', title: 'Поставка', text: 'Транспорт, маршрут, рейс и события.', result: 'Факты поставки связаны с партией.' },
        { index: '05', title: 'Приёмка', text: 'Вес, качество, лаборатория и решения по расхождениям.', result: 'Фактическое исполнение сопоставлено с условиями.' },
        { index: '06', title: 'Расчёт и закрытие', text: 'Расчётные основания, удержания, спор и завершение обязательств.', result: 'Финансовый результат и закрытие связаны с историей исполнения.' },
      ],
      fullPathLabel: 'Полная модель',
      fullPathText: 'Условия → контрагент → договор → поставка → приёмка и качество → документы → расчёт → исключения → закрытие.',
      moreLabel: 'Показать все фазы',
      resultLabel: 'Результат фазы',
      stagesLabel: 'Показать подробный путь',
    },
    demo: {
      eyebrow: 'Сделка в работе',
      title: 'Один процесс показывает норму, отклонение и спор',
      lead: 'Смена ситуации обновляет факты, ответственного, допустимые действия и расчётные основания. Ниже — вымышленный пример.',
      statesLabel: 'Ситуация Сделки',
      roleLabel: 'Перспектива',
      role: 'Покупатель',
      stageLabel: 'Этапы Сделки',
      stages: ['Условия', 'Выбор стороны', 'Обязательства', 'Поставка', 'Приёмка', 'Расчёт и закрытие'],
      states: [
        {
          key: 'normal',
          tab: 'Норма',
          status: 'Факты примера',
          title: 'Поставка соответствует условиям примера',
          summary: 'Вес, качество и документы в вымышленном примере соответствуют заданным условиям.',
          kpis: [
            { label: 'Вес', value: '1 200,4 т · данные примера' },
            { label: 'Белок', value: '12,1% · в допуске примера' },
            { label: 'Документы', value: 'Основания собраны' },
          ],
          events: [
            { meta: 'Сегодня, 09:42', title: 'Факт приёмки', text: 'Вес и партия связаны с актом приёмки в примере.' },
            { meta: 'Сегодня, 09:51', title: 'Получен лабораторный протокол', text: 'Результат сопоставлен с версией условий.' },
            { meta: 'Сегодня, 10:03', title: 'Расчётные основания собраны', text: 'События, документы и полномочия находятся в одном контексте.' },
          ],
          actionTitle: 'Основание перед финансовым действием',
          actionText: 'Финансовое действие выполняется только уполномоченным участником или внешней системой при наличии соответствующего источника, прав и основания.',
          actionCta: 'Открыть основания',
        },
        {
          key: 'deviation',
          tab: 'Отклонение',
          status: 'Нужно решение участника',
          title: 'Показатель качества ниже условия',
          summary: 'Белок 11,2% при договорном минимуме 12,0%. Протокол и версия условий сопоставлены.',
          kpis: [
            { label: 'Отклонение', value: '−0,8 п.п.' },
            { label: 'Ответственный', value: 'Покупатель' },
            { label: 'Основание расчёта', value: 'Нужно решение участника' },
          ],
          events: [
            { meta: 'Сегодня, 10:04', title: 'Получен протокол №318', text: 'Результат связан с пробой и партией.' },
            { meta: 'Сегодня, 10:06', title: 'Гекта сопоставила условия', text: 'Показаны отклонение, источник и недостающий шаг.' },
            { meta: 'Срок: сегодня', title: 'Доступны варианты действия', text: 'Пересчёт, повторная проверка или открытие разногласия.' },
          ],
          actionTitle: 'Решение остаётся за покупателем',
          actionText: 'Гекта не меняет договор и не разрешает финансовое действие самостоятельно.',
          actionCta: 'Посмотреть варианты',
        },
        {
          key: 'dispute',
          tab: 'Спор / нет данных',
          status: 'Источники конфликтуют',
          title: 'Источники противоречат друг другу',
          summary: 'Две версии протокола содержат разные результаты; для выбора основания не хватает данных.',
          kpis: [
            { label: 'Версии', value: '2 протокола' },
            { label: 'Что не хватает', value: 'Основание выбора версии' },
            { label: 'Основание расчёта', value: 'Финансовое действие остановлено' },
          ],
          events: [
            { meta: 'Сегодня, 10:07', title: 'Обнаружен конфликт версий', text: 'Оба источника остаются видимыми в истории примера.' },
            { meta: 'Сегодня, 10:08', title: 'Гекта воздержалась от вывода', text: 'Показаны источники конфликта и недостающие данные.' },
            { meta: 'Срок: завтра', title: 'Нужна процедура разногласия', text: 'Определены стороны, срок и перечень доказательств.' },
          ],
          actionTitle: 'Финансовое действие ждёт разрешения спора',
          actionText: 'Система сохраняет позиции и доказательства, но не выносит решение автоматически.',
          actionCta: 'Открыть спор',
        },
      ],
      openDeal: 'Открыть полный сценарий Сделки',
    },
    roles: {
      eyebrow: 'Одна платформа для всех',
      title: 'Одна версия фактов — разные задачи и полномочия',
      lead: 'Каждый участник видит ту же Сделку, но только свои данные, ответственность и допустимые действия.',
      groups: [
        { title: 'Продавец', subroles: 'Производитель · торговый дом', see: 'Путь партии, документы и расчётные основания.', do: 'Передаёт документ, отвечает на отклонение и подтверждает свою позицию.', get: 'Проверяемое объяснение наличия или отсутствия расчётного основания.' },
        { title: 'Покупатель', subroles: 'Закупщик · переработчик · агрохолдинг', see: 'Поставку, качество, документы и последствия отклонения.', do: 'Принимает результат, запрашивает проверку, подтверждает пересчёт или открывает спор.', get: 'Контролируемую приёмку и защиту от финансового действия без основания.' },
        { title: 'Исполнение', subroles: 'Логист · водитель · элеватор · лаборатория · сюрвейер', see: 'Свои рейсы, точки контроля, документы и исключения.', do: 'Подтверждает событие, передаёт протокол или сообщает отклонение.', get: 'Ясную ответственность и доказательство выполнения.' },
        { title: 'Контроль и финансы', subroles: 'Банк · сотрудник платформы', see: 'Риск, источник, историю решения и границы полномочий.', do: 'Проверяет, эскалирует или действует в пределах собственных полномочий.', get: 'Управляемые исключения и проверяемое основание действия.' },
      ],
      benefits: [
        { title: 'Скорость', text: 'Меньше ручных переходов между почтой, таблицами и кабинетами.' },
        { title: 'Деньги', text: 'Видно, какие основания позволяют или блокируют финансовое действие.' },
        { title: 'Риск', text: 'Отклонение связано с источником до необратимого действия.' },
        { title: 'Контроль', text: 'Понятно, кто, когда, почему и в пределах каких полномочий действовал.' },
      ],
      scenarioTitle: 'Проверьте одну Сделку с позиции конкретной роли',
      scenarioLead: 'Девять публичных ролей используют общую версию фактов; переключение меняет объяснение, а не полномочия.',
      labels: { see: 'Что видит', do: 'Что делает', get: 'Что получает' },
    },
    tai: {
      eyebrow: 'Гекта · аграрный интеллект',
      title: 'Гекта — интеллектуальный слой конкретной Сделки',
      lead: 'Она понимает роли, этапы, документы и правила платформы. Ответ разделяет факт, вывод, риск и недостающие данные.',
      capabilities: [
        { title: 'Эксперт по платформе', text: 'Объясняет процесс, роль, доступное действие и ограничения.' },
        { title: 'Анализ Сделки', text: 'Находит отклонение, зависимость, ответственного и влияние.' },
        { title: 'Документы и качество', text: 'Сопоставляет договор, версии, протоколы и события.' },
        { title: 'Риски и следующий шаг', text: 'Показывает варианты и воздерживается при нехватке данных.' },
      ],
      principles: ['Показывает источник и недостающие данные.', 'Работает только в пределах прав текущей роли.', 'Не меняет Сделку и не действует без подтверждения.'],
      analysisLabel: 'Гекта · анализ Сделки',
      state: 'Доступные факты · вымышленный сценарий',
      rows: [
        { label: 'Факт', value: 'Протокол лаборатории: белок 11,2%. Договор: не менее 12,0%.' },
        { label: 'Вывод', value: 'Результат не соответствует условию приёмки по текущей версии договора.' },
        { label: 'Риск', value: 'Расчётное основание требует решения уполномоченного участника.' },
        { label: 'Следующий шаг', value: 'Покупателю: пересчёт, повторная проверка или открытие разногласия.' },
      ],
      sources: ['Договор · версия 4', 'Протокол №318 · версия 2', 'Событие приёмки'],
      limit: 'Граница: Гекта не определяет качество вместо лаборатории, не меняет договор, не разрешает платёж и не выносит юридическое решение.',
      cta: 'Посмотреть Гекту в работе',
      sourcesLabel: 'Источники',
    },
    trust: {
      eyebrow: 'Доверие и контроль',
      title: 'Публичные границы без технического тумана',
      lead: 'Пользователь видит, кто имеет доступ, кто может действовать, как сохраняются основания и как внешний факт связывается с источником.',
      items: [
        { title: 'Ролевой доступ', text: 'Участник видит только относящиеся к нему данные и действия.' },
        { title: 'Проверяемая история', text: 'Решения, основания и версии сохраняются в Сделке.' },
        { title: 'Внешние источники', text: 'Данные внешней системы не подменяются внутренним предположением.' },
        { title: 'Границы полномочий', text: 'Гекта и внешняя система не действуют вместо участника без соответствующих прав и основания.' },
      ],
      integrationTitle: 'Границы внешних систем',
      statusBadge: 'Источник обязателен',
      headers: ['Система', 'Сценарий', 'Граница', 'Основание'],
      integrations: [
        { system: 'ERP / 1С', scenario: 'Данные Сделки и документы', boundary: 'Маршрут обмена определяется для организации', status: 'Источник и права определяются для организации' },
        { system: 'Логистика', scenario: 'Рейс и события перевозки', boundary: 'Логистическая система остаётся источником факта', status: 'Событие приходит из разрешённого источника' },
        { system: 'Лаборатория', scenario: 'Протокол качества', boundary: 'Гекта не заменяет измерение и подпись лаборатории', status: 'Протокол требует собственного источника и подписи' },
        { system: 'Банк', scenario: 'События финансового сценария', boundary: 'Финансовое действие выполняет только уполномоченная сторона или система', status: 'Финансовое событие требует внешнего основания' },
      ],
      metrics: [
        { value: '9', label: 'публичных ролей одной Сделки' },
        { value: '7', label: 'понятных шагов публичного пути' },
        { value: '3', label: 'языка публичного интерфейса' },
      ],
      architectureNote: 'Архитектурные границы, внешние системы и эксплуатационные утверждения описываются только по проверяемым материалам.',
      ladderTitle: 'Как читаются публичные утверждения',
      ladder: ['Функция', 'Источник', 'Основание', 'Действие', 'Результат', 'История'],
      publicationRule: 'Каждое внешнее утверждение требует собственного источника; возможность платформы не означает действие внешней системы.',
      cta: 'Открыть центр доверия',
    },
    faq: {
      eyebrow: 'Коротко о главном',
      title: 'Частые вопросы',
      items: [
        { question: 'Это marketplace или система исполнения?', answer: 'Платформа включает согласование условий, но её ключевая задача — провести Сделку через поставку, качество, документы, исключения, расчётные основания и закрытие.' },
        { question: 'Нужно ли заменять 1С и другие системы?', answer: 'Нет. Прозрачная Цена связывает относящиеся к Сделке данные существующих систем только через разрешённые источники и маршруты обмена.' },
        { question: 'Кто принимает окончательные решения?', answer: 'Уполномоченный участник. Действие внешней системы учитывается только при наличии соответствующего источника, прав и основания; Гекта объясняет, но не подменяет полномочия.' },
        { question: 'Как начинают работу участники?', answer: 'Сначала регистрация и проверка организации. Маршруты обмена с внешними системами определяются отдельно, когда они нужны конкретному сценарию.' },
      ],
    },
  },
  en: {
    nav: { difference: 'Why it is different', functions: 'Capabilities', deal: 'Deal in action', roles: 'For participants', tai: 'Gekta', trust: 'Trust' },
    heroDeal: {
      sampleLabel: 'Fictional Deal example', product: 'Wheat · 1,200 tonnes', route: 'Krasnodar Krai → Rostov Oblast', status: 'Example context', stageLabel: 'Deal stage', stage: 'Acceptance and quality', deviationLabel: 'Deviation', deviation: 'Protein result is below the contract requirement', ownerLabel: 'Responsible party', owner: 'Buyer', actionLabel: 'Next step', action: 'Confirm recalculation or open a discrepancy', settlementLabel: 'Settlement basis', settlement: 'Requires participant decision', proof: 'Actions, documents and decisions remain in one verifiable Deal history.'
    },
    proof: [
      { label: 'One Deal', text: 'Every event stays linked to one execution history' },
      { label: 'Role actions', text: 'Each participant sees only relevant data and actions' },
      { label: 'Traceable grounds', text: 'Each decision is tied to a participant, source and basis' },
      { label: 'Gekta in the process', text: 'AI explains facts and risk without taking over authority' },
    ],
    difference: {
      eyebrow: 'Key difference', title: 'A marketplace helps parties agree. Transparent Price helps them execute', lead: 'This compares product models, not a named competitor. Work does not stop after a counterparty and price are selected.', headers: ['Criterion', 'Typical catalogue / marketplace', 'Transparent Price'],
      rows: [
        { criterion: 'Primary outcome', typical: 'Contact between parties and agreed terms.', platform: 'An executed and closed Deal with a verifiable history.' },
        { criterion: 'Managed object', typical: 'Listing, request or order.', platform: 'Terms, roles, events, documents and decisions of one Deal.' },
        { criterion: 'After price selection', typical: 'Work moves to email, spreadsheets and external systems.', platform: 'Delivery, acceptance, quality, documents, dispute and settlement grounds continue in one process.' },
        { criterion: 'Accountability', typical: 'Often established outside the system.', platform: 'A deviation is tied to its owner, evidence, deadline and permitted action.' },
        { criterion: 'AI', typical: 'Search, recommendations or a general chat.', platform: 'Gekta analyses a specific Deal, sources and role constraints.' },
        { criterion: 'Evidence', typical: 'Messages and separate files.', platform: 'Versions, events, decisions and supporting grounds stay linked to one Deal.' },
      ],
      boundary: 'The platform does not claim to replace ERP, banking, laboratory or logistics systems. It links Deal-related data and actions only through defined sources and authority.', moreLabel: 'Show all differences'
    },
    functions: {
      eyebrow: 'Platform capabilities', title: 'Critical agricultural Deal tasks in one operating system', lead: 'Capabilities are organised around the execution outcome of one Deal rather than a catalogue of modules.',
      items: [
        { index: '01', title: 'Price', text: 'Offers, admission rules and bidding.', result: 'Commercial terms are recorded in the Deal history.' },
        { index: '02', title: 'Deal', text: 'Contract, roles, term versions and authority.', result: 'Each participant has clear obligations.' },
        { index: '03', title: 'Delivery', text: 'Request, transport, route, driver and control points.', result: 'Lot movement events are linked to the Deal.' },
        { index: '04', title: 'Acceptance', text: 'Weight, quality, laboratory, discrepancies and rechecks.', result: 'Actual execution is compared with the terms.' },
        { index: '05', title: 'Documents', text: 'Links to events and lots, versions, completeness and signatures.', result: 'Evidence is not lost in correspondence.' },
        { index: '06', title: 'Money', text: 'Financial scenario, holds, partial settlement, returns and reconciliation.', result: 'It is clear which grounds allow or block a financial action.' },
        { index: '07', title: 'Dispute', text: 'Party positions, evidence, deadlines and decisions.', result: 'The dispute is reviewed against one version of facts.' },
        { index: '08', title: 'Control', text: 'Gekta, analytics, API, ERP/1C, logistics, laboratories and finance.', result: 'External data is linked to the Deal by source and authority.' },
      ],
      summaryTitle: 'One Deal connects all capabilities', summaryText: 'A delivery event changes acceptance, documents, risk, the permitted action and settlement grounds.', moreLabel: 'Show all capabilities', resultLabel: 'Outcome'
    },
    process: {
      eyebrow: 'Deal path', title: 'Connected execution after terms are agreed', lead: 'The current task, transition basis, responsible party and next step remain visible.',
      phases: [
        { index: '01', title: 'Terms', text: 'Product, volume, quality, basis and tolerance.', result: 'There is a basis to select a party.' },
        { index: '02', title: 'Party selection', text: 'Offers, bidding and price fixation.', result: 'Commercial terms are agreed.' },
        { index: '03', title: 'Obligations', text: 'Contract, participants, documents and financial scenario.', result: 'There is a basis to move into execution.' },
        { index: '04', title: 'Delivery', text: 'Transport, route, trip and events.', result: 'Delivery facts are linked to the lot.' },
        { index: '05', title: 'Acceptance', text: 'Weight, quality, laboratory and discrepancy decisions.', result: 'Actual execution is compared with the terms.' },
        { index: '06', title: 'Settlement and closure', text: 'Settlement grounds, holds, dispute and completion of obligations.', result: 'The financial result and closure stay linked to execution history.' },
      ],
      fullPathLabel: 'Complete model', fullPathText: 'Terms → counterparty → contract → delivery → acceptance and quality → documents → settlement → exceptions → closure.', moreLabel: 'Show all phases', resultLabel: 'Phase outcome', stagesLabel: 'Show the detailed journey'
    },
    demo: {
      eyebrow: 'Deal in action', title: 'One process shows normal execution, a deviation and a dispute', lead: 'Changing the situation updates facts, the responsible party, permitted actions and settlement grounds. The data below is fictional.', statesLabel: 'Deal situation', roleLabel: 'Perspective', role: 'Buyer', stageLabel: 'Deal stages', stages: ['Terms', 'Party selection', 'Obligations', 'Delivery', 'Acceptance', 'Settlement and closure'],
      states: [
        { key: 'normal', tab: 'Normal', status: 'Example facts', title: 'Delivery matches the example terms', summary: 'Weight, quality and documents in the fictional example match the defined terms.', kpis: [{ label: 'Weight', value: '1,200.4 t · example data' }, { label: 'Protein', value: '12.1% · within example tolerance' }, { label: 'Documents', value: 'Grounds assembled' }], events: [{ meta: 'Today, 09:42', title: 'Acceptance fact', text: 'Weight and lot are linked to the example acceptance act.' }, { meta: 'Today, 09:51', title: 'Laboratory protocol received', text: 'The result is compared with the terms version.' }, { meta: 'Today, 10:03', title: 'Settlement grounds assembled', text: 'Events, documents and authority share one context.' }], actionTitle: 'Basis before a financial action', actionText: 'A financial action is performed only by an authorised participant or external system when the corresponding source, rights and basis exist.', actionCta: 'Open grounds' },
        { key: 'deviation', tab: 'Deviation', status: 'Participant decision needed', title: 'Quality result is below the requirement', summary: 'Protein is 11.2% against a contractual minimum of 12.0%. The protocol and terms version have been compared.', kpis: [{ label: 'Deviation', value: '−0.8 pp' }, { label: 'Responsible party', value: 'Buyer' }, { label: 'Settlement basis', value: 'Participant decision needed' }], events: [{ meta: 'Today, 10:04', title: 'Protocol No. 318 received', text: 'The result is linked to the sample and lot.' }, { meta: 'Today, 10:06', title: 'Gekta compared the terms', text: 'The deviation, source and missing step are shown.' }, { meta: 'Due today', title: 'Action options available', text: 'Recalculation, recheck or opening a discrepancy.' }], actionTitle: 'The decision remains with the buyer', actionText: 'Gekta does not change the contract or authorise a financial action by itself.', actionCta: 'Review options' },
        { key: 'dispute', tab: 'Dispute / missing data', status: 'Sources conflict', title: 'Sources contradict each other', summary: 'Two protocol versions contain different results; more evidence is needed to select a basis.', kpis: [{ label: 'Versions', value: '2 protocols' }, { label: 'Missing', value: 'Basis for selecting the version' }, { label: 'Settlement basis', value: 'Financial action paused' }], events: [{ meta: 'Today, 10:07', title: 'Version conflict detected', text: 'Both sources remain visible in the example history.' }, { meta: 'Today, 10:08', title: 'Gekta abstained', text: 'Conflicting sources and missing data are shown.' }, { meta: 'Due tomorrow', title: 'Discrepancy procedure needed', text: 'Parties, deadline and required evidence are identified.' }], actionTitle: 'Financial action waits for dispute resolution', actionText: 'The system retains positions and evidence but does not make the decision automatically.', actionCta: 'Open dispute' },
      ],
      openDeal: 'Open the complete Deal scenario'
    },
    roles: {
      eyebrow: 'One platform for every participant', title: 'One version of facts — different tasks and authority', lead: 'Every participant sees the same Deal, but only their own data, responsibilities and permitted actions.',
      groups: [
        { title: 'Seller', subroles: 'Producer · trading house', see: 'Lot path, documents and settlement grounds.', do: 'Submits a document, responds to a deviation and confirms its position.', get: 'A traceable explanation of whether settlement grounds exist.' },
        { title: 'Buyer', subroles: 'Procurement · processor · agribusiness group', see: 'Delivery, quality, documents and deviation consequences.', do: 'Accepts the result, requests a check, confirms recalculation or opens a dispute.', get: 'Controlled acceptance and protection from a financial action without grounds.' },
        { title: 'Execution', subroles: 'Logistics · driver · elevator · laboratory · surveyor', see: 'Their trips, control points, documents and exceptions.', do: 'Confirms an event, submits a protocol or reports a deviation.', get: 'Clear accountability and proof of execution.' },
        { title: 'Control and finance', subroles: 'Bank · platform employee', see: 'Risk, source, decision history and authority boundaries.', do: 'Reviews, escalates or acts within its own authority.', get: 'Governed exceptions and a traceable basis for action.' },
      ],
      benefits: [{ title: 'Speed', text: 'Fewer manual hand-offs between email, spreadsheets and separate portals.' }, { title: 'Money', text: 'It is clear which grounds allow or block a financial action.' }, { title: 'Risk', text: 'A deviation is linked to its source before an irreversible action.' }, { title: 'Control', text: 'It is clear who acted, when, why and within which authority.' }],
      scenarioTitle: 'Review one Deal from a specific role', scenarioLead: 'Nine public roles use one version of facts; switching changes the explanation, not authority.', labels: { see: 'What they see', do: 'What they do', get: 'What they gain' }
    },
    tai: {
      eyebrow: 'Gekta · agricultural intelligence', title: 'Gekta is the intelligence layer of a specific Deal', lead: 'It understands platform roles, stages, documents and rules. Its answer separates facts, conclusions, risks and missing data.', capabilities: [{ title: 'Platform expert', text: 'Explains the process, role, permitted action and limitations.' }, { title: 'Deal analysis', text: 'Finds a deviation, dependency, responsible party and impact.' }, { title: 'Documents and quality', text: 'Matches contract terms, versions, protocols and events.' }, { title: 'Risks and next step', text: 'Shows options and abstains when data is insufficient.' }], principles: ['Shows the source and missing data.', 'Works only within the current role’s permissions.', 'Does not change the Deal or act without confirmation.'], analysisLabel: 'Gekta · Deal analysis', state: 'Available facts · fictional scenario', rows: [{ label: 'Fact', value: 'Laboratory protocol: protein 11.2%. Contract: minimum 12.0%.' }, { label: 'Conclusion', value: 'The result does not meet the acceptance term in the current contract version.' }, { label: 'Risk', value: 'The settlement basis requires an authorised participant decision.' }, { label: 'Next step', value: 'Buyer: recalculate, request a recheck or open a discrepancy.' }], sources: ['Contract · version 4', 'Protocol No. 318 · version 2', 'Acceptance event'], limit: 'Boundary: Gekta does not determine quality instead of the laboratory, change the contract, authorise payment or make a legal decision.', cta: 'Explore Gekta', sourcesLabel: 'Sources'
    },
    trust: {
      eyebrow: 'Trust and control', title: 'Public boundaries without technical fog', lead: 'Users can see who has access, who may act, how grounds are retained and how an external fact is linked to its source.', items: [{ title: 'Role-based access', text: 'A participant sees only relevant data and actions.' }, { title: 'Traceable history', text: 'Decisions, grounds and versions remain in the Deal.' }, { title: 'External sources', text: 'External-system data is not replaced by an internal assumption.' }, { title: 'Authority boundaries', text: 'Gekta and external systems do not act instead of a participant without the corresponding rights and basis.' }], integrationTitle: 'External-system boundaries', statusBadge: 'Source required', headers: ['System', 'Scenario', 'Boundary', 'Basis'], integrations: [{ system: 'ERP / 1C', scenario: 'Deal data and documents', boundary: 'The exchange route is defined for the organisation', status: 'Source and rights are defined for the organisation' }, { system: 'Logistics', scenario: 'Trip and transport events', boundary: 'The logistics system remains the source of the fact', status: 'The event comes from an authorised source' }, { system: 'Laboratory', scenario: 'Quality protocol', boundary: 'Gekta does not replace measurement or laboratory signature', status: 'The protocol requires its own source and signature' }, { system: 'Bank', scenario: 'Financial-scenario events', boundary: 'A financial action is performed only by an authorised party or system', status: 'A financial event requires an external basis' }], metrics: [{ value: '9', label: 'public roles in one Deal' }, { value: '7', label: 'clear steps in the public journey' }, { value: '3', label: 'public interface languages' }], architectureNote: 'Architecture boundaries, external systems and operational claims are described only from reviewable evidence.', ladderTitle: 'How public claims are read', ladder: ['Capability', 'Source', 'Basis', 'Action', 'Result', 'History'], publicationRule: 'Every external claim requires its own source; a platform capability does not mean an external system performed an action.', cta: 'Open Trust Center'
    },
    faq: {
      eyebrow: 'The essentials', title: 'Frequently asked questions', items: [{ question: 'Is this a marketplace or an execution system?', answer: 'The platform includes agreement of terms, but its primary task is to carry the Deal through delivery, quality, documents, exceptions, settlement grounds and closure.' }, { question: 'Do we need to replace 1C and other systems?', answer: 'No. Transparent Price links Deal-related data from existing systems only through authorised sources and exchange routes.' }, { question: 'Who makes final decisions?', answer: 'An authorised participant. An external-system action is considered only when the corresponding source, rights and basis exist; Gekta explains but does not take over authority.' }, { question: 'How do participants start?', answer: 'Registration and organisation verification come first. External-system exchange routes are defined separately when a specific workflow needs them.' }]
    },
  },
  zh: {
    nav: { difference: '产品差异', functions: '平台能力', deal: '交易运行', roles: '参与方价值', tai: 'Gekta', trust: '信任' },
    heroDeal: { sampleLabel: '虚构交易示例', product: '小麦 · 1,200 吨', route: '克拉斯诺达尔边疆区 → 罗斯托夫州', status: '示例上下文', stageLabel: '交易阶段', stage: '验收与质量', deviationLabel: '偏差', deviation: '蛋白质指标低于合同要求', ownerLabel: '责任方', owner: '买方', actionLabel: '下一步', action: '确认重算或发起异议', settlementLabel: '结算依据', settlement: '需要参与方决定', proof: '操作、文件与决定保存在同一笔交易的可核验历史中。' },
    proof: [{ label: '同一笔交易', text: '所有事件都关联到同一履约历史' }, { label: '角色操作', text: '每个参与方只看到与自己相关的数据和操作' }, { label: '可追溯依据', text: '每项决定都关联参与方、来源和依据' }, { label: '流程内的 Gekta', text: 'AI 解释事实和风险，但不取代参与方权限' }],
    difference: { eyebrow: '核心差异', title: '撮合平台帮助达成约定，“透明价格”帮助完成履约', lead: '这里比较的是产品模式，而不是某个具体竞争者。选定交易对手和价格之后，工作并未结束。', headers: ['标准', '典型目录 / 撮合平台', '透明价格'], rows: [{ criterion: '主要结果', typical: '双方建立联系并达成条件。', platform: '交易完成并关闭，且具有可核验历史。' }, { criterion: '管理对象', typical: '信息、申请或订单。', platform: '同一笔交易的条件、角色、事件、文件与决定。' }, { criterion: '价格确定之后', typical: '工作转移到邮件、表格和外部系统。', platform: '交付、验收、质量、文件、争议与结算依据继续处于同一流程。' }, { criterion: '责任', typical: '通常在系统外确定。', platform: '偏差关联责任方、依据、期限和允许的操作。' }, { criterion: 'AI', typical: '搜索、推荐或通用聊天。', platform: 'Gekta 分析具体交易、来源与角色限制。' }, { criterion: '证据', typical: '消息和分散文件。', platform: '版本、事件、决定与依据都关联到同一笔交易。' }], boundary: '平台不宣称取代 ERP、银行、实验室或物流系统。只通过明确来源和权限把交易相关数据与操作关联起来。', moreLabel: '显示全部差异' },
    functions: { eyebrow: '平台能力', title: '农业交易关键任务位于同一工作系统', lead: '相关能力围绕同一笔交易的履约结果组织，而不是简单罗列模块。', items: [{ index: '01', title: '价格', text: '报价、准入条件与竞价。', result: '商业条件记录在交易历史中。' }, { index: '02', title: '交易', text: '合同、角色、条件版本与权限。', result: '每个参与方的义务清晰。' }, { index: '03', title: '交付', text: '申请、运输、路线、司机与控制点。', result: '批次移动事件与交易关联。' }, { index: '04', title: '验收', text: '重量、质量、实验室、差异与复检。', result: '实际履约与条件完成对照。' }, { index: '05', title: '文件', text: '关联事件和批次、版本、完整性与签名。', result: '依据不会丢失在往来沟通中。' }, { index: '06', title: '资金', text: '财务场景、暂扣、部分结算、退款与对账。', result: '明确哪些依据允许或阻止金融操作。' }, { index: '07', title: '争议', text: '各方立场、证据、期限与决定。', result: '基于同一版本事实审查争议。' }, { index: '08', title: '控制', text: 'Gekta、分析、API、ERP/1C、物流、实验室与财务。', result: '外部数据按来源和权限关联到交易。' }], summaryTitle: '同一笔交易连接所有功能', summaryText: '交付事件会同步改变验收、文件、风险、允许的操作与结算依据。', moreLabel: '显示全部能力', resultLabel: '结果' },
    process: { eyebrow: '交易路径', title: '条件确定后的关联履约', lead: '当前任务、流转依据、责任方和下一步始终清晰可见。', phases: [{ index: '01', title: '条件', text: '商品、数量、质量、交付基础与容差。', result: '存在进入交易方选择的依据。' }, { index: '02', title: '选择交易方', text: '报价、竞价与价格固定。', result: '商业条件达成一致。' }, { index: '03', title: '义务', text: '合同、参与方、文件与财务场景。', result: '存在进入履约的依据。' }, { index: '04', title: '交付', text: '运输、路线、车次与事件。', result: '交付事实与批次关联。' }, { index: '05', title: '验收', text: '重量、质量、实验室与差异决定。', result: '实际履约与条件完成对照。' }, { index: '06', title: '结算与关闭', text: '结算依据、暂扣、争议与义务完成。', result: '金融结果和关闭与履约历史保持关联。' }], fullPathLabel: '完整模型', fullPathText: '条件 → 交易方 → 合同 → 交付 → 验收与质量 → 文件 → 结算 → 异常 → 关闭。', moreLabel: '显示全部阶段', resultLabel: '阶段结果', stagesLabel: '显示详细路径' },
    demo: { eyebrow: '交易运行', title: '同一流程展示正常履约、偏差与争议', lead: '切换情况会更新事实、责任方、允许的操作与结算依据。下方为虚构示例。', statesLabel: '交易情况', roleLabel: '视角', role: '买方', stageLabel: '交易阶段', stages: ['条件', '选择交易方', '义务', '交付', '验收', '结算与关闭'], states: [
      { key: 'normal', tab: '正常', status: '示例事实', title: '交付符合示例条件', summary: '虚构示例中的重量、质量和文件符合设定条件。', kpis: [{ label: '重量', value: '1,200.4 吨 · 示例数据' }, { label: '蛋白质', value: '12.1% · 符合示例容差' }, { label: '文件', value: '依据已汇集' }], events: [{ meta: '今天 09:42', title: '验收事实', text: '重量和批次与示例验收记录关联。' }, { meta: '今天 09:51', title: '收到实验室报告', text: '结果与条件版本完成对照。' }, { meta: '今天 10:03', title: '结算依据已汇集', text: '事件、文件和权限位于同一上下文。' }], actionTitle: '金融操作前的依据', actionText: '只有具备相应来源、权限和依据时，金融操作才由获授权参与方或外部系统执行。', actionCta: '查看依据' },
      { key: 'deviation', tab: '偏差', status: '需要参与方决定', title: '质量指标低于要求', summary: '蛋白质为 11.2%，合同最低要求为 12.0%。报告与条件版本已完成对照。', kpis: [{ label: '偏差', value: '−0.8 个百分点' }, { label: '责任方', value: '买方' }, { label: '结算依据', value: '需要参与方决定' }], events: [{ meta: '今天 10:04', title: '收到第 318 号报告', text: '结果与样品和批次关联。' }, { meta: '今天 10:06', title: 'Gekta 对照交易条件', text: '显示偏差、来源和缺少的下一步。' }, { meta: '今天到期', title: '可选操作', text: '重算、复检或发起异议。' }], actionTitle: '决定仍由买方作出', actionText: 'Gekta 不会自行修改合同或批准金融操作。', actionCta: '查看选项' },
      { key: 'dispute', tab: '争议 / 数据不足', status: '来源冲突', title: '不同来源相互矛盾', summary: '两个报告版本包含不同结果，需要更多依据才能选择适用版本。', kpis: [{ label: '版本', value: '2 份报告' }, { label: '缺少内容', value: '选择版本的依据' }, { label: '结算依据', value: '金融操作已停止' }], events: [{ meta: '今天 10:07', title: '发现版本冲突', text: '两个来源都保留在示例历史中。' }, { meta: '今天 10:08', title: 'Gekta 保留结论', text: '显示冲突来源和缺失数据。' }, { meta: '明天到期', title: '需要异议程序', text: '明确参与方、期限和所需证据。' }], actionTitle: '金融操作等待争议解决', actionText: '系统保存各方立场与证据，但不会自动作出决定。', actionCta: '打开争议' }
    ], openDeal: '打开完整交易场景' },
    roles: { eyebrow: '所有参与方共用一个平台', title: '同一版本事实，不同任务与权限', lead: '每个参与方看到同一笔交易，但只看到自身数据、责任与允许的操作。', groups: [{ title: '卖方', subroles: '生产者 · 贸易公司', see: '批次路径、文件与结算依据。', do: '提交文件、回应偏差并确认自身立场。', get: '是否存在结算依据的可追溯解释。' }, { title: '买方', subroles: '采购方 · 加工企业 · 农业集团', see: '交付、质量、文件和偏差影响。', do: '接受结果、请求复检、确认重算或发起争议。', get: '受控验收，并避免在缺少依据时执行金融操作。' }, { title: '履约', subroles: '物流 · 司机 · 筒仓 · 实验室 · 检验机构', see: '自身车次、控制点、文件与异常。', do: '确认事件、提交报告或上报偏差。', get: '清晰责任与履约证明。' }, { title: '控制与财务', subroles: '银行 · 平台员工', see: '风险、来源、决定历史和权限边界。', do: '核验、升级处理或在自身权限内操作。', get: '受控异常处理和可追溯操作依据。' }], benefits: [{ title: '速度', text: '减少在邮件、表格与不同系统之间的人工交接。' }, { title: '资金', text: '明确哪些依据允许或阻止金融操作。' }, { title: '风险', text: '在不可逆操作之前，将偏差关联到其来源。' }, { title: '控制', text: '明确谁在何时、为何并在何种权限范围内进行了操作。' }], scenarioTitle: '从具体角色查看同一笔交易', scenarioLead: '九个公开角色共用同一版本事实；切换改变说明，不改变权限。', labels: { see: '查看内容', do: '执行操作', get: '获得价值' } },
    tai: { eyebrow: 'Gekta · 农业智能', title: 'Gekta 是具体交易的智能层', lead: '它理解平台角色、阶段、文件与规则，并在回答中区分事实、结论、风险与缺失数据。', capabilities: [{ title: '平台专家', text: '解释流程、角色、允许的操作与限制。' }, { title: '交易分析', text: '发现偏差、依赖关系、责任方与影响。' }, { title: '文件与质量', text: '对照合同条件、版本、报告与事件。' }, { title: '风险与下一步', text: '展示选项，并在数据不足时保留结论。' }], principles: ['显示来源和缺失数据。', '只在当前角色权限范围内工作。', '未经确认不会修改交易或执行操作。'], analysisLabel: 'Gekta · 交易分析', state: '可用事实 · 虚构场景', rows: [{ label: '事实', value: '实验室报告：蛋白质 11.2%。合同：不低于 12.0%。' }, { label: '结论', value: '当前结果不符合现行合同版本的验收条件。' }, { label: '风险', value: '结算依据需要获授权参与方作出决定。' }, { label: '下一步', value: '买方：重算、请求复检或发起异议。' }], sources: ['合同 · 第 4 版', '第 318 号报告 · 第 2 版', '验收事件'], limit: '边界：Gekta 不代替实验室确定质量，不修改合同，不批准付款，也不作出法律决定。', cta: '进一步了解 Gekta', sourcesLabel: '来源' },
    trust: { eyebrow: '信任与控制', title: '清晰公开边界', lead: '用户可以看到谁有访问权、谁可以操作、依据如何保存，以及外部事实如何关联来源。', items: [{ title: '按角色访问', text: '参与方只看到与自己相关的数据和操作。' }, { title: '可追溯历史', text: '决定、依据和版本保存在交易中。' }, { title: '外部来源', text: '外部系统数据不会被内部假设替代。' }, { title: '权限边界', text: '缺少相应权限和依据时，Gekta 和外部系统不会代替参与方操作。' }], integrationTitle: '外部系统边界', statusBadge: '必须有来源', headers: ['系统', '场景', '边界', '依据'], integrations: [{ system: 'ERP / 1C', scenario: '交易数据与文件', boundary: '机构的数据交换路径单独确定', status: '机构的数据来源与权限单独确定' }, { system: '物流', scenario: '车次与运输事件', boundary: '物流系统仍是事实来源', status: '事件来自获授权来源' }, { system: '实验室', scenario: '质量报告', boundary: 'Gekta 不替代测量和实验室签名', status: '报告需要自身来源和签名' }, { system: '银行', scenario: '金融场景事件', boundary: '金融操作只能由获授权参与方或系统执行', status: '金融事件需要外部依据' }], metrics: [{ value: '9', label: '个公开交易角色' }, { value: '7', label: '个清晰公开步骤' }, { value: '3', label: '种公开界面语言' }], architectureNote: '架构边界、外部系统和运营声明只根据可审查材料进行说明。', ladderTitle: '如何理解公开声明', ladder: ['能力', '来源', '依据', '操作', '结果', '历史'], publicationRule: '每项外部声明都需要自身来源；平台具备能力并不表示外部系统已经执行相应操作。', cta: '打开信任中心' },
    faq: { eyebrow: '核心问题', title: '常见问题', items: [{ question: '这是撮合平台还是履约系统？', answer: '平台包含条件协商，但核心任务是让交易继续经过交付、质量、文件、异常、结算依据与关闭。' }, { question: '需要替换 1C 和其他系统吗？', answer: '不需要。“透明价格”只通过获授权来源和数据交换路径关联现有系统中与交易相关的数据。' }, { question: '谁作出最终决定？', answer: '由获授权参与方作出。外部系统操作只有在存在对应来源、权限和依据时才被纳入交易；Gekta 负责解释，但不会取代权限。' }, { question: '参与方如何开始？', answer: '先完成注册和机构核验。需要具体外部流程时，再单独确定相应的数据交换路径。' }] },
  },
} as const;

export type PlatformV7HomeStoryCopy = WidenCopy<(typeof copies)['ru']>;

export function getPlatformV7HomeStoryCopy(locale: string): PlatformV7HomeStoryCopy {
  return (locale === 'en' ? copies.en : locale === 'zh' ? copies.zh : copies.ru) as PlatformV7HomeStoryCopy;
}
