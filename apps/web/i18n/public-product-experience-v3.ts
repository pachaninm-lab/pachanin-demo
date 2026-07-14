import { isAppLocale, type AppLocale } from '@/i18n/locale';

type DeepWiden<T> =
  T extends string ? string
    : T extends number ? number
      : T extends boolean ? boolean
        : T extends readonly (infer Item)[] ? readonly DeepWiden<Item>[]
          : T extends object ? { readonly [Key in keyof T]: DeepWiden<T[Key]> }
            : T;

const ru = {
  header: {
    aria: 'Публичная навигация',
    brandHome: 'Прозрачная Цена — на главную',
    signIn: 'Войти',
  },
  home: {
    hero: {
      kicker: 'Исполнение внебиржевой зерновой сделки',
      title: 'Сделка под контролем. От условий до расчёта.',
      lead: 'Участники, перевозка, приёмка, качество, документы, деньги и спор связаны одной историей исполнения.',
      primary: 'Посмотреть сделку изнутри',
      secondary: 'Подключить организацию',
    },
    preview: {
      eyebrow: 'Пример прохождения сделки',
      title: 'Пример сделки №2408',
      commodity: 'Пшеница 3 класса',
      volume: '500 тонн',
      price: '13 800 ₽/т',
      route: 'Тамбов — Воронеж',
      nowLabel: 'Сейчас',
      nowValue: 'Приёмка',
      requiredLabel: 'Требуется',
      requiredValue: 'Подтвердить вес партии',
      ownerLabel: 'Ответственный',
      ownerValue: 'Элеватор',
      afterLabel: 'После подтверждения',
      afterValue: 'Проверка качества',
      lenses: {
        execution: { label: 'Исполнение', value: 'Этап 6 из 10: приёмка партии' },
        documents: { label: 'Документы', value: 'Получено 4 из 6 · следующий: акт приёмки' },
        money: { label: 'Деньги', value: '6 900 000 ₽ · ожидаются основания' },
        risk: { label: 'Риск', value: 'Отклонение фактического веса' },
      },
      open: 'Открыть полный контур',
    },
    perspectives: {
      title: 'Посмотрите на сделку со своей стороны',
      lead: 'Выберите участника — изменятся действия, документы, ответственность и денежный контекст.',
      all: 'Все участники',
      primary: ['seller', 'buyer', 'logistics', 'elevator', 'bank', 'operator'],
      secondary: ['driver', 'lab', 'surveyor', 'compliance', 'arbitrator', 'executive'],
    },
    proof: {
      title: 'Доказательность встроена в исполнение',
      rows: [
        'Каждое действие связано с участником',
        'Каждый документ связан с событием сделки',
        'Денежное действие требует основания',
        'Решения сохраняются в хронологии',
      ],
    },
    final: {
      title: 'Посмотрите полный путь сделки для своей роли',
      primary: 'Открыть сделку изнутри',
      secondary: 'Подключить организацию',
      signInPrefix: 'Уже подключены?',
      signIn: 'Войти в рабочее место',
    },
  },
  explorer: {
    metaTitle: 'Сделка изнутри — Прозрачная Цена',
    metaDescription: 'Интерактивный разбор одной зерновой сделки: роли, события, документы, деньги, риски, спор и помощь ИИ.',
    kicker: 'Публичный интерактивный контур',
    title: 'Сделка изнутри',
    lead: 'Одна сделка, шесть линз, двенадцать перспектив и три сценария. Все данные ниже являются учебным примером.',
    exampleBadge: 'Пример прохождения сделки',
    connect: 'Подключить организацию',
    backHome: 'На главную',
    deal: {
      idLabel: 'Deal ID', id: 'DEAL-2408', commodityLabel: 'Товар', commodity: 'Пшеница', classLabel: 'Класс', classValue: '3 класс', volumeLabel: 'Объём', volume: '500 тонн', priceLabel: 'Цена', price: '13 800 ₽/т', amountLabel: 'Сумма', amount: '6 900 000 ₽', routeLabel: 'Маршрут', route: 'Тамбов — Воронеж', stageLabel: 'Текущий этап', statusLabel: 'Статус', status: 'Требуется действие', ownerLabel: 'Ответственный', nextLabel: 'Следующее действие', blockerLabel: 'Блокер', noBlocker: 'Нет активного блокера',
    },
    controls: {
      lens: 'Линза', perspective: 'Перспектива', scenario: 'Сценарий', stage: 'Этап', risk: 'Риск', previous: 'Назад', next: 'Далее', startGuide: 'Показать всю сделку автоматически', pause: 'Пауза', continue: 'Продолжить', stop: 'Пропустить', aiToggle: 'Показать помощь ИИ', allParticipants: 'Все участники', openDocument: 'Показать основание', closeDocument: 'Скрыть основание',
    },
    labels: {
      happened: 'Что произошло', responsible: 'Кто отвечает', action: 'Какое действие требуется', evidence: 'Какое доказательство возникнет', transition: 'Что станет доступно дальше', visibleDocuments: 'Видимые документы', responsibility: 'Ответственность', expectedOutcome: 'Ожидаемый результат', roleRisk: 'Риск роли', moneyContext: 'Денежный контекст', event: 'Событие', document: 'Документ', signature: 'Подпись', version: 'Версия', allowedAction: 'Разрешённое действие', confidence: 'Уверенность', affectedObject: 'Затронутый объект', recommendation: 'Рекомендуемое действие', whyImportant: 'Почему это важно', blockedAction: 'Заблокированное действие', deadline: 'Срок реакции', outcome: 'Возможный исход', disputedAmount: 'Спорная сумма',
    },
    lenses: {
      execution: { label: 'Исполнение', summary: 'Причинная цепочка событий, действий и переходов.' },
      participants: { label: 'Участники', summary: 'Одна сделка с разными правами, обязанностями и результатами.' },
      documents: { label: 'Документы', summary: 'Документы как основания событий и денежных действий.' },
      money: { label: 'Деньги', summary: 'Основания, частичный или итоговый расчёт.' },
      risk: { label: 'Риски и спор', summary: 'Блокировки, доказательства, позиции сторон и последствия.' },
      intelligence: { label: 'ИИ и аналитика', summary: 'Контекстные сигналы без автоматического принятия решений.' },
    },
    stages: {
      terms: { label: 'Условия', happened: 'Стороны согласовали товар, объём, цену и качество.', owner: 'Покупатель и продавец', action: 'Подтвердить канонические условия.', evidence: 'Версия условий с авторством и временем.', next: 'Открывается проверка допуска.' },
      admission: { label: 'Допуск', happened: 'Проверены организации, полномочия и обязательные сведения.', owner: 'Комплаенс', action: 'Закрыть выявленные несоответствия.', evidence: 'Решение о допуске и журнал проверок.', next: 'Разрешается участие в аукционе.' },
      auction: { label: 'Аукцион', happened: 'Зафиксированы ставки и выбран победитель по правилам торгов.', owner: 'Оператор', action: 'Подтвердить результат торгов.', evidence: 'История ставок и решение.', next: 'Создаётся основание сделки.' },
      deal: { label: 'Сделка', happened: 'Победившее предложение стало единым объектом сделки.', owner: 'Покупатель и продавец', action: 'Подтвердить обязательства сторон.', evidence: 'Карточка сделки и версия договорённостей.', next: 'Открывается назначение перевозки.' },
      logistics: { label: 'Перевозка', happened: 'Назначены перевозчик, водитель, транспорт и маршрут.', owner: 'Логистика', action: 'Подтвердить готовность рейса.', evidence: 'Рейс, маршрут и контрольные события.', next: 'Прибытие открывает приёмку.' },
      acceptance: { label: 'Приёмка', happened: 'Партия прибыла на элеватор; фиксируются вес и состояние.', owner: 'Элеватор', action: 'Подтвердить вес партии.', evidence: 'Акт приёмки, время и связанный рейс.', next: 'Открывается лабораторная проверка.' },
      laboratory: { label: 'Лаборатория', happened: 'Показатели качества сопоставлены с условиями сделки.', owner: 'Лаборатория', action: 'Подписать протокол результата.', evidence: 'Протокол с пробой, методикой и версией.', next: 'Формируется документная полнота.' },
      documents: { label: 'Документы', happened: 'Собирается комплект по партии, рейсу и приёмке.', owner: 'Оператор и стороны', action: 'Закрыть отсутствующие основания.', evidence: 'Подписанные версии и контрольные суммы.', next: 'Разрешается проверка денежного основания.' },
      settlement: { label: 'Расчёт', happened: 'Сумма сопоставляется с исполнением и комплектом оснований.', owner: 'Банк', action: 'Проверить основание расчёта.', evidence: 'Решение, денежное событие и сверка.', next: 'Полный или частичный расчёт ведёт к закрытию.' },
      closure: { label: 'Закрытие', happened: 'Обязательства, документы и денежные события сведены в итог.', owner: 'Оператор', action: 'Зафиксировать завершение сделки.', evidence: 'Итоговая хронология и evidence pack.', next: 'Данные доступны для аналитики и аудита.' },
    },
    perspectives: {
      seller: { label: 'Продавец', value: 'Видит партию, отгрузку, документы и расчёт.', action: 'Подтвердить исполнение поставки.', documents: 'Условия, партия, отгрузочные документы, акт приёмки.', responsibility: 'Поставить согласованный объём и качество.', outcome: 'Подтверждённое исполнение и получение оплаты.', risk: 'Недостаточное доказательство поставки.', money: 'Оплата зависит от принятого объёма и комплектности оснований.' },
      buyer: { label: 'Покупатель', value: 'Контролирует условия, приёмку, качество и основание оплаты.', action: 'Подтвердить соответствие поставки.', documents: 'Условия, лабораторный протокол, акт приёмки, расчёт.', responsibility: 'Принять соответствующую поставку и подтвердить основания.', outcome: 'Полученный товар с проверяемым качеством.', risk: 'Оплата неподтверждённого объёма или качества.', money: 'Сумма расчёта связана с фактом исполнения.' },
      logistics: { label: 'Логистика', value: 'Управляет перевозчиком, рейсом, маршрутом и отклонениями.', action: 'Обеспечить прибытие рейса.', documents: 'Заявка, маршрут, транспортные события, прибытие.', responsibility: 'Доставить партию в согласованное окно.', outcome: 'Рейс завершён и связан с приёмкой.', risk: 'Опоздание или потеря связности событий.', money: 'Логистическое исполнение влияет на допустимые удержания.' },
      driver: { label: 'Водитель', value: 'Получает рейс, контрольные точки и следующий шаг.', action: 'Подтвердить прибытие.', documents: 'Рейс, маршрут, транспортный документ.', responsibility: 'Передавать подтверждённые события рейса.', outcome: 'Прибытие открывает приёмку.', risk: 'Неподтверждённая контрольная точка.', money: 'Выплата перевозчику требует подтверждения рейса.' },
      elevator: { label: 'Элеватор', value: 'Фиксирует прибытие, вес, приёмку и связь с партией.', action: 'Подтвердить фактический вес.', documents: 'Рейс, талон, акт приёмки, весовые данные.', responsibility: 'Создать достоверное основание приёмки.', outcome: 'Принятый объём передан в контроль качества.', risk: 'Расхождение веса или неверная партия.', money: 'Фактический принятый объём влияет на расчёт.' },
      lab: { label: 'Лаборатория', value: 'Связывает пробу, методику и результат с партией.', action: 'Подписать протокол качества.', documents: 'Проба, методика, протокол, версия результата.', responsibility: 'Зафиксировать воспроизводимый результат.', outcome: 'Качество сопоставлено с условиями.', risk: 'Протокол связан не с той партией.', money: 'Отклонение качества меняет допустимую сумму.' },
      surveyor: { label: 'Сюрвейер', value: 'Создаёт независимое доказательство спорного события.', action: 'Зафиксировать независимый осмотр.', documents: 'Акт осмотра, фото, время, связанный объект.', responsibility: 'Сохранить нейтральную доказательную цепочку.', outcome: 'Спор получает независимое основание.', risk: 'Неполная или невоспроизводимая фиксация.', money: 'Доказательство влияет на спорную сумму.' },
      bank: { label: 'Банк', value: 'Видит сумму, основания, выплату, сверку и спорную часть.', action: 'Проверить комплект оснований.', documents: 'Договорное основание, приёмка, качество, решение по спору.', responsibility: 'Исполнить денежное действие только по допустимому событию.', outcome: 'Проверяемый расчёт и reconciliation.', risk: 'Неполное или противоречивое основание.', money: 'Полная, частичная или отложенная сумма по сценарию.' },
      operator: { label: 'Оператор', value: 'Управляет блокерами, ответственными и хронологией.', action: 'Снять операционный блокер.', documents: 'Все события, статусы, документы и решения.', responsibility: 'Сохранить целостность процесса между организациями.', outcome: 'Сделка проходит без разрывов и потери контекста.', risk: 'Несогласованное состояние участников.', money: 'Контролирует готовность основания, но не принимает решение банка.' },
      compliance: { label: 'Комплаенс', value: 'Проверяет допуск, полномочия и критические несоответствия.', action: 'Закрыть проверку допуска.', documents: 'Профиль организации, полномочия, решение и журнал.', responsibility: 'Не допустить запрещённый переход.', outcome: 'Участники допущены с проверяемым основанием.', risk: 'Пропущенное ограничение или конфликт данных.', money: 'Недопущенный участник блокирует денежный контур.' },
      arbitrator: { label: 'Арбитр', value: 'Сводит позиции сторон, доказательства и денежное последствие.', action: 'Определить достаточность доказательств.', documents: 'Позиции, версии, протоколы, акты, хронология.', responsibility: 'Принять обоснованное решение в рамках процедуры.', outcome: 'Спор завершён с понятным последствием.', risk: 'Решение без полного evidence pack.', money: 'Решение определяет спорную и бесспорную суммы.' },
      executive: { label: 'Руководитель', value: 'Видит портфель, исключения, деньги и системные причины риска.', action: 'Устранить повторяющийся источник отклонений.', documents: 'Агрегированные события и первичные основания.', responsibility: 'Управлять результатом без вмешательства в каждую операцию.', outcome: 'Снижение потерь, сроков и ручного сопровождения.', risk: 'Показатели без подтверждаемой первички.', money: 'Контролирует GMV, выручку, спорные суммы и скорость расчёта.' },
    },
    scenarios: {
      standard: { label: 'Штатный', summary: 'Поставка подтверждена, качество соответствует, документы получены.', amount: 'Полная сумма: 6 900 000 ₽', blocker: 'Нет денежного блокера', outcome: 'Полный расчёт после проверки оснований.' },
      partial: { label: 'Частичный', summary: 'Поставлено и принято 420 из 500 тонн.', amount: 'К расчёту: 5 796 000 ₽ · остаток ожидает исполнения', blocker: '80 тонн не подтверждены', outcome: 'Частичный расчёт; остаток остаётся в ожидании.' },
      dispute: { label: 'Спорный', summary: 'Обнаружено отклонение веса и качества.', amount: 'Бесспорная сумма отделена от спорной', blocker: 'Спорная часть требует решения', outcome: 'Доказательства → решение → итоговый расчёт.' },
    },
    documents: [
      { name: 'Акт приёмки', type: 'Приёмка', party: 'Партия B-2408', trip: 'Рейс R-318', creator: 'Элеватор', signer: 'Уполномоченный сотрудник', timestamp: '14.07.2026 · 11:42', version: 'v1.0', status: 'Ожидает подписи', checksum: '71af…c904', basis: 'Подтверждает фактический принятый объём.' },
      { name: 'Протокол качества', type: 'Лаборатория', party: 'Партия B-2408', trip: 'Рейс R-318', creator: 'Лаборатория', signer: 'Лаборант', timestamp: '14.07.2026 · 12:18', version: 'v1.0', status: 'Подтверждён', checksum: '9bc2…a811', basis: 'Разрешает сопоставление качества с условиями.' },
      { name: 'Основание расчёта', type: 'Деньги', party: 'Партия B-2408', trip: 'Рейс R-318', creator: 'Платформа', signer: 'Не применимо', timestamp: 'После комплектности', version: 'v0.4', status: 'Не готово', checksum: 'Будет сформирована', basis: 'Разрешает передачу проверяемого основания в банковский контур.' },
    ],
    risks: {
      transportDelay: { label: 'Опоздание транспорта', event: 'Рейс вышел за согласованное окно прибытия.', blocked: 'Своевременная приёмка.', owner: 'Логистика', evidence: 'Маршрут, контрольные точки и причина отклонения.', deadline: '2 часа', outcome: 'Новое окно, удержание или спор.' },
      weightMismatch: { label: 'Расхождение веса', event: 'Фактический вес отличается от заявленного.', blocked: 'Подтверждение полного объёма.', owner: 'Элеватор и сюрвейер', evidence: 'Весовые данные, акт и независимая фиксация.', deadline: '4 часа', outcome: 'Корректировка объёма или спор.' },
      qualityDeviation: { label: 'Отклонение качества', event: 'Показатель не соответствует условиям.', blocked: 'Полный расчёт.', owner: 'Лаборатория', evidence: 'Проба, методика и подписанный протокол.', deadline: '1 рабочий день', outcome: 'Перерасчёт, отказ или спор.' },
      missingDocument: { label: 'Отсутствующий документ', event: 'В комплекте нет обязательного основания.', blocked: 'Передача денежного основания.', owner: 'Оператор и сторона документа', evidence: 'Требуемый подписанный документ.', deadline: 'До расчётного окна', outcome: 'Дозапрос или перенос расчёта.' },
      documentVersion: { label: 'Изменённая версия документа', event: 'После согласования появилась новая версия.', blocked: 'Использование прежнего основания.', owner: 'Создатель документа', evidence: 'История версий, подписи и контрольные суммы.', deadline: '4 часа', outcome: 'Принятие новой версии или спор.' },
      paymentBasis: { label: 'Неполное основание выплаты', event: 'События и документы не образуют полный комплект.', blocked: 'Денежное действие.', owner: 'Оператор и банк', evidence: 'Недостающие подтверждения исполнения.', deadline: 'До следующего расчётного окна', outcome: 'Ожидание, частичный расчёт или спор.' },
    },
    aiSignals: [
      { title: 'Расхождение условий', why: 'Объём в версии документа отличается от карточки сделки.', object: 'Акт приёмки · Партия B-2408', recommendation: 'Сверить версию до подписания.', confidence: 'Высокая · 92%' },
      { title: 'Риск нарушения срока', why: 'До расчётного окна мало времени, а акт не подписан.', object: 'Этап «Документы»', recommendation: 'Назначить ответственного и запросить подпись.', confidence: 'Средняя · 78%' },
      { title: 'Недостаточное основание', why: 'Протокол качества не связан с текущей пробой.', object: 'Протокол качества', recommendation: 'Проверить связь пробы и партии.', confidence: 'Высокая · 89%' },
    ],
    boundaries: {
      title: 'Граница публичного примера',
      text: 'Этот интерфейс не читает реальные сделки, не меняет роли, не вызывает ФГИС, ЭДО, ЕСИА или банк и не выполняет денежные операции.',
      ai: 'ИИ показывает рекомендации. Он не подтверждает юридически значимые действия, не принимает решение по выплате и не разрешает спор.',
    },
  },
} as const;

export type PublicProductExperienceCopy = DeepWiden<typeof ru>;

const en: PublicProductExperienceCopy = {
  header: { aria: 'Public navigation', brandHome: 'Transparent Price — home', signIn: 'Sign in' },
  home: {
    hero: { kicker: 'Execution of an OTC grain transaction', title: 'Keep the deal under control. From terms to settlement.', lead: 'Participants, transport, acceptance, quality, documents, money and disputes are connected by one execution history.', primary: 'See the deal from inside', secondary: 'Connect an organisation' },
    preview: {
      eyebrow: 'Illustrative deal flow', title: 'Example deal No. 2408', commodity: 'Class 3 wheat', volume: '500 tonnes', price: 'RUB 13,800/t', route: 'Tambov — Voronezh', nowLabel: 'Current stage', nowValue: 'Acceptance', requiredLabel: 'Required', requiredValue: 'Confirm the lot weight', ownerLabel: 'Responsible', ownerValue: 'Elevator', afterLabel: 'After confirmation', afterValue: 'Quality inspection',
      lenses: { execution: { label: 'Execution', value: 'Stage 6 of 10: lot acceptance' }, documents: { label: 'Documents', value: '4 of 6 received · next: acceptance certificate' }, money: { label: 'Money', value: 'RUB 6,900,000 · awaiting evidence' }, risk: { label: 'Risk', value: 'Actual weight deviation' } }, open: 'Open the full flow',
    },
    perspectives: { title: 'View the deal from your side', lead: 'Choose a participant to change actions, documents, responsibility and money context.', all: 'All participants', primary: ['seller', 'buyer', 'logistics', 'elevator', 'bank', 'operator'], secondary: ['driver', 'lab', 'surveyor', 'compliance', 'arbitrator', 'executive'] },
    proof: { title: 'Evidence is built into execution', rows: ['Every action is linked to a participant', 'Every document is linked to a deal event', 'Every money action requires evidence', 'Decisions remain in the chronology'] },
    final: { title: 'See the complete deal path for your role', primary: 'Open the deal from inside', secondary: 'Connect an organisation', signInPrefix: 'Already connected?', signIn: 'Open your workspace' },
  },
  explorer: {
    metaTitle: 'Deal from inside — Transparent Price', metaDescription: 'Interactive walkthrough of one grain deal: roles, events, documents, money, risks, dispute and AI assistance.', kicker: 'Public interactive flow', title: 'Deal from inside', lead: 'One deal, six lenses, twelve perspectives and three scenarios. All data below is illustrative.', exampleBadge: 'Illustrative deal flow', connect: 'Connect an organisation', backHome: 'Back to home',
    deal: { idLabel: 'Deal ID', id: 'DEAL-2408', commodityLabel: 'Commodity', commodity: 'Wheat', classLabel: 'Class', classValue: 'Class 3', volumeLabel: 'Volume', volume: '500 tonnes', priceLabel: 'Price', price: 'RUB 13,800/t', amountLabel: 'Amount', amount: 'RUB 6,900,000', routeLabel: 'Route', route: 'Tambov — Voronezh', stageLabel: 'Current stage', statusLabel: 'Status', status: 'Action required', ownerLabel: 'Responsible', nextLabel: 'Next action', blockerLabel: 'Blocker', noBlocker: 'No active blocker' },
    controls: { lens: 'Lens', perspective: 'Perspective', scenario: 'Scenario', stage: 'Stage', risk: 'Risk', previous: 'Back', next: 'Next', startGuide: 'Play the full deal', pause: 'Pause', continue: 'Continue', stop: 'Skip', aiToggle: 'Show AI assistance', allParticipants: 'All participants', openDocument: 'Show evidence', closeDocument: 'Hide evidence' },
    labels: { happened: 'What happened', responsible: 'Who is responsible', action: 'Required action', evidence: 'Evidence created', transition: 'What becomes available next', visibleDocuments: 'Visible documents', responsibility: 'Responsibility', expectedOutcome: 'Expected outcome', roleRisk: 'Role risk', moneyContext: 'Money context', event: 'Event', document: 'Document', signature: 'Signature', version: 'Version', allowedAction: 'Allowed action', confidence: 'Confidence', affectedObject: 'Affected object', recommendation: 'Recommended action', whyImportant: 'Why it matters', blockedAction: 'Blocked action', deadline: 'Response time', outcome: 'Possible outcome', disputedAmount: 'Disputed amount' },
    lenses: { execution: { label: 'Execution', summary: 'Causal chain of events, actions and transitions.' }, participants: { label: 'Participants', summary: 'One deal with different responsibilities and outcomes.' }, documents: { label: 'Documents', summary: 'Documents as evidence for events and money actions.' }, money: { label: 'Money', summary: 'Evidence, partial or final settlement.' }, risk: { label: 'Risks and dispute', summary: 'Blocks, evidence, party positions and consequences.' }, intelligence: { label: 'AI and analytics', summary: 'Contextual signals without autonomous decisions.' } },
    stages: {
      terms: { label: 'Terms', happened: 'The parties agreed commodity, volume, price and quality.', owner: 'Buyer and seller', action: 'Confirm canonical terms.', evidence: 'Versioned terms with authorship and time.', next: 'Admission checks become available.' },
      admission: { label: 'Admission', happened: 'Organisations, authority and mandatory data were checked.', owner: 'Compliance', action: 'Resolve identified mismatches.', evidence: 'Admission decision and check log.', next: 'Auction participation is allowed.' },
      auction: { label: 'Auction', happened: 'Bids were recorded and a winner selected under the rules.', owner: 'Operator', action: 'Confirm the auction result.', evidence: 'Bid history and decision.', next: 'The deal basis is created.' },
      deal: { label: 'Deal', happened: 'The winning offer became one canonical deal object.', owner: 'Buyer and seller', action: 'Confirm party obligations.', evidence: 'Deal card and terms version.', next: 'Transport assignment becomes available.' },
      logistics: { label: 'Transport', happened: 'Carrier, driver, vehicle and route were assigned.', owner: 'Logistics', action: 'Confirm trip readiness.', evidence: 'Trip, route and checkpoints.', next: 'Arrival opens acceptance.' },
      acceptance: { label: 'Acceptance', happened: 'The lot arrived at the elevator; weight and condition are recorded.', owner: 'Elevator', action: 'Confirm the lot weight.', evidence: 'Acceptance certificate, time and linked trip.', next: 'Laboratory inspection opens.' },
      laboratory: { label: 'Laboratory', happened: 'Quality indicators were compared with deal terms.', owner: 'Laboratory', action: 'Sign the result protocol.', evidence: 'Protocol with sample, method and version.', next: 'Document completeness is assessed.' },
      documents: { label: 'Documents', happened: 'The lot, trip and acceptance evidence set is assembled.', owner: 'Operator and parties', action: 'Close missing evidence.', evidence: 'Signed versions and checksums.', next: 'Money evidence can be checked.' },
      settlement: { label: 'Settlement', happened: 'The amount is matched to confirmed execution and evidence.', owner: 'Bank', action: 'Check the settlement basis.', evidence: 'Decision, money event and reconciliation.', next: 'Full or partial settlement leads to closure.' },
      closure: { label: 'Closure', happened: 'Obligations, documents and money events are reconciled.', owner: 'Operator', action: 'Record deal completion.', evidence: 'Final chronology and evidence pack.', next: 'Data remains available for analytics and audit.' },
    },
    perspectives: {
      seller: { label: 'Seller', value: 'Sees the lot, dispatch, documents and settlement.', action: 'Confirm delivery performance.', documents: 'Terms, lot, dispatch documents and acceptance certificate.', responsibility: 'Deliver the agreed volume and quality.', outcome: 'Confirmed performance and payment.', risk: 'Insufficient delivery evidence.', money: 'Payment depends on accepted volume and complete evidence.' },
      buyer: { label: 'Buyer', value: 'Controls terms, acceptance, quality and payment basis.', action: 'Confirm delivery conformity.', documents: 'Terms, laboratory protocol, acceptance and settlement.', responsibility: 'Accept compliant delivery and confirm evidence.', outcome: 'Received commodity with verified quality.', risk: 'Paying for unconfirmed volume or quality.', money: 'Settlement is linked to actual execution.' },
      logistics: { label: 'Logistics', value: 'Manages carrier, trip, route and deviations.', action: 'Ensure trip arrival.', documents: 'Order, route, transport events and arrival.', responsibility: 'Deliver within the agreed window.', outcome: 'Completed trip linked to acceptance.', risk: 'Delay or broken event continuity.', money: 'Transport performance affects allowed deductions.' },
      driver: { label: 'Driver', value: 'Receives the trip, checkpoints and next action.', action: 'Confirm arrival.', documents: 'Trip, route and transport document.', responsibility: 'Transmit verified trip events.', outcome: 'Arrival opens acceptance.', risk: 'Unconfirmed checkpoint.', money: 'Carrier payment requires trip confirmation.' },
      elevator: { label: 'Elevator', value: 'Records arrival, weight, acceptance and lot linkage.', action: 'Confirm actual weight.', documents: 'Trip, ticket, acceptance certificate and scale data.', responsibility: 'Create reliable acceptance evidence.', outcome: 'Accepted volume enters quality control.', risk: 'Weight mismatch or wrong lot.', money: 'Accepted volume affects settlement.' },
      lab: { label: 'Laboratory', value: 'Links sample, method and result to a specific lot.', action: 'Sign the quality protocol.', documents: 'Sample, method, protocol and result version.', responsibility: 'Record a reproducible result.', outcome: 'Quality is compared with terms.', risk: 'Protocol linked to the wrong lot.', money: 'Quality deviation changes the eligible amount.' },
      surveyor: { label: 'Surveyor', value: 'Creates independent evidence for a disputed event.', action: 'Record an independent inspection.', documents: 'Inspection act, photos, time and linked object.', responsibility: 'Preserve a neutral evidence chain.', outcome: 'The dispute gains independent evidence.', risk: 'Incomplete or non-reproducible record.', money: 'Evidence affects the disputed amount.' },
      bank: { label: 'Bank', value: 'Sees amount, evidence, payment, reconciliation and disputed part.', action: 'Check the evidence set.', documents: 'Contract basis, acceptance, quality and dispute decision.', responsibility: 'Execute money actions only on an allowed event.', outcome: 'Auditable settlement and reconciliation.', risk: 'Incomplete or conflicting evidence.', money: 'Full, partial or delayed amount by scenario.' },
      operator: { label: 'Operator', value: 'Manages blockers, owners and the chronology.', action: 'Resolve the operational blocker.', documents: 'All events, statuses, documents and decisions.', responsibility: 'Preserve process integrity across organisations.', outcome: 'The deal progresses without context loss.', risk: 'Inconsistent participant states.', money: 'Controls evidence readiness but does not make the bank decision.' },
      compliance: { label: 'Compliance', value: 'Checks admission, authority and critical mismatches.', action: 'Complete the admission check.', documents: 'Organisation profile, authority, decision and log.', responsibility: 'Prevent a forbidden transition.', outcome: 'Participants are admitted on verified grounds.', risk: 'Missed restriction or data conflict.', money: 'A non-admitted party blocks the money flow.' },
      arbitrator: { label: 'Arbitrator', value: 'Combines party positions, evidence and money consequences.', action: 'Assess evidence sufficiency.', documents: 'Positions, versions, protocols, acts and chronology.', responsibility: 'Make a reasoned procedural decision.', outcome: 'The dispute ends with a clear consequence.', risk: 'Decision without a complete evidence pack.', money: 'The decision defines disputed and undisputed amounts.' },
      executive: { label: 'Executive', value: 'Sees portfolio, exceptions, money and systemic causes.', action: 'Remove recurring sources of deviation.', documents: 'Aggregated events with verifiable primary evidence.', responsibility: 'Manage outcomes without micromanaging operations.', outcome: 'Lower losses, cycle time and manual work.', risk: 'Metrics without primary evidence.', money: 'Controls GMV, revenue, disputed amounts and settlement speed.' },
    },
    scenarios: { standard: { label: 'Standard', summary: 'Delivery confirmed, quality compliant, documents received.', amount: 'Full amount: RUB 6,900,000', blocker: 'No money blocker', outcome: 'Full settlement after evidence checks.' }, partial: { label: 'Partial', summary: '420 of 500 tonnes delivered and accepted.', amount: 'Eligible: RUB 5,796,000 · balance awaiting execution', blocker: '80 tonnes are unconfirmed', outcome: 'Partial settlement; balance remains pending.' }, dispute: { label: 'Dispute', summary: 'A weight and quality deviation was found.', amount: 'Undisputed amount separated from disputed amount', blocker: 'Disputed part requires a decision', outcome: 'Evidence → decision → final settlement.' } },
    documents: [
      { name: 'Acceptance certificate', type: 'Acceptance', party: 'Lot B-2408', trip: 'Trip R-318', creator: 'Elevator', signer: 'Authorised employee', timestamp: '14 Jul 2026 · 11:42', version: 'v1.0', status: 'Awaiting signature', checksum: '71af…c904', basis: 'Confirms the actual accepted volume.' },
      { name: 'Quality protocol', type: 'Laboratory', party: 'Lot B-2408', trip: 'Trip R-318', creator: 'Laboratory', signer: 'Laboratory specialist', timestamp: '14 Jul 2026 · 12:18', version: 'v1.0', status: 'Confirmed', checksum: '9bc2…a811', basis: 'Allows quality to be compared with terms.' },
      { name: 'Settlement basis', type: 'Money', party: 'Lot B-2408', trip: 'Trip R-318', creator: 'Platform', signer: 'Not applicable', timestamp: 'After completeness', version: 'v0.4', status: 'Not ready', checksum: 'Will be generated', basis: 'Allows verified evidence to be passed to the banking perimeter.' },
    ],
    risks: {
      transportDelay: { label: 'Transport delay', event: 'The trip missed the agreed arrival window.', blocked: 'Timely acceptance.', owner: 'Logistics', evidence: 'Route, checkpoints and deviation reason.', deadline: '2 hours', outcome: 'New window, deduction or dispute.' },
      weightMismatch: { label: 'Weight mismatch', event: 'Actual weight differs from declared weight.', blocked: 'Confirmation of the full volume.', owner: 'Elevator and surveyor', evidence: 'Scale data, act and independent record.', deadline: '4 hours', outcome: 'Volume correction or dispute.' },
      qualityDeviation: { label: 'Quality deviation', event: 'An indicator does not meet the terms.', blocked: 'Full settlement.', owner: 'Laboratory', evidence: 'Sample, method and signed protocol.', deadline: '1 business day', outcome: 'Repricing, rejection or dispute.' },
      missingDocument: { label: 'Missing document', event: 'A mandatory item is absent from the evidence set.', blocked: 'Transfer of the money basis.', owner: 'Operator and document owner', evidence: 'Required signed document.', deadline: 'Before the settlement window', outcome: 'Request or settlement delay.' },
      documentVersion: { label: 'Changed document version', event: 'A new version appeared after approval.', blocked: 'Use of the previous basis.', owner: 'Document creator', evidence: 'Version history, signatures and checksums.', deadline: '4 hours', outcome: 'New version accepted or disputed.' },
      paymentBasis: { label: 'Incomplete payment basis', event: 'Events and documents do not form a complete set.', blocked: 'Money action.', owner: 'Operator and bank', evidence: 'Missing performance confirmations.', deadline: 'Before the next settlement window', outcome: 'Wait, partial settlement or dispute.' },
    },
    aiSignals: [
      { title: 'Terms mismatch', why: 'The volume in the document differs from the deal card.', object: 'Acceptance certificate · Lot B-2408', recommendation: 'Reconcile the version before signing.', confidence: 'High · 92%' },
      { title: 'Deadline risk', why: 'The settlement window is close and the act is unsigned.', object: 'Documents stage', recommendation: 'Assign an owner and request signature.', confidence: 'Medium · 78%' },
      { title: 'Insufficient evidence', why: 'The quality protocol is not linked to the current sample.', object: 'Quality protocol', recommendation: 'Verify the sample-to-lot link.', confidence: 'High · 89%' },
    ],
    boundaries: { title: 'Boundary of the public example', text: 'This interface does not read real deals, change roles, call FGIS, EDI, ESIA or a bank, or perform money operations.', ai: 'AI displays recommendations. It does not confirm legally significant actions, decide a payment or resolve a dispute.' },
  },
};

const zh: PublicProductExperienceCopy = {
  header: { aria: '公共导航', brandHome: '透明价格—返回首页', signIn: '登录' },
  home: {
    hero: { kicker: '场外粮食交易履约', title: '交易全程可控：从条款到结算。', lead: '参与方、运输、验收、质量、文件、资金与争议由同一履约历史连接。', primary: '从内部查看交易', secondary: '接入企业' },
    preview: {
      eyebrow: '交易流程示例', title: '示例交易 №2408', commodity: '三级小麦', volume: '500 吨', price: '13,800 卢布/吨', route: '坦波夫 — 沃罗涅日', nowLabel: '当前阶段', nowValue: '验收', requiredLabel: '需要操作', requiredValue: '确认批次重量', ownerLabel: '责任方', ownerValue: '粮库', afterLabel: '确认后', afterValue: '质量检验',
      lenses: { execution: { label: '履约', value: '第 6/10 阶段：批次验收' }, documents: { label: '文件', value: '已收到 4/6 · 下一份：验收单' }, money: { label: '资金', value: '6,900,000 卢布 · 等待依据' }, risk: { label: '风险', value: '实际重量偏差' } }, open: '打开完整流程',
    },
    perspectives: { title: '从你的角色查看交易', lead: '选择参与方后，操作、文件、责任和资金上下文会相应变化。', all: '全部参与方', primary: ['seller', 'buyer', 'logistics', 'elevator', 'bank', 'operator'], secondary: ['driver', 'lab', 'surveyor', 'compliance', 'arbitrator', 'executive'] },
    proof: { title: '证据链嵌入履约流程', rows: ['每项操作都关联到参与方', '每份文件都关联到交易事件', '每项资金操作都需要依据', '所有决定都保存在时间线中'] },
    final: { title: '查看与你角色相关的完整交易路径', primary: '从内部打开交易', secondary: '接入企业', signInPrefix: '已经接入？', signIn: '进入工作台' },
  },
  explorer: {
    metaTitle: '交易内部视图—透明价格', metaDescription: '一笔粮食交易的交互式解析：角色、事件、文件、资金、风险、争议与 AI 辅助。', kicker: '公共交互式流程', title: '交易内部视图', lead: '一笔交易、六个视角、十二种角色和三种场景。以下数据均为教学示例。', exampleBadge: '交易流程示例', connect: '接入企业', backHome: '返回首页',
    deal: { idLabel: '交易 ID', id: 'DEAL-2408', commodityLabel: '商品', commodity: '小麦', classLabel: '等级', classValue: '三级', volumeLabel: '数量', volume: '500 吨', priceLabel: '价格', price: '13,800 卢布/吨', amountLabel: '金额', amount: '6,900,000 卢布', routeLabel: '路线', route: '坦波夫 — 沃罗涅日', stageLabel: '当前阶段', statusLabel: '状态', status: '需要操作', ownerLabel: '责任方', nextLabel: '下一步', blockerLabel: '阻塞项', noBlocker: '当前无阻塞项' },
    controls: { lens: '视角', perspective: '角色', scenario: '场景', stage: '阶段', risk: '风险', previous: '上一步', next: '下一步', startGuide: '自动播放完整交易', pause: '暂停', continue: '继续', stop: '跳过', aiToggle: '显示 AI 辅助', allParticipants: '全部参与方', openDocument: '显示依据', closeDocument: '隐藏依据' },
    labels: { happened: '发生了什么', responsible: '谁负责', action: '需要执行的操作', evidence: '产生的证据', transition: '下一步可执行内容', visibleDocuments: '可见文件', responsibility: '责任', expectedOutcome: '预期结果', roleRisk: '角色风险', moneyContext: '资金上下文', event: '事件', document: '文件', signature: '签名', version: '版本', allowedAction: '允许的操作', confidence: '置信度', affectedObject: '受影响对象', recommendation: '建议操作', whyImportant: '为何重要', blockedAction: '被阻止的操作', deadline: '响应时限', outcome: '可能结果', disputedAmount: '争议金额' },
    lenses: { execution: { label: '履约', summary: '事件、操作和状态转换的因果链。' }, participants: { label: '参与方', summary: '同一交易中的不同责任与结果。' }, documents: { label: '文件', summary: '文件作为事件和资金操作的依据。' }, money: { label: '资金', summary: '依据、部分或最终结算。' }, risk: { label: '风险与争议', summary: '阻塞、证据、双方立场及后果。' }, intelligence: { label: 'AI 与分析', summary: '提供上下文信号，不自动作出决定。' } },
    stages: {
      terms: { label: '条款', happened: '双方确认商品、数量、价格和质量。', owner: '买方与卖方', action: '确认标准条款。', evidence: '带作者和时间的条款版本。', next: '进入准入检查。' },
      admission: { label: '准入', happened: '核验企业、授权与必填信息。', owner: '合规', action: '解决发现的不一致。', evidence: '准入决定与检查日志。', next: '允许参与竞价。' },
      auction: { label: '竞价', happened: '记录报价并按规则选出中标方。', owner: '运营方', action: '确认竞价结果。', evidence: '报价历史和决定。', next: '生成交易依据。' },
      deal: { label: '交易', happened: '中标报价转化为统一交易对象。', owner: '买方与卖方', action: '确认双方义务。', evidence: '交易卡片与条款版本。', next: '开放运输安排。' },
      logistics: { label: '运输', happened: '已指定承运人、司机、车辆和路线。', owner: '物流', action: '确认运输任务就绪。', evidence: '运输任务、路线和检查点。', next: '到达后开放验收。' },
      acceptance: { label: '验收', happened: '批次到达粮库，记录实际重量和状态。', owner: '粮库', action: '确认批次重量。', evidence: '验收单、时间与关联运输任务。', next: '开放实验室检验。' },
      laboratory: { label: '实验室', happened: '将质量指标与交易条款进行比对。', owner: '实验室', action: '签署检验结果。', evidence: '包含样品、方法和版本的报告。', next: '检查文件完整性。' },
      documents: { label: '文件', happened: '汇总批次、运输与验收依据。', owner: '运营方与双方', action: '补齐缺失依据。', evidence: '已签署版本和校验和。', next: '允许核验资金依据。' },
      settlement: { label: '结算', happened: '将金额与已确认履约及依据进行匹配。', owner: '银行', action: '核验结算依据。', evidence: '决定、资金事件与对账。', next: '全额或部分结算后进入关闭。' },
      closure: { label: '关闭', happened: '汇总义务、文件和资金事件。', owner: '运营方', action: '记录交易完成。', evidence: '最终时间线与证据包。', next: '数据可用于分析和审计。' },
    },
    perspectives: {
      seller: { label: '卖方', value: '查看批次、发运、文件和结算。', action: '确认交付履约。', documents: '条款、批次、发运文件和验收单。', responsibility: '交付约定数量和质量。', outcome: '履约确认并获得付款。', risk: '交付证据不足。', money: '付款取决于验收数量和依据完整性。' },
      buyer: { label: '买方', value: '控制条款、验收、质量和付款依据。', action: '确认交付符合要求。', documents: '条款、质检报告、验收单和结算。', responsibility: '接收合格交付并确认依据。', outcome: '获得质量可核验的商品。', risk: '为未确认数量或质量付款。', money: '结算金额与实际履约关联。' },
      logistics: { label: '物流', value: '管理承运人、运输任务、路线和偏差。', action: '确保运输任务到达。', documents: '任务、路线、运输事件和到达确认。', responsibility: '在约定窗口内送达。', outcome: '运输完成并关联验收。', risk: '延误或事件链断裂。', money: '运输履约影响可扣减金额。' },
      driver: { label: '司机', value: '接收运输任务、检查点和下一步操作。', action: '确认到达。', documents: '运输任务、路线和运输文件。', responsibility: '提交可验证的运输事件。', outcome: '到达后开放验收。', risk: '检查点未确认。', money: '承运付款需要任务确认。' },
      elevator: { label: '粮库', value: '记录到达、重量、验收及批次关联。', action: '确认实际重量。', documents: '运输任务、票据、验收单和称重数据。', responsibility: '生成可靠的验收依据。', outcome: '验收数量进入质量控制。', risk: '重量不符或批次错误。', money: '验收数量影响结算。' },
      lab: { label: '实验室', value: '将样品、方法和结果关联到具体批次。', action: '签署质量报告。', documents: '样品、方法、报告和结果版本。', responsibility: '记录可复核结果。', outcome: '质量与条款完成比对。', risk: '报告关联错误批次。', money: '质量偏差会改变可结算金额。' },
      surveyor: { label: '检验人', value: '为争议事件生成独立证据。', action: '完成独立检查记录。', documents: '检查单、照片、时间和关联对象。', responsibility: '保存中立证据链。', outcome: '争议获得独立依据。', risk: '记录不完整或不可复核。', money: '证据影响争议金额。' },
      bank: { label: '银行', value: '查看金额、依据、付款、对账和争议部分。', action: '核验依据集合。', documents: '合同依据、验收、质量和争议决定。', responsibility: '仅在允许事件下执行资金操作。', outcome: '可审计结算与对账。', risk: '依据不完整或相互矛盾。', money: '按场景全额、部分或延后结算。' },
      operator: { label: '运营方', value: '管理阻塞项、责任人和时间线。', action: '解除运营阻塞。', documents: '全部事件、状态、文件和决定。', responsibility: '保持跨企业流程一致性。', outcome: '交易连续推进且不丢失上下文。', risk: '参与方状态不一致。', money: '控制资金依据就绪度，但不替银行决策。' },
      compliance: { label: '合规', value: '检查准入、授权和关键不一致。', action: '完成准入检查。', documents: '企业资料、授权、决定和日志。', responsibility: '阻止不允许的状态转换。', outcome: '参与方基于可验证依据准入。', risk: '遗漏限制或数据冲突。', money: '未准入参与方会阻塞资金流程。' },
      arbitrator: { label: '仲裁方', value: '汇总双方立场、证据和资金后果。', action: '判断证据充分性。', documents: '立场、版本、报告、记录和时间线。', responsibility: '在程序内作出有依据的决定。', outcome: '争议以明确后果结束。', risk: '在证据包不完整时作出决定。', money: '决定划分争议与无争议金额。' },
      executive: { label: '管理者', value: '查看组合、异常、资金和系统性原因。', action: '消除重复出现的偏差来源。', documents: '聚合事件及可核验原始依据。', responsibility: '无需干预每笔操作即可管理结果。', outcome: '降低损失、周期和人工处理比例。', risk: '指标缺少原始依据。', money: '控制 GMV、收入、争议金额和结算速度。' },
    },
    scenarios: { standard: { label: '正常', summary: '交付已确认、质量符合、文件齐全。', amount: '全额：6,900,000 卢布', blocker: '无资金阻塞项', outcome: '依据核验后全额结算。' }, partial: { label: '部分', summary: '500 吨中已交付并验收 420 吨。', amount: '可结算：5,796,000 卢布 · 余额等待履约', blocker: '80 吨尚未确认', outcome: '部分结算，余额继续等待。' }, dispute: { label: '争议', summary: '发现重量和质量偏差。', amount: '无争议金额与争议金额分离', blocker: '争议部分需要决定', outcome: '证据 → 决定 → 最终结算。' } },
    documents: [
      { name: '验收单', type: '验收', party: '批次 B-2408', trip: '运输任务 R-318', creator: '粮库', signer: '授权员工', timestamp: '2026-07-14 · 11:42', version: 'v1.0', status: '等待签署', checksum: '71af…c904', basis: '确认实际验收数量。' },
      { name: '质量报告', type: '实验室', party: '批次 B-2408', trip: '运输任务 R-318', creator: '实验室', signer: '检验员', timestamp: '2026-07-14 · 12:18', version: 'v1.0', status: '已确认', checksum: '9bc2…a811', basis: '允许将质量与条款进行比对。' },
      { name: '结算依据', type: '资金', party: '批次 B-2408', trip: '运输任务 R-318', creator: '平台', signer: '不适用', timestamp: '完整后生成', version: 'v0.4', status: '未就绪', checksum: '待生成', basis: '允许向银行侧传递经核验的依据。' },
    ],
    risks: {
      transportDelay: { label: '运输延误', event: '运输任务超过约定到达窗口。', blocked: '按时验收。', owner: '物流', evidence: '路线、检查点和偏差原因。', deadline: '2 小时', outcome: '新窗口、扣减或争议。' },
      weightMismatch: { label: '重量不符', event: '实际重量与申报重量不同。', blocked: '确认全部数量。', owner: '粮库与检验人', evidence: '称重数据、记录和独立证据。', deadline: '4 小时', outcome: '修正数量或进入争议。' },
      qualityDeviation: { label: '质量偏差', event: '某项指标不符合条款。', blocked: '全额结算。', owner: '实验室', evidence: '样品、方法和已签署报告。', deadline: '1 个工作日', outcome: '重新计价、拒收或争议。' },
      missingDocument: { label: '文件缺失', event: '依据集合中缺少必需文件。', blocked: '传递资金依据。', owner: '运营方与文件责任方', evidence: '所需已签署文件。', deadline: '结算窗口前', outcome: '补充请求或延后结算。' },
      documentVersion: { label: '文件版本变化', event: '批准后出现新版本。', blocked: '继续使用旧依据。', owner: '文件创建方', evidence: '版本历史、签名和校验和。', deadline: '4 小时', outcome: '接受新版本或进入争议。' },
      paymentBasis: { label: '付款依据不完整', event: '事件和文件尚未形成完整集合。', blocked: '资金操作。', owner: '运营方与银行', evidence: '缺失的履约确认。', deadline: '下一结算窗口前', outcome: '等待、部分结算或争议。' },
    },
    aiSignals: [
      { title: '条款不一致', why: '文件中的数量与交易卡片不同。', object: '验收单 · 批次 B-2408', recommendation: '签署前核对版本。', confidence: '高 · 92%' },
      { title: '时限风险', why: '临近结算窗口，但验收单尚未签署。', object: '“文件”阶段', recommendation: '指定责任人并请求签署。', confidence: '中 · 78%' },
      { title: '依据不足', why: '质量报告未关联当前样品。', object: '质量报告', recommendation: '核验样品与批次关联。', confidence: '高 · 89%' },
    ],
    boundaries: { title: '公共示例边界', text: '该界面不读取真实交易、不改变角色、不调用国家系统、电子文件交换、统一身份系统或银行，也不执行资金操作。', ai: 'AI 仅显示建议，不确认具有法律意义的操作、不决定付款，也不裁决争议。' },
  },
};

export const PUBLIC_PRODUCT_EXPERIENCE_COPY: Record<AppLocale, PublicProductExperienceCopy> = { ru, en, zh };

export function getPublicProductExperienceCopy(locale: string): PublicProductExperienceCopy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return PUBLIC_PRODUCT_EXPERIENCE_COPY[resolved];
}
