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
      kicker: 'Агросделка в растениеводстве',
      title: 'Одна Сделка — от условий до расчёта.',
      lead: 'Участники, поставка, приёмка, качество, документы и расчётные основания связаны одной проверяемой историей.',
      primary: 'Посмотреть, как работает Сделка',
      secondary: 'Зарегистрироваться',
    },
    preview: {
      eyebrow: 'Вымышленный пример Сделки',
      title: 'Подсолнечник · пример исполнения',
      commodity: 'Подсолнечник',
      volume: '1 200 тонн',
      price: 'Цена по условиям примера',
      route: 'Тамбовская область — Воронежская область',
      nowLabel: 'Сейчас',
      nowValue: 'Приёмка и качество',
      requiredLabel: 'Требуется',
      requiredValue: 'Подтвердить фактическое исполнение',
      ownerLabel: 'Ответственный',
      ownerValue: 'Покупатель / площадка приёмки',
      afterLabel: 'После подтверждения',
      afterValue: 'Документы и готовность расчёта',
      lenses: {
        execution: { label: 'Исполнение', value: 'Шаг 5 из 7: приёмка и качество' },
        documents: { label: 'Документы', value: 'Версии и комплектность проверяются по событиям Сделки' },
        money: { label: 'Деньги', value: 'Финансовое действие требует подтверждённых оснований' },
        risk: { label: 'Риск', value: 'Отклонение открывает отдельную ветку урегулирования' },
      },
      open: 'Открыть подробный разбор',
    },
    perspectives: {
      title: 'Посмотрите на Сделку со своей стороны',
      lead: 'Публичный выбор роли меняет только объяснение и не назначает права.',
      all: 'Роли Сделки',
      primary: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator'],
      secondary: [],
    },
    proof: {
      title: 'Доказательства связаны с исполнением',
      rows: [
        'Каждое подтверждение связано с участником и событием',
        'Каждая версия документа связана со Сделкой',
        'Финансовое действие требует основания',
        'Решения остаются в хронологии',
      ],
    },
    final: {
      title: 'Начните работу с платформой',
      primary: 'Зарегистрироваться',
      secondary: 'Посмотреть Сделку',
      signInPrefix: 'Уже есть доступ?',
      signIn: 'Войти',
    },
  },
  explorer: {
    metaTitle: 'Подробный разбор агросделки — Прозрачная Цена',
    metaDescription: 'Публичный разбор вымышленной агросделки в растениеводстве: семь понятных шагов раскрыты в десять операционных этапов без доступа к реальным данным.',
    kicker: 'Подробный разбор Сделки',
    title: 'Семь шагов — в операционной детализации',
    lead: 'Обычный путь из 7 шагов здесь раскрыт в 10 операционных этапов, чтобы отдельно показать допуск, торги, лабораторную проверку и закрытие. Это детализация одной Сделки, а не второй маршрут.',
    exampleBadge: 'Вымышленный пример',
    connect: 'Зарегистрироваться',
    backHome: 'На главную',
    deal: {
      idLabel: 'Пример', id: 'Вымышленная Сделка', commodityLabel: 'Товар', commodity: 'Подсолнечник', classLabel: 'Категория', classValue: 'Продукция растениеводства', volumeLabel: 'Объём', volume: '1 200 тонн', priceLabel: 'Цена', price: 'По условиям примера', amountLabel: 'Расчёт', amount: 'После подтверждения оснований', routeLabel: 'Маршрут', route: 'Тамбовская область — Воронежская область', stageLabel: 'Операционный этап', statusLabel: 'Статус', status: 'Требуется действие', ownerLabel: 'Ответственный', nextLabel: 'Следующее действие', blockerLabel: 'Что мешает', noBlocker: 'Активного блокера нет',
    },
    controls: {
      lens: 'Что проверить', perspective: 'Роль', scenario: 'Сценарий', stage: 'Операционный этап', risk: 'Риск', previous: 'Назад', next: 'Далее', startGuide: 'Показать путь Сделки', pause: 'Пауза', continue: 'Продолжить', stop: 'Остановить', aiToggle: 'Показать Гекту', allParticipants: 'Роли Сделки', openDocument: 'Показать основание', closeDocument: 'Скрыть основание',
    },
    labels: {
      happened: 'Что произошло', responsible: 'Кто отвечает', action: 'Что требуется', evidence: 'Какое основание возникает', transition: 'Что станет доступно дальше', visibleDocuments: 'Связанные документы', responsibility: 'Ответственность', expectedOutcome: 'Ожидаемый результат', roleRisk: 'Риск роли', moneyContext: 'Влияние на расчёт', event: 'Событие', document: 'Документ', signature: 'Подпись', version: 'Версия', allowedAction: 'Разрешённое действие', confidence: 'Основание вывода', affectedObject: 'Затронутый объект', recommendation: 'Следующий шаг', whyImportant: 'Почему это важно', blockedAction: 'Заблокированное действие', deadline: 'Контрольный срок', outcome: 'Возможный исход', disputedAmount: 'Спорная часть',
    },
    lenses: {
      execution: { label: 'Исполнение', summary: 'События, ответственность и разрешённые переходы.' },
      participants: { label: 'Участники', summary: 'Одна Сделка с разными задачами и правами.' },
      documents: { label: 'Документы', summary: 'Документы как проверяемые основания событий и расчёта.' },
      money: { label: 'Расчёт', summary: 'Какие подтверждения позволяют перейти к финансовому действию.' },
      risk: { label: 'Риски и отклонения', summary: 'Блокировки, доказательства, позиции сторон и последствия.' },
      intelligence: { label: 'Гекта', summary: 'Объяснение фактов и риска без самостоятельного принятия решений.' },
    },
    stages: {
      terms: { label: 'Товар и условия', happened: 'Стороны зафиксировали товар, объём, цену, качество и правила исполнения.', owner: 'Покупатель и продавец', action: 'Проверить согласованную версию условий.', evidence: 'Версия условий с авторством и временем.', next: 'Открывается проверка допуска.' },
      admission: { label: 'Допуск', happened: 'Проверяются организация, полномочия и обязательные сведения.', owner: 'Сотрудник платформы', action: 'Закрыть выявленные несоответствия.', evidence: 'Решение о допуске и журнал проверки.', next: 'Разрешается участие в торгах.' },
      auction: { label: 'Торги', happened: 'Предложения и ставки фиксируются по правилам торгов.', owner: 'Сотрудник платформы', action: 'Зафиксировать результат выбора контрагента.', evidence: 'История ставок и результат торгов.', next: 'Создаётся основание Сделки.' },
      deal: { label: 'Сделка и договор', happened: 'Согласованные условия становятся обязательствами конкретной Сделки.', owner: 'Покупатель и продавец', action: 'Подтвердить обязательства сторон.', evidence: 'Карточка Сделки и версия договорных условий.', next: 'Открывается физическое исполнение.' },
      logistics: { label: 'Логистика и поставка', happened: 'Назначены перевозчик, водитель, транспорт, маршрут и рейс.', owner: 'Логистика', action: 'Подтвердить готовность и события рейса.', evidence: 'Рейс, маршрут и транспортные события.', next: 'Прибытие открывает приёмку.' },
      acceptance: { label: 'Приёмка', happened: 'Партия прибыла на площадку; фиксируются вес и состояние.', owner: 'Элеватор / хранение', action: 'Подтвердить фактическую приёмку.', evidence: 'Акт приёмки, вес, время и связанный рейс.', next: 'Открывается проверка качества.' },
      laboratory: { label: 'Качество', happened: 'Результат лаборатории сопоставляется с условиями Сделки.', owner: 'Лаборатория', action: 'Подтвердить пробу, методику и результат.', evidence: 'Проба, методика и протокол качества.', next: 'Проверяется комплект документов.' },
      documents: { label: 'Документы', happened: 'Собираются версии и подтверждения по поставке, приёмке и качеству.', owner: 'Стороны и сотрудник платформы', action: 'Закрыть недостающие основания.', evidence: 'Подтверждённые версии документов и их связь с событиями.', next: 'Проверяется готовность расчёта.' },
      settlement: { label: 'Расчёт', happened: 'Подтверждённые события и документы сопоставляются с условиями расчёта.', owner: 'Банк / финансы', action: 'Проверить основание финансового действия.', evidence: 'Расчётная версия и подтверждённые основания.', next: 'После финансового результата Сделка переходит к закрытию.' },
      closure: { label: 'Закрытие', happened: 'Обязательства, документы и финансовый результат сведены в итог.', owner: 'Сотрудник платформы', action: 'Зафиксировать завершение обязательств.', evidence: 'Итоговая хронология и доказательный пакет.', next: 'История остаётся доступна для проверки и аналитики.' },
    },
    perspectives: {
      seller: { label: 'Продавец', value: 'Видит товар, поставку, документы и готовность расчёта.', action: 'Подтвердить исполнение своих обязательств.', documents: 'Условия, документы поставки, приёмка и качество.', responsibility: 'Поставить согласованный объём и качество.', outcome: 'Подтверждённое исполнение и понятный расчётный статус.', risk: 'Недостаточное подтверждение поставки.', money: 'Расчёт зависит от принятого объёма и подтверждённых оснований.' },
      buyer: { label: 'Покупатель', value: 'Контролирует условия, приёмку, качество и основание оплаты.', action: 'Подтвердить соответствие поставки.', documents: 'Условия, приёмка, протокол качества и расчётная версия.', responsibility: 'Принять соответствующую поставку и подтвердить основания.', outcome: 'Полученный товар с проверяемым качеством.', risk: 'Финансовое действие по неподтверждённому исполнению.', money: 'Расчёт связан с фактическим исполнением.' },
      logistics: { label: 'Логистика', value: 'Управляет перевозчиком, рейсом, маршрутом и отклонениями.', action: 'Обеспечить и подтвердить доставку.', documents: 'Заявка, маршрут и транспортные события.', responsibility: 'Доставить партию в согласованное окно.', outcome: 'Рейс завершён и связан с приёмкой.', risk: 'Задержка или потеря связности событий.', money: 'Основание расчёта за перевозку подтверждается отдельно от товара.' },
      driver: { label: 'Водитель', value: 'Получает рейс, контрольные точки и ближайшее действие.', action: 'Подтвердить прибытие и передачу груза.', documents: 'Рейс, маршрут и доступные перевозочные документы.', responsibility: 'Передавать подтверждённые события рейса.', outcome: 'Доставка подтверждена без доступа к чужим данным.', risk: 'Неподтверждённая контрольная точка.', money: 'Факт выполнения рейса подтверждается отдельно от коммерческих условий товара.' },
      elevator: { label: 'Элеватор / хранение', value: 'Фиксирует прибытие, вес, приёмку, размещение и статус партии.', action: 'Подтвердить фактическую приёмку.', documents: 'Рейс, весовые данные, акт приёмки и статус партии.', responsibility: 'Создать достоверное основание приёмки.', outcome: 'Количество подтверждено и передано в контроль качества.', risk: 'Расхождение веса или неверная партия.', money: 'Фактический принятый объём влияет на расчёт.' },
      lab: { label: 'Лаборатория', value: 'Связывает пробу, методику и результат с конкретной партией.', action: 'Подтвердить протокол качества.', documents: 'Проба, методика, протокол и версия результата.', responsibility: 'Зафиксировать воспроизводимый результат.', outcome: 'Качество сопоставлено с условиями.', risk: 'Результат связан не с той пробой или партией.', money: 'Качество может влиять на расчёт, но не запускает его само.' },
      surveyor: { label: 'Сюрвейер', value: 'Создаёт независимое доказательство спорного факта.', action: 'Зафиксировать независимую проверку.', documents: 'Акт, фото, измерения и связанный объект.', responsibility: 'Сохранить нейтральную доказательную цепочку.', outcome: 'Стороны получают независимое основание.', risk: 'Неполная или невоспроизводимая фиксация.', money: 'Заключение влияет на перерасчёт или спор, но не заменяет решение сторон.' },
      bank: { label: 'Банк / финансы', value: 'Видит расчётные основания и финансовые блокеры.', action: 'Проверить подтверждённое основание.', documents: 'Условия расчёта, приёмка, качество и документы.', responsibility: 'Исполнять финансовое действие только по допустимому основанию.', outcome: 'Проверяемый финансовый результат.', risk: 'Неполное или противоречивое основание.', money: 'Финансовый контур подтверждает фактическое движение денег.' },
      operator: { label: 'Сотрудник платформы', value: 'Контролирует блокеры, ответственных, сроки и хронологию.', action: 'Определить причину остановки и разрешённый следующий шаг.', documents: 'События, статусы, версии документов и решения.', responsibility: 'Сохранить целостность процесса между участниками.', outcome: 'Сделка проходит без потери контекста.', risk: 'Несогласованное состояние участников.', money: 'Видит денежное последствие, но не получает полномочия банка или стороны Сделки.' },
      compliance: { label: 'Сотрудник платформы', value: 'Внутренняя функция проверки допуска и полномочий.', action: 'Проверить основание допуска.', documents: 'Профиль организации, полномочия и журнал.', responsibility: 'Не допустить запрещённый переход.', outcome: 'Допуск опирается на проверяемое основание.', risk: 'Пропущенное ограничение.', money: 'Не создаёт самостоятельного права на финансовое действие.' },
      arbitrator: { label: 'Сотрудник платформы', value: 'Внутренняя функция сопровождения разногласий.', action: 'Собрать позиции и доказательства в одной хронологии.', documents: 'Позиции, версии, протоколы, акты и события.', responsibility: 'Соблюдать процедуру и границы полномочий.', outcome: 'Разногласие имеет проверяемую доказательную базу.', risk: 'Решение без достаточных оснований.', money: 'Не определяет движение денег вне разрешённой процедуры.' },
      executive: { label: 'Сотрудник платформы', value: 'Внутренняя функция контроля повторяющихся операционных рисков.', action: 'Устранить системную причину отклонений.', documents: 'Агрегированные события с первичными основаниями.', responsibility: 'Управлять качеством процесса без подмены участников.', outcome: 'Снижается число повторяющихся блокеров.', risk: 'Вывод без первичных подтверждений.', money: 'Аналитика не заменяет подтверждённый финансовый результат.' },
    },
    scenarios: {
      standard: { label: 'Обычный', summary: 'Поставка подтверждена, качество соответствует, документы проверяются.', amount: 'Расчёт после подтверждения оснований', blocker: 'Критического блокера нет', outcome: 'Обычное закрытие после проверки документов и финансового результата.' },
      partial: { label: 'Частичная приёмка', summary: 'Принята только часть согласованного объёма.', amount: 'Расчёт только по подтверждённому объёму', blocker: 'Остаток объёма не подтверждён', outcome: 'Подтверждённая часть и остаток учитываются отдельно.' },
      dispute: { label: 'Отклонение / спор', summary: 'Обнаружено расхождение количества или качества.', amount: 'Бесспорная часть отделена от спорной', blocker: 'Спорная часть требует решения', outcome: 'Доказательства → решение сторон или процедура → итоговый расчёт.' },
    },
    documents: [
      { name: 'Акт приёмки', type: 'Приёмка', party: 'Партия примера', trip: 'Рейс примера', creator: 'Элеватор / хранение', signer: 'Уполномоченный участник', timestamp: 'После события приёмки', version: 'Текущая версия', status: 'Требует подтверждения', checksum: 'Не публикуется в примере', basis: 'Подтверждает фактический принятый объём.' },
      { name: 'Протокол качества', type: 'Лаборатория', party: 'Партия примера', trip: 'Рейс примера', creator: 'Лаборатория', signer: 'Уполномоченный специалист', timestamp: 'После проверки качества', version: 'Текущая версия', status: 'Подтверждён', checksum: 'Не публикуется в примере', basis: 'Позволяет сопоставить качество с условиями.' },
      { name: 'Расчётное основание', type: 'Расчёт', party: 'Партия примера', trip: 'Рейс примера', creator: 'Платформа', signer: 'Не применимо', timestamp: 'После комплектности оснований', version: 'Рабочая версия', status: 'Не готово', checksum: 'Не публикуется в примере', basis: 'Показывает, какие подтверждения нужны до финансового действия.' },
    ],
    risks: {
      transportDelay: { label: 'Задержка транспорта', event: 'Рейс вышел за согласованное окно прибытия.', blocked: 'Своевременная приёмка.', owner: 'Логистика', evidence: 'Маршрут, контрольные точки и причина отклонения.', deadline: 'По условиям Сделки', outcome: 'Новое окно, согласованное последствие или разногласие.' },
      weightMismatch: { label: 'Расхождение веса', event: 'Фактический вес отличается от согласованного или заявленного.', blocked: 'Подтверждение полного объёма.', owner: 'Элеватор / хранение и сюрвейер', evidence: 'Весовые данные, акт и независимая фиксация.', deadline: 'По условиям Сделки', outcome: 'Корректировка объёма или разногласие.' },
      qualityDeviation: { label: 'Отклонение качества', event: 'Показатель не соответствует условиям.', blocked: 'Полная готовность расчёта.', owner: 'Лаборатория', evidence: 'Проба, методика и подтверждённый протокол.', deadline: 'По условиям Сделки', outcome: 'Перерасчёт, повторная проверка или разногласие.' },
      missingDocument: { label: 'Отсутствующий документ', event: 'В комплекте нет обязательного основания.', blocked: 'Готовность финансового действия.', owner: 'Сторона документа и сотрудник платформы', evidence: 'Требуемый подтверждённый документ.', deadline: 'До расчётного действия', outcome: 'Дозапрос или перенос следующего шага.' },
      documentVersion: { label: 'Изменённая версия документа', event: 'После подтверждения появилась новая версия.', blocked: 'Использование прежнего основания.', owner: 'Создатель документа', evidence: 'История версий и подтверждений.', deadline: 'По условиям Сделки', outcome: 'Принятие новой версии или разногласие.' },
      paymentBasis: { label: 'Неполное расчётное основание', event: 'События и документы не образуют полный комплект.', blocked: 'Финансовое действие.', owner: 'Стороны, сотрудник платформы и банк / финансы', evidence: 'Недостающие подтверждения исполнения.', deadline: 'До финансового действия', outcome: 'Ожидание, частичный расчёт или отдельное решение.' },
    },
    aiSignals: [
      { title: 'Расхождение условий', why: 'Версия документа не совпадает с текущими условиями Сделки.', object: 'Документ примера', recommendation: 'Сверить версию до подтверждения.', confidence: 'Основано на доступных фактах' },
      { title: 'Риск срока', why: 'До следующего контрольного действия не закрыто обязательное основание.', object: 'Этап «Документы»', recommendation: 'Показать ответственного и недостающее подтверждение.', confidence: 'Требует проверки пользователем' },
      { title: 'Недостаточное основание', why: 'Результат качества не связан с текущей пробой.', object: 'Протокол качества', recommendation: 'Проверить связь пробы, партии и протокола.', confidence: 'Положительный вывод не формируется без связи' },
    ],
    boundaries: {
      title: 'Граница публичного примера',
      text: 'Этот интерфейс не читает реальные Сделки, не меняет роли, не вызывает внешнюю систему от имени пользователя и не выполняет денежные операции.',
      ai: 'Гекта объясняет доступные факты и варианты действий. Она не подписывает документы, не назначает роли, не принимает решение по выплате и не разрешает спор.',
    },
  },
} as const;

export type PublicProductExperienceCopy = DeepWiden<typeof ru>;

const en: PublicProductExperienceCopy = {
  header: { aria: 'Public navigation', brandHome: 'Transparent Price — home', signIn: 'Sign in' },
  home: {
    hero: { kicker: 'Crop Deal workflow', title: 'One Deal from terms to settlement.', lead: 'Participants, delivery, acceptance, quality, documents and settlement grounds share one verifiable history.', primary: 'See how a Deal works', secondary: 'Register' },
    preview: {
      eyebrow: 'Fictional Deal example', title: 'Sunflower · execution example', commodity: 'Sunflower', volume: '1,200 tonnes', price: 'Price from the example terms', route: 'Tambov Region — Voronezh Region', nowLabel: 'Current step', nowValue: 'Acceptance and quality', requiredLabel: 'Required', requiredValue: 'Confirm actual execution', ownerLabel: 'Responsible', ownerValue: 'Buyer / acceptance site', afterLabel: 'After confirmation', afterValue: 'Documents and settlement readiness',
      lenses: { execution: { label: 'Execution', value: 'Step 5 of 7: acceptance and quality' }, documents: { label: 'Documents', value: 'Versions and completeness are checked against Deal events' }, money: { label: 'Money', value: 'A financial action requires confirmed grounds' }, risk: { label: 'Risk', value: 'A deviation opens a separate resolution branch' } }, open: 'Open detailed review',
    },
    perspectives: { title: 'View the Deal from your role', lead: 'A public role choice changes only the explanation and never grants permissions.', all: 'Deal roles', primary: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator'], secondary: [] },
    proof: { title: 'Evidence stays linked to execution', rows: ['Every confirmation is tied to a participant and event', 'Every document version stays linked to the Deal', 'A financial action requires grounds', 'Decisions remain in chronology'] },
    final: { title: 'Start using the platform', primary: 'Register', secondary: 'View the Deal', signInPrefix: 'Already have access?', signIn: 'Sign in' },
  },
  explorer: {
    metaTitle: 'Detailed agricultural Deal review — Transparent Price', metaDescription: 'Public review of a fictional crop Deal: seven understandable steps expanded into ten operational stages without access to real data.', kicker: 'Detailed Deal review', title: 'Seven steps in operational detail', lead: 'The ordinary 7-step journey is expanded into 10 operational stages so admission, bidding, laboratory checks and closure stay explicit. This is one Deal at a finer level, not a second journey.', exampleBadge: 'Fictional example', connect: 'Register', backHome: 'Back to home',
    deal: { idLabel: 'Example', id: 'Fictional Deal', commodityLabel: 'Product', commodity: 'Sunflower', classLabel: 'Category', classValue: 'Crop product', volumeLabel: 'Volume', volume: '1,200 tonnes', priceLabel: 'Price', price: 'From example terms', amountLabel: 'Settlement', amount: 'After grounds are confirmed', routeLabel: 'Route', route: 'Tambov Region — Voronezh Region', stageLabel: 'Operational stage', statusLabel: 'Status', status: 'Action required', ownerLabel: 'Responsible', nextLabel: 'Next action', blockerLabel: 'What blocks progress', noBlocker: 'No active blocker' },
    controls: { lens: 'What to review', perspective: 'Role', scenario: 'Scenario', stage: 'Operational stage', risk: 'Risk', previous: 'Back', next: 'Next', startGuide: 'Walk through the Deal', pause: 'Pause', continue: 'Continue', stop: 'Stop', aiToggle: 'Show Gekta', allParticipants: 'Deal roles', openDocument: 'Show grounds', closeDocument: 'Hide grounds' },
    labels: { happened: 'What happened', responsible: 'Who is responsible', action: 'What is required', evidence: 'Evidence created', transition: 'What becomes available next', visibleDocuments: 'Linked documents', responsibility: 'Responsibility', expectedOutcome: 'Expected outcome', roleRisk: 'Role risk', moneyContext: 'Settlement impact', event: 'Event', document: 'Document', signature: 'Signature', version: 'Version', allowedAction: 'Allowed action', confidence: 'Basis of conclusion', affectedObject: 'Affected object', recommendation: 'Next step', whyImportant: 'Why it matters', blockedAction: 'Blocked action', deadline: 'Control deadline', outcome: 'Possible outcome', disputedAmount: 'Disputed part' },
    lenses: { execution: { label: 'Execution', summary: 'Events, responsibility and permitted transitions.' }, participants: { label: 'Participants', summary: 'One Deal with different tasks and permissions.' }, documents: { label: 'Documents', summary: 'Documents as verifiable grounds for events and settlement.' }, money: { label: 'Settlement', summary: 'Which confirmations allow a financial action to proceed.' }, risk: { label: 'Risks and deviations', summary: 'Blocks, evidence, party positions and consequences.' }, intelligence: { label: 'Gekta', summary: 'Explains facts and risk without independent decision authority.' } },
    stages: {
      terms: { label: 'Product and terms', happened: 'The parties fixed product, volume, price, quality and execution rules.', owner: 'Buyer and seller', action: 'Check the agreed terms version.', evidence: 'Versioned terms with authorship and time.', next: 'Admission checks open.' },
      admission: { label: 'Admission', happened: 'Organisation, authority and mandatory details are checked.', owner: 'Platform employee', action: 'Resolve identified mismatches.', evidence: 'Admission decision and check log.', next: 'Participation in bidding is allowed.' },
      auction: { label: 'Bidding', happened: 'Offers and bids are recorded under the trading rules.', owner: 'Platform employee', action: 'Record the counterparty-selection result.', evidence: 'Bid history and trading result.', next: 'The Deal basis is created.' },
      deal: { label: 'Deal and contract', happened: 'Agreed terms become obligations of a specific Deal.', owner: 'Buyer and seller', action: 'Confirm party obligations.', evidence: 'Deal record and contract-terms version.', next: 'Physical execution opens.' },
      logistics: { label: 'Logistics and delivery', happened: 'Carrier, driver, vehicle, route and trip are assigned.', owner: 'Logistics', action: 'Confirm trip readiness and events.', evidence: 'Trip, route and transport events.', next: 'Arrival opens acceptance.' },
      acceptance: { label: 'Acceptance', happened: 'The lot arrives at the site; weight and condition are recorded.', owner: 'Elevator / storage', action: 'Confirm actual acceptance.', evidence: 'Acceptance act, weight, time and linked trip.', next: 'Quality verification opens.' },
      laboratory: { label: 'Quality', happened: 'The laboratory result is compared with Deal terms.', owner: 'Laboratory', action: 'Confirm sample, method and result.', evidence: 'Sample, method and quality protocol.', next: 'Document completeness is checked.' },
      documents: { label: 'Documents', happened: 'Versions and confirmations for delivery, acceptance and quality are assembled.', owner: 'Parties and platform employee', action: 'Close missing grounds.', evidence: 'Confirmed document versions linked to events.', next: 'Settlement readiness is checked.' },
      settlement: { label: 'Settlement', happened: 'Confirmed events and documents are matched to settlement terms.', owner: 'Bank / finance', action: 'Check the financial-action basis.', evidence: 'Settlement version and confirmed grounds.', next: 'After the financial result the Deal moves to closure.' },
      closure: { label: 'Closure', happened: 'Obligations, documents and the financial result are reconciled.', owner: 'Platform employee', action: 'Record obligation completion.', evidence: 'Final chronology and evidence pack.', next: 'History remains available for review and analytics.' },
    },
    perspectives: {
      seller: { label: 'Seller', value: 'Sees product, delivery, documents and settlement readiness.', action: 'Confirm performance of seller obligations.', documents: 'Terms, delivery documents, acceptance and quality.', responsibility: 'Deliver the agreed volume and quality.', outcome: 'Confirmed execution and clear settlement status.', risk: 'Insufficient delivery evidence.', money: 'Settlement depends on accepted volume and confirmed grounds.' },
      buyer: { label: 'Buyer', value: 'Controls terms, acceptance, quality and payment basis.', action: 'Confirm delivery conformity.', documents: 'Terms, acceptance, quality protocol and settlement version.', responsibility: 'Accept compliant delivery and confirm grounds.', outcome: 'Received product with verifiable quality.', risk: 'Financial action on unconfirmed execution.', money: 'Settlement stays linked to actual execution.' },
      logistics: { label: 'Logistics', value: 'Manages carrier, trip, route and deviations.', action: 'Ensure and confirm delivery.', documents: 'Order, route and transport events.', responsibility: 'Deliver within the agreed window.', outcome: 'Trip completed and linked to acceptance.', risk: 'Delay or broken event continuity.', money: 'Freight grounds are confirmed separately from product settlement.' },
      driver: { label: 'Driver', value: 'Receives the trip, checkpoints and nearest action.', action: 'Confirm arrival and cargo handover.', documents: 'Trip, route and permitted transport documents.', responsibility: 'Provide confirmed trip events.', outcome: 'Delivery confirmed without unrelated data access.', risk: 'Unconfirmed checkpoint.', money: 'Trip completion is confirmed separately from product commercial terms.' },
      elevator: { label: 'Elevator / storage', value: 'Records arrival, weight, acceptance, placement and lot state.', action: 'Confirm actual acceptance.', documents: 'Trip, weight data, acceptance act and lot status.', responsibility: 'Create reliable acceptance evidence.', outcome: 'Quantity confirmed and passed to quality control.', risk: 'Weight mismatch or wrong lot.', money: 'Accepted quantity affects settlement.' },
      lab: { label: 'Laboratory', value: 'Links sample, method and result to a specific lot.', action: 'Confirm the quality protocol.', documents: 'Sample, method, protocol and result version.', responsibility: 'Record a reproducible result.', outcome: 'Quality is compared with terms.', risk: 'Result linked to the wrong sample or lot.', money: 'Quality may affect settlement but never triggers it by itself.' },
      surveyor: { label: 'Surveyor', value: 'Creates independent evidence for a disputed fact.', action: 'Record an independent verification.', documents: 'Act, photos, measurements and linked object.', responsibility: 'Preserve a neutral evidence chain.', outcome: 'The parties receive independent evidence.', risk: 'Incomplete or non-reproducible record.', money: 'The conclusion may affect recalculation or dispute but does not replace party authority.' },
      bank: { label: 'Bank / finance', value: 'Sees settlement grounds and financial blockers.', action: 'Check the confirmed basis.', documents: 'Settlement terms, acceptance, quality and documents.', responsibility: 'Execute a financial action only on an allowed basis.', outcome: 'Verifiable financial result.', risk: 'Incomplete or conflicting basis.', money: 'The financial circuit confirms actual money movement.' },
      operator: { label: 'Platform employee', value: 'Controls blockers, owners, deadlines and chronology.', action: 'Identify the cause of a stop and the next permitted step.', documents: 'Events, statuses, document versions and decisions.', responsibility: 'Preserve process integrity between participants.', outcome: 'The Deal progresses without context loss.', risk: 'Inconsistent participant states.', money: 'Sees monetary impact without inheriting bank or party authority.' },
      compliance: { label: 'Platform employee', value: 'Internal admission and authority-control function.', action: 'Check the admission basis.', documents: 'Organisation profile, authority and log.', responsibility: 'Prevent a forbidden transition.', outcome: 'Admission relies on verifiable grounds.', risk: 'A missed restriction.', money: 'Creates no independent financial authority.' },
      arbitrator: { label: 'Platform employee', value: 'Internal discrepancy-support function.', action: 'Assemble positions and evidence in one chronology.', documents: 'Positions, versions, protocols, acts and events.', responsibility: 'Observe procedure and authority boundaries.', outcome: 'The discrepancy has a verifiable evidence base.', risk: 'Decision without sufficient grounds.', money: 'Does not determine money movement outside the allowed procedure.' },
      executive: { label: 'Platform employee', value: 'Internal control of recurring operational risk.', action: 'Remove a systemic cause of deviations.', documents: 'Aggregated events with primary evidence.', responsibility: 'Manage process quality without replacing participants.', outcome: 'Recurring blockers decrease.', risk: 'A conclusion without primary confirmations.', money: 'Analytics never replaces the confirmed financial result.' },
    },
    scenarios: { standard: { label: 'Ordinary', summary: 'Delivery confirmed, quality compliant, documents under review.', amount: 'Settlement after grounds are confirmed', blocker: 'No critical blocker', outcome: 'Ordinary closure after document checks and financial result.' }, partial: { label: 'Partial acceptance', summary: 'Only part of the agreed volume was accepted.', amount: 'Settlement only for confirmed volume', blocker: 'Remaining volume is unconfirmed', outcome: 'Confirmed part and remaining volume are tracked separately.' }, dispute: { label: 'Deviation / dispute', summary: 'A quantity or quality discrepancy was found.', amount: 'Undisputed part separated from disputed part', blocker: 'Disputed part requires a decision', outcome: 'Evidence → party decision or procedure → final settlement.' } },
    documents: [
      { name: 'Acceptance act', type: 'Acceptance', party: 'Example lot', trip: 'Example trip', creator: 'Elevator / storage', signer: 'Authorised participant', timestamp: 'After the acceptance event', version: 'Current version', status: 'Requires confirmation', checksum: 'Not published in the example', basis: 'Confirms the actual accepted volume.' },
      { name: 'Quality protocol', type: 'Laboratory', party: 'Example lot', trip: 'Example trip', creator: 'Laboratory', signer: 'Authorised specialist', timestamp: 'After the quality check', version: 'Current version', status: 'Confirmed', checksum: 'Not published in the example', basis: 'Allows quality to be compared with terms.' },
      { name: 'Settlement basis', type: 'Settlement', party: 'Example lot', trip: 'Example trip', creator: 'Platform', signer: 'Not applicable', timestamp: 'After grounds are complete', version: 'Working version', status: 'Not ready', checksum: 'Not published in the example', basis: 'Shows which confirmations are required before a financial action.' },
    ],
    risks: {
      transportDelay: { label: 'Transport delay', event: 'The trip is outside the agreed arrival window.', blocked: 'Timely acceptance.', owner: 'Logistics', evidence: 'Route, checkpoints and deviation reason.', deadline: 'According to Deal terms', outcome: 'New window, agreed consequence or discrepancy.' },
      weightMismatch: { label: 'Weight mismatch', event: 'Actual weight differs from the agreed or declared weight.', blocked: 'Confirmation of full volume.', owner: 'Elevator / storage and surveyor', evidence: 'Scale data, act and independent record.', deadline: 'According to Deal terms', outcome: 'Volume correction or discrepancy.' },
      qualityDeviation: { label: 'Quality deviation', event: 'An indicator does not meet the terms.', blocked: 'Full settlement readiness.', owner: 'Laboratory', evidence: 'Sample, method and confirmed protocol.', deadline: 'According to Deal terms', outcome: 'Recalculation, recheck or discrepancy.' },
      missingDocument: { label: 'Missing document', event: 'A mandatory ground is absent.', blocked: 'Financial-action readiness.', owner: 'Document party and platform employee', evidence: 'Required confirmed document.', deadline: 'Before the settlement action', outcome: 'Request or delayed next step.' },
      documentVersion: { label: 'Changed document version', event: 'A new version appeared after confirmation.', blocked: 'Use of the previous basis.', owner: 'Document creator', evidence: 'Version and confirmation history.', deadline: 'According to Deal terms', outcome: 'New version accepted or disputed.' },
      paymentBasis: { label: 'Incomplete settlement basis', event: 'Events and documents do not form a complete set.', blocked: 'Financial action.', owner: 'Parties, platform employee and bank / finance', evidence: 'Missing execution confirmations.', deadline: 'Before the financial action', outcome: 'Wait, partial settlement or separate decision.' },
    },
    aiSignals: [
      { title: 'Terms mismatch', why: 'A document version does not match current Deal terms.', object: 'Example document', recommendation: 'Reconcile the version before confirmation.', confidence: 'Based on available facts' },
      { title: 'Deadline risk', why: 'A mandatory ground is still missing before the next control action.', object: 'Documents stage', recommendation: 'Show the owner and missing confirmation.', confidence: 'Requires user verification' },
      { title: 'Insufficient basis', why: 'The quality result is not linked to the current sample.', object: 'Quality protocol', recommendation: 'Check sample, lot and protocol linkage.', confidence: 'No positive conclusion without the linkage' },
    ],
    boundaries: { title: 'Boundary of the public example', text: 'This interface does not read real Deals, change roles, call an external system on the user’s behalf or perform money operations.', ai: 'Gekta explains available facts and action options. It does not sign documents, assign roles, decide a payout or resolve a dispute.' },
  },
};

const zh: PublicProductExperienceCopy = {
  header: { aria: '公共导航', brandHome: '透明价格—返回首页', signIn: '登录' },
  home: {
    hero: { kicker: '种植业农业交易流程', title: '一笔交易，从条件到结算。', lead: '参与方、交付、验收、质量、文件和结算依据共享同一条可核验历史。', primary: '查看交易如何运行', secondary: '注册' },
    preview: {
      eyebrow: '虚构交易示例', title: '葵花籽 · 履约示例', commodity: '葵花籽', volume: '1,200 吨', price: '按示例条件确定价格', route: '坦波夫州 — 沃罗涅日州', nowLabel: '当前步骤', nowValue: '验收与质量', requiredLabel: '需要操作', requiredValue: '确认实际履约', ownerLabel: '责任方', ownerValue: '买方 / 验收点', afterLabel: '确认后', afterValue: '文件与结算准备',
      lenses: { execution: { label: '履约', value: '第 5/7 步：验收与质量' }, documents: { label: '文件', value: '版本和完整性按交易事件核验' }, money: { label: '资金', value: '金融操作需要已确认依据' }, risk: { label: '风险', value: '偏差会开启单独处理分支' } }, open: '打开详细解析',
    },
    perspectives: { title: '从你的角色查看交易', lead: '公开角色选择只改变说明，不会授予任何权限。', all: '交易角色', primary: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator'], secondary: [] },
    proof: { title: '证据与履约保持关联', rows: ['每项确认都关联参与方和事件', '每个文件版本都关联交易', '金融操作需要依据', '决定保留在时间线中'] },
    final: { title: '开始使用平台', primary: '注册', secondary: '查看交易', signInPrefix: '已有访问权限？', signIn: '登录' },
  },
  explorer: {
    metaTitle: '农业交易详细解析—透明价格', metaDescription: '虚构种植业农业交易的公开解析：七个清晰步骤展开为十个运营阶段，不访问真实数据。', kicker: '交易详细解析', title: '七个步骤的运营细节', lead: '普通七步交易路径在这里展开为 10 个运营阶段，以单独显示准入、竞价、实验室核验和关闭。这仍是同一笔交易的更细粒度视图，不是第二条路径。', exampleBadge: '虚构示例', connect: '注册', backHome: '返回首页',
    deal: { idLabel: '示例', id: '虚构交易', commodityLabel: '商品', commodity: '葵花籽', classLabel: '类别', classValue: '种植业产品', volumeLabel: '数量', volume: '1,200 吨', priceLabel: '价格', price: '按示例条件确定', amountLabel: '结算', amount: '依据确认后进行', routeLabel: '路线', route: '坦波夫州 — 沃罗涅日州', stageLabel: '运营阶段', statusLabel: '状态', status: '需要操作', ownerLabel: '责任方', nextLabel: '下一步', blockerLabel: '阻塞原因', noBlocker: '当前无阻塞项' },
    controls: { lens: '检查内容', perspective: '角色', scenario: '场景', stage: '运营阶段', risk: '风险', previous: '上一步', next: '下一步', startGuide: '查看交易路径', pause: '暂停', continue: '继续', stop: '停止', aiToggle: '显示 Gekta', allParticipants: '交易角色', openDocument: '显示依据', closeDocument: '隐藏依据' },
    labels: { happened: '发生了什么', responsible: '谁负责', action: '需要做什么', evidence: '形成什么依据', transition: '下一步可用内容', visibleDocuments: '关联文件', responsibility: '责任', expectedOutcome: '预期结果', roleRisk: '角色风险', moneyContext: '对结算的影响', event: '事件', document: '文件', signature: '签名', version: '版本', allowedAction: '允许的操作', confidence: '结论依据', affectedObject: '受影响对象', recommendation: '下一步', whyImportant: '为何重要', blockedAction: '被阻止的操作', deadline: '控制期限', outcome: '可能结果', disputedAmount: '争议部分' },
    lenses: { execution: { label: '履约', summary: '事件、责任和允许的状态转换。' }, participants: { label: '参与方', summary: '同一笔交易中的不同任务和权限。' }, documents: { label: '文件', summary: '文件作为事件和结算的可核验依据。' }, money: { label: '结算', summary: '哪些确认允许进入金融操作。' }, risk: { label: '风险与偏差', summary: '阻塞、证据、双方立场和后果。' }, intelligence: { label: 'Gekta', summary: '解释事实和风险，但不拥有独立决策权限。' } },
    stages: {
      terms: { label: '商品与条件', happened: '双方确定商品、数量、价格、质量和履约规则。', owner: '买方与卖方', action: '核对已确认的条件版本。', evidence: '带作者和时间的条件版本。', next: '进入准入检查。' },
      admission: { label: '准入', happened: '核验机构、权限和必填信息。', owner: '平台员工', action: '处理发现的不一致。', evidence: '准入决定和检查日志。', next: '允许参与竞价。' },
      auction: { label: '竞价', happened: '报价和竞价按交易规则记录。', owner: '平台员工', action: '记录交易方选择结果。', evidence: '报价历史和竞价结果。', next: '生成交易依据。' },
      deal: { label: '交易与合同', happened: '已确认条件成为具体交易的义务。', owner: '买方与卖方', action: '确认双方义务。', evidence: '交易记录和合同条件版本。', next: '进入实际履约。' },
      logistics: { label: '物流与交付', happened: '已指定承运方、司机、车辆、路线和运输任务。', owner: '物流', action: '确认运输准备和事件。', evidence: '运输任务、路线和运输事件。', next: '到达后开放验收。' },
      acceptance: { label: '验收', happened: '批次到达验收点，记录重量和状态。', owner: '筒仓 / 仓储', action: '确认实际验收。', evidence: '验收记录、重量、时间和关联运输任务。', next: '进入质量核验。' },
      laboratory: { label: '质量', happened: '实验室结果与交易条件进行比对。', owner: '实验室', action: '确认样品、方法和结果。', evidence: '样品、方法和质量报告。', next: '检查文件完整性。' },
      documents: { label: '文件', happened: '汇总交付、验收和质量相关版本与确认。', owner: '双方与平台员工', action: '补齐缺失依据。', evidence: '已确认文件版本及其与事件的关联。', next: '检查结算准备状态。' },
      settlement: { label: '结算', happened: '将已确认事件和文件与结算条件进行匹配。', owner: '银行 / 金融', action: '核验金融操作依据。', evidence: '结算版本和已确认依据。', next: '金融结果确认后进入关闭。' },
      closure: { label: '关闭', happened: '义务、文件和金融结果汇总完成。', owner: '平台员工', action: '记录义务完成。', evidence: '最终时间线和证据包。', next: '历史保留用于核验和分析。' },
    },
    perspectives: {
      seller: { label: '卖方', value: '查看商品、交付、文件和结算准备状态。', action: '确认卖方义务履行。', documents: '条件、交付文件、验收和质量。', responsibility: '交付约定数量和质量。', outcome: '履约已确认，结算状态清晰。', risk: '交付证据不足。', money: '结算取决于验收数量和已确认依据。' },
      buyer: { label: '买方', value: '控制条件、验收、质量和付款依据。', action: '确认交付符合条件。', documents: '条件、验收、质量报告和结算版本。', responsibility: '接收合格交付并确认依据。', outcome: '获得质量可核验的商品。', risk: '对未确认履约进行金融操作。', money: '结算与实际履约保持关联。' },
      logistics: { label: '物流', value: '管理承运方、运输任务、路线和偏差。', action: '确保并确认交付。', documents: '运输申请、路线和运输事件。', responsibility: '在约定窗口内送达。', outcome: '运输完成并关联验收。', risk: '延误或事件链断裂。', money: '运费依据与商品结算分开确认。' },
      driver: { label: '司机', value: '接收运输任务、检查点和最近操作。', action: '确认到达和货物交接。', documents: '运输任务、路线和允许查看的运输文件。', responsibility: '提交已确认运输事件。', outcome: '交付已确认且不访问无关数据。', risk: '检查点未确认。', money: '运输完成事实与商品商业条件分开确认。' },
      elevator: { label: '筒仓 / 仓储', value: '记录到达、重量、验收、存放和批次状态。', action: '确认实际验收。', documents: '运输任务、称重数据、验收记录和批次状态。', responsibility: '形成可靠的验收依据。', outcome: '数量确认后进入质量控制。', risk: '重量不符或批次错误。', money: '实际验收数量影响结算。' },
      lab: { label: '实验室', value: '将样品、方法和结果关联到具体批次。', action: '确认质量报告。', documents: '样品、方法、报告和结果版本。', responsibility: '记录可复核结果。', outcome: '质量与条件完成比对。', risk: '结果关联错误样品或批次。', money: '质量可以影响结算，但不会自行触发资金操作。' },
      surveyor: { label: '检验机构', value: '为争议事实形成独立证据。', action: '记录独立核验。', documents: '记录、照片、测量和关联对象。', responsibility: '保存中立证据链。', outcome: '双方获得独立依据。', risk: '记录不完整或不可复核。', money: '结论可影响重算或争议，但不替代双方权限。' },
      bank: { label: '银行 / 金融', value: '查看结算依据和金融阻塞项。', action: '核验已确认依据。', documents: '结算条件、验收、质量和文件。', responsibility: '仅基于允许依据执行金融操作。', outcome: '金融结果可核验。', risk: '依据不完整或冲突。', money: '金融系统确认实际资金流动。' },
      operator: { label: '平台员工', value: '控制阻塞项、责任方、期限和时间线。', action: '确定停止原因和允许的下一步。', documents: '事件、状态、文件版本和决定。', responsibility: '保持参与方之间流程完整。', outcome: '交易连续推进且不丢失上下文。', risk: '参与方状态不一致。', money: '看到资金影响，但不会自动获得银行或交易方权限。' },
      compliance: { label: '平台员工', value: '内部准入与权限检查职能。', action: '核验准入依据。', documents: '机构资料、权限和日志。', responsibility: '阻止不允许的状态转换。', outcome: '准入依赖可核验依据。', risk: '遗漏限制。', money: '不会产生独立金融权限。' },
      arbitrator: { label: '平台员工', value: '内部偏差支持职能。', action: '在同一时间线中汇总立场和证据。', documents: '立场、版本、报告、记录和事件。', responsibility: '遵守程序和权限边界。', outcome: '偏差具有可核验证据基础。', risk: '依据不足时作出决定。', money: '不会在允许程序之外决定资金流动。' },
      executive: { label: '平台员工', value: '内部重复运营风险控制职能。', action: '消除系统性偏差原因。', documents: '聚合事件及原始依据。', responsibility: '不替代参与方的前提下管理流程质量。', outcome: '重复阻塞项减少。', risk: '结论缺少原始确认。', money: '分析不会替代已确认金融结果。' },
    },
    scenarios: { standard: { label: '普通', summary: '交付已确认、质量符合、文件正在核验。', amount: '依据确认后进入结算', blocker: '无重大阻塞项', outcome: '文件核验和金融结果确认后正常关闭。' }, partial: { label: '部分验收', summary: '仅验收约定数量的一部分。', amount: '仅对已确认数量结算', blocker: '剩余数量尚未确认', outcome: '已确认部分与剩余数量分别跟踪。' }, dispute: { label: '偏差 / 争议', summary: '发现数量或质量差异。', amount: '无争议部分与争议部分分离', blocker: '争议部分需要决定', outcome: '证据 → 双方决定或程序 → 最终结算。' } },
    documents: [
      { name: '验收记录', type: '验收', party: '示例批次', trip: '示例运输任务', creator: '筒仓 / 仓储', signer: '获授权参与方', timestamp: '验收事件后', version: '当前版本', status: '需要确认', checksum: '示例中不公开', basis: '确认实际验收数量。' },
      { name: '质量报告', type: '实验室', party: '示例批次', trip: '示例运输任务', creator: '实验室', signer: '获授权专业人员', timestamp: '质量核验后', version: '当前版本', status: '已确认', checksum: '示例中不公开', basis: '用于把质量与条件进行比对。' },
      { name: '结算依据', type: '结算', party: '示例批次', trip: '示例运输任务', creator: '平台', signer: '不适用', timestamp: '依据完整后', version: '工作版本', status: '未就绪', checksum: '示例中不公开', basis: '显示金融操作前还需要哪些确认。' },
    ],
    risks: {
      transportDelay: { label: '运输延误', event: '运输任务超出约定到达窗口。', blocked: '按时验收。', owner: '物流', evidence: '路线、检查点和偏差原因。', deadline: '按交易条件', outcome: '新窗口、约定后果或偏差处理。' },
      weightMismatch: { label: '重量不符', event: '实际重量与约定或申报重量不同。', blocked: '确认全部数量。', owner: '筒仓 / 仓储与检验机构', evidence: '称重数据、记录和独立证据。', deadline: '按交易条件', outcome: '修正数量或偏差处理。' },
      qualityDeviation: { label: '质量偏差', event: '某项指标不符合条件。', blocked: '完整结算准备。', owner: '实验室', evidence: '样品、方法和已确认报告。', deadline: '按交易条件', outcome: '重算、复检或偏差处理。' },
      missingDocument: { label: '文件缺失', event: '缺少必需依据。', blocked: '金融操作准备。', owner: '文件责任方与平台员工', evidence: '所需已确认文件。', deadline: '金融操作前', outcome: '补充请求或延后下一步。' },
      documentVersion: { label: '文件版本变化', event: '确认后出现新版本。', blocked: '继续使用旧依据。', owner: '文件创建方', evidence: '版本与确认历史。', deadline: '按交易条件', outcome: '接受新版本或偏差处理。' },
      paymentBasis: { label: '结算依据不完整', event: '事件和文件尚未形成完整集合。', blocked: '金融操作。', owner: '双方、平台员工与银行 / 金融', evidence: '缺失的履约确认。', deadline: '金融操作前', outcome: '等待、部分结算或单独决定。' },
    },
    aiSignals: [
      { title: '条件不一致', why: '文件版本与当前交易条件不一致。', object: '示例文件', recommendation: '确认前核对版本。', confidence: '基于可用事实' },
      { title: '期限风险', why: '下一控制动作前仍缺少必需依据。', object: '“文件”阶段', recommendation: '显示责任方和缺失确认。', confidence: '需要用户核验' },
      { title: '依据不足', why: '质量结果未关联当前样品。', object: '质量报告', recommendation: '检查样品、批次和报告关联。', confidence: '缺少关联时不形成正面结论' },
    ],
    boundaries: { title: '公共示例边界', text: '该界面不读取真实交易、不改变角色、不代表用户调用外部系统，也不执行资金操作。', ai: 'Gekta 解释可用事实和操作选项。它不会签署文件、分配角色、决定付款或裁决争议。' },
  },
};

export const PUBLIC_PRODUCT_EXPERIENCE_COPY: Record<AppLocale, PublicProductExperienceCopy> = { ru, en, zh };

export function getPublicProductExperienceCopy(locale: string): PublicProductExperienceCopy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return PUBLIC_PRODUCT_EXPERIENCE_COPY[resolved];
}
