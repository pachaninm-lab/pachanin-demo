'use client';

import Link from 'next/link';
import { MoneyTreeStrip } from '@/components/platform-v7/MoneyTreeStrip';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { PLATFORM_V7_TOKENS, getPlatformV7ToneTokens, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export type PlatformV7ExecutionRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'operator'
  | 'executive'
  | 'investor';

type RoleExecutionIntent = {
  label: string;
  href: string;
  result: string;
  tone?: PlatformV7Tone;
};

type RoleExecutionSummaryConfig = {
  title: string;
  tone: PlatformV7Tone;
  mode: 'commercial' | 'field' | 'audit' | 'money' | 'operations' | 'partner';
  now: string;
  blocked: string;
  money: string;
  documents: string;
  execution: string;
  next: string;
  cta: string;
  href: string;
  hidden: string;
  intents: RoleExecutionIntent[];
  attention: string[];
  recent: RoleExecutionIntent[];
};

const MONEY_TREE_ROLES: ReadonlySet<PlatformV7ExecutionRole> = new Set(['seller', 'buyer', 'bank', 'operator']);

export const PLATFORM_V7_ROLE_EXECUTION_SUMMARIES: Record<PlatformV7ExecutionRole, RoleExecutionSummaryConfig> = {
  seller: {
    title: 'Продавец', tone: 'success', mode: 'commercial',
    now: 'лот LOT-2403: победитель выбран, сделка DL-9106 создана, банковская проверка основания ещё закрыта',
    blocked: 'деньги останавливают СДИЗ, транспортный пакет, приёмка, качество и спор',
    money: 'продавец видит резерв и сумму к банковскому шагу, но не видит кредитную линию покупателя',
    documents: 'СДИЗ, ЭТрН, УПД, акт, КЭП и качество показываются как условия банковского основания',
    execution: 'лот → ставка → сделка → логистика → рейс → приёмка → документы → банк',
    next: 'продавец закрывает документы, оператор ведёт причину остановки, логистика ведёт рейс',
    cta: 'Открыть предложения', href: '/platform-v7/seller/offers',
    hidden: 'скрыто: кредит покупателя, чужие закрытые ставки, банковая внутренняя логика',
    intents: [
      { label: 'Создать партию', href: '/platform-v7/seller/lots', result: 'открыть зерно, качество, объём и условия допуска', tone: 'success' },
      { label: 'Ответить покупателю', href: '/platform-v7/seller/offers', result: 'перейти к предложениям и условиям сделки', tone: 'money' },
      { label: 'Подготовить документы', href: '/platform-v7/documents', result: 'закрыть СДИЗ, договор, акт и подписи', tone: 'document' },
      { label: 'Отгрузить зерно', href: '/platform-v7/seller/batches', result: 'открыть отгрузки, рейсы и готовность к приёмке', tone: 'logistics' },
      { label: 'Проверить оплату', href: '/platform-v7/money', result: 'увидеть резерв, удержание и сумму к проверке', tone: 'money' },
      { label: 'Сообщить о проблеме', href: '/platform-v7/disputes', result: 'открыть расхождение с доказательствами', tone: 'dispute' },
    ],
    attention: ['СДИЗ и транспортный пакет влияют на банковское основание', 'Качество и приёмка могут изменить сумму', 'Чужие ставки и кредит покупателя не раскрываются'],
    recent: [
      { label: 'Сделка DL-9106', href: '/platform-v7/deals/DL-9106', result: 'продолжить закрытие документов', tone: 'document' },
      { label: 'Партия LOT-2403', href: '/platform-v7/seller/lots', result: 'проверить условия партии', tone: 'success' },
    ],
  },
  buyer: {
    title: 'Покупатель', tone: 'money', mode: 'commercial',
    now: 'лот LOT-2403: собственная ставка принята, DL-9106 ждёт подтверждения резерва',
    blocked: 'резерв, СДИЗ, ЭТрН, приёмка и качество могут остановить банковское основание продавца',
    money: 'покупатель видит свой резерв и кредитный сценарий, продавец видит только готовность денег',
    documents: 'видны документы сделки, влияющие на приёмку и закрытие расчёта',
    execution: 'ставка → резерв → логистика → приёмка → банковский шаг / удержание',
    next: 'покупатель подтверждает резерв или закрывает условие банка',
    cta: 'Открыть покупку', href: '/platform-v7/buyer',
    hidden: 'скрыто: чужие закрытые ставки и лишние данные продавца вне допуска',
    intents: [
      { label: 'Создать запрос', href: '/platform-v7/buyer/rfq', result: 'задать культуру, объём, качество и базис', tone: 'money' },
      { label: 'Сравнить предложения', href: '/platform-v7/proposals', result: 'выбрать поставщика по цене, сроку и рискам', tone: 'success' },
      { label: 'Продолжить сделку', href: '/platform-v7/deals', result: 'открыть активные сделки и следующий шаг', tone: 'info' },
      { label: 'Проверить оплату', href: '/platform-v7/money', result: 'увидеть резерв, кредитный сценарий и удержания', tone: 'money' },
      { label: 'Принять поставку', href: '/platform-v7/elevator', result: 'перейти к весу, качеству и акту приёмки', tone: 'warning' },
      { label: 'Открыть документы', href: '/platform-v7/documents', result: 'проверить договор, СДИЗ, акты и подписи', tone: 'document' },
    ],
    attention: ['Резерв денег ещё не подтверждён', 'Документы продавца влияют на расчёт', 'Приёмка и качество определяют финальное основание'],
    recent: [
      { label: 'Сделка DL-9106', href: '/platform-v7/deals/DL-9106', result: 'проверить резерв и приёмку', tone: 'money' },
      { label: 'Офферы по LOT-2403', href: '/platform-v7/proposals', result: 'сравнить условия поставщиков', tone: 'success' },
    ],
  },
  logistics: {
    title: 'Логистика', tone: 'logistics', mode: 'field',
    now: 'после выбора победителя заявка 2403 пришла в диспетчерскую',
    blocked: 'срок прибытия, водитель, пломба, ЭТрН, ГИС ЭПД или инцидент рейса требуют реакции',
    money: 'цена зерна, ставки, резерв, банк и кредит не раскрываются логистике',
    documents: 'видны только документы рейса: ЭТрН, транспортный пакет, статус ГИС ЭПД',
    execution: 'заявка → машина → водитель → маршрут → прибытие → приёмка',
    next: 'логист контролирует прибытие, подписи и инциденты рейса',
    cta: 'Открыть рейс', href: '/platform-v7/logistics',
    hidden: 'скрыто: цена зерна, банковский резерв, кредит и закрытые ставки',
    intents: [
      { label: 'Назначить машину', href: '/platform-v7/logistics?task=assign-vehicle', result: 'выбрать транспорт и окно подачи', tone: 'logistics' },
      { label: 'Назначить водителя', href: '/platform-v7/logistics?task=assign-driver', result: 'привязать водителя к рейсу', tone: 'logistics' },
      { label: 'Проверить маршрут', href: '/platform-v7/logistics?task=route', result: 'увидеть путь, прибытие и отклонения', tone: 'info' },
      { label: 'Оформить ЭТрН', href: '/platform-v7/documents?scope=transport', result: 'собрать транспортный пакет', tone: 'document' },
      { label: 'Разобрать инцидент', href: '/platform-v7/logistics?task=incident', result: 'зафиксировать задержку, пломбу или проблему', tone: 'dispute' },
      { label: 'Передать на приёмку', href: '/platform-v7/logistics?task=handoff', result: 'закрыть рейс до окна элеватора', tone: 'warning' },
    ],
    attention: ['Рейс без водителя не должен уходить в работу', 'ЭТрН и ГИС ЭПД влияют на документный пакет', 'Денежные условия не показываются диспетчеру'],
    recent: [
      { label: 'Рейс TRIP-001', href: '/platform-v7/logistics?trip=TRIP-001', result: 'проверить прибытие и документы', tone: 'logistics' },
      { label: 'Транспортный пакет', href: '/platform-v7/documents?scope=transport', result: 'закрыть ЭТрН и подписи', tone: 'document' },
    ],
  },
  driver: {
    title: 'Водитель', tone: 'logistics', mode: 'field',
    now: 'TRIP-001: один активный рейс, маршрут и одно следующее действие',
    blocked: 'нет связи, не отправлены фото, пломба, прибытие, вес или проблема',
    money: 'коммерческие условия, ставки, покупатель и кредит скрыты от водителя',
    documents: 'видны только документы своего рейса и транспортные подтверждения',
    execution: 'маршрут, GPS, фото, пломба, проблема и офлайн-очередь связаны с рейсом',
    next: 'водитель подтверждает ближайшее полевое действие',
    cta: 'Открыть рейс водителя', href: '/platform-v7/driver/field',
    hidden: 'не показывается: деньги, ставки, банк, покупатель, кредит, чужие рейсы',
    intents: [
      { label: 'Открыть маршрут', href: '/platform-v7/driver/field', result: 'увидеть текущий рейс и ближайшую точку', tone: 'logistics' },
      { label: 'Подтвердить прибытие', href: '/platform-v7/driver/field?task=arrival', result: 'зафиксировать точку и время события', tone: 'success' },
      { label: 'Добавить фото', href: '/platform-v7/driver/field?task=photo', result: 'прикрепить фото пломбы, груза или документа', tone: 'evidence' },
      { label: 'Сообщить проблему', href: '/platform-v7/driver/field?task=problem', result: 'передать задержку, поломку или расхождение', tone: 'dispute' },
    ],
    attention: ['На экране только свой рейс и ближайшее действие', 'Фото и прибытие сохраняются как событие рейса', 'Деньги, ставки и чужие рейсы скрыты'],
    recent: [
      { label: 'TRIP-001', href: '/platform-v7/driver/field', result: 'продолжить текущий рейс', tone: 'logistics' },
    ],
  },
  elevator: {
    title: 'Элеватор', tone: 'warning', mode: 'field',
    now: 'TRIP-001 прибыл: фиксируются вес, качество, акт и отклонения',
    blocked: 'расхождение веса, качества, пломбы или акта создаёт удержание и спор',
    money: 'деньги, ставки, банк, резерв и кредит не управляются на экране приёмки',
    documents: 'акт приёмки, акт расхождения и протокол качества влияют на банковское основание',
    execution: 'рейс → вес → качество → акт → документы → основание для банка / удержания',
    next: 'элеватор фиксирует факт, лаборатория закрывает качество, оператор ведёт причину остановки',
    cta: 'Зафиксировать вес', href: '/platform-v7/elevator',
    hidden: 'скрыто: ставки, цена, банк, резерв, кредит, чужая коммерческая аналитика',
    intents: [
      { label: 'Начать приёмку', href: '/platform-v7/elevator?task=start', result: 'открыть рейс, машину и партию', tone: 'warning' },
      { label: 'Зафиксировать вес', href: '/platform-v7/elevator?task=weight', result: 'внести вес и расхождение', tone: 'success' },
      { label: 'Передать пробу', href: '/platform-v7/elevator?task=sample', result: 'отправить качество в лабораторию', tone: 'document' },
      { label: 'Создать расхождение', href: '/platform-v7/elevator?task=variance', result: 'зафиксировать спорный факт с основанием', tone: 'dispute' },
      { label: 'Открыть акт', href: '/platform-v7/elevator?task=act', result: 'подготовить акт приёмки', tone: 'document' },
    ],
    attention: ['Вес и качество влияют на основание расчёта', 'Пломба и акт фиксируются до закрытия приёмки', 'Коммерческие условия не редактируются на элеваторе'],
    recent: [
      { label: 'TRIP-001', href: '/platform-v7/elevator?trip=TRIP-001', result: 'продолжить приёмку', tone: 'warning' },
      { label: 'Акт приёмки', href: '/platform-v7/elevator?task=act', result: 'проверить акт и расхождения', tone: 'document' },
    ],
  },
  lab: {
    title: 'Лаборатория', tone: 'document', mode: 'audit',
    now: 'пробы ждут результата, протокола или повторной проверки',
    blocked: 'отклонение качества может остановить документы и банковское основание',
    money: 'лаборатория не двигает деньги и не снимает удержание',
    documents: 'протокол качества привязан к сделке и спору',
    execution: 'качество влияет на приёмку и основание для решения',
    next: 'лаборатория, арбитр или оператор',
    cta: 'Загрузить протокол', href: '/platform-v7/lab',
    hidden: 'скрыто: коммерческие ставки, кредит и банковские действия',
    intents: [
      { label: 'Внести результат', href: '/platform-v7/lab?task=result', result: 'заполнить показатели качества', tone: 'document' },
      { label: 'Загрузить протокол', href: '/platform-v7/lab?task=protocol', result: 'прикрепить файл и версию протокола', tone: 'success' },
      { label: 'Назначить повтор', href: '/platform-v7/lab?task=repeat', result: 'открыть повторный анализ', tone: 'warning' },
      { label: 'Передать в спор', href: '/platform-v7/lab?task=dispute', result: 'связать протокол с расхождением', tone: 'dispute' },
    ],
    attention: ['Протокол качества влияет на приёмку и документы', 'Повторный анализ должен иметь основание', 'Лаборатория не управляет оплатой'],
    recent: [
      { label: 'Проба по DL-9106', href: '/platform-v7/lab?deal=DL-9106', result: 'продолжить анализ', tone: 'document' },
    ],
  },
  surveyor: {
    title: 'Сюрвейер', tone: 'evidence', mode: 'field',
    now: 'назначены проверки, фото и акт осмотра',
    blocked: 'неполный акт или фото не дают закрыть доказательства',
    money: 'денежные действия скрыты от сюрвейера',
    documents: 'акт, фото и подписи входят в доказательный пакет',
    execution: 'осмотр связан с рейсом, партией и спором',
    next: 'сюрвейер или оператор',
    cta: 'Открыть назначение', href: '/platform-v7/surveyor',
    hidden: 'скрыто: банковские действия и коммерческие ставки',
    intents: [
      { label: 'Открыть назначение', href: '/platform-v7/surveyor', result: 'увидеть объект осмотра и задачу', tone: 'evidence' },
      { label: 'Добавить фото', href: '/platform-v7/surveyor?task=photo', result: 'прикрепить фото к факту осмотра', tone: 'evidence' },
      { label: 'Сформировать акт', href: '/platform-v7/surveyor?task=act', result: 'оформить результат проверки', tone: 'document' },
      { label: 'Передать результат', href: '/platform-v7/surveyor?task=handoff', result: 'закрыть осмотр для оператора или арбитра', tone: 'success' },
    ],
    attention: ['Фото и акт должны быть связаны с рейсом или спором', 'Банковские действия не доступны сюрвейеру', 'Результат осмотра нельзя закрывать без факта'],
    recent: [
      { label: 'Осмотр TRIP-001', href: '/platform-v7/surveyor?trip=TRIP-001', result: 'продолжить проверку', tone: 'evidence' },
    ],
  },
  bank: {
    title: 'Банк', tone: 'bank', mode: 'money',
    now: 'сделки ждут резерв, удержание, проверку или банковское подтверждение',
    blocked: 'банковскую проверку основания останавливают документы, спор или ручная проверка',
    money: 'резерв, сумма к банковскому шагу и удержание показаны как части одного контура',
    documents: 'основания банковского шага видны через пакет сделки',
    execution: 'подтверждение выпуска денег требует закрытого пакета оснований',
    next: 'банк или оператор',
    cta: 'Открыть проверку основания', href: '/platform-v7/bank',
    hidden: 'скрыто: ложное денежное действие без закрытых условий',
    intents: [
      { label: 'Проверить основание', href: '/platform-v7/bank', result: 'открыть документы, спор и готовность', tone: 'bank' },
      { label: 'Открыть выплаты', href: '/platform-v7/bank/payment-basis', result: 'проверить сумму к банковскому шагу', tone: 'money' },
      { label: 'Проверить удержание', href: '/platform-v7/bank/events', result: 'увидеть причину удержания и событие', tone: 'warning' },
      { label: 'Сверить события', href: '/platform-v7/bank/events', result: 'сравнить статусы сделки и банка', tone: 'info' },
      { label: 'Открыть факторинг', href: '/platform-v7/bank/factoring', result: 'проверить кредитный сценарий без раскрытия лишних данных', tone: 'money' },
    ],
    attention: ['Выпуск возможен только при закрытом основании', 'Спор и документы могут удерживать сумму', 'Платформа не подменяет решение банка'],
    recent: [
      { label: 'Основание DL-9106', href: '/platform-v7/bank?deal=DL-9106', result: 'проверить документы и деньги', tone: 'bank' },
      { label: 'Журнал событий', href: '/platform-v7/bank/events', result: 'проверить расхождение статусов', tone: 'info' },
    ],
  },
  arbitrator: {
    title: 'Арбитр', tone: 'dispute', mode: 'audit',
    now: 'открытые споры ждут доказательства или решение',
    blocked: 'спор нельзя закрыть без основания и журнала действий',
    money: 'сумма под риском связана с удержанием',
    documents: 'фото, GPS, вес, пломба, лаборатория и документы собраны в пакет',
    execution: 'решение влияет на удержание или банковскую проверку основания',
    next: 'арбитр или сторона сделки',
    cta: 'Запросить доказательство', href: '/platform-v7/arbitrator',
    hidden: 'скрыто: устное решение без доказательного пакета и журнала',
    intents: [
      { label: 'Открыть спор', href: '/platform-v7/arbitrator', result: 'увидеть основание, стороны и сумму', tone: 'dispute' },
      { label: 'Запросить доказательство', href: '/platform-v7/disputes', result: 'попросить фото, акт, вес или протокол', tone: 'evidence' },
      { label: 'Принять решение', href: '/platform-v7/arbitrator?task=decision', result: 'оформить решение с основанием', tone: 'success' },
      { label: 'Вернуть на доработку', href: '/platform-v7/arbitrator?task=return', result: 'указать недостающий факт', tone: 'warning' },
    ],
    attention: ['Решение без доказательств не закрывает спор', 'Сумма под риском связана с удержанием', 'Все действия должны попадать в журнал'],
    recent: [
      { label: 'Спор по DL-9106', href: '/platform-v7/arbitrator?deal=DL-9106', result: 'проверить доказательства', tone: 'dispute' },
    ],
  },
  compliance: {
    title: 'Комплаенс', tone: 'document', mode: 'audit',
    now: 'стороны проходят допуск, полномочия и документную проверку',
    blocked: 'остановку допуска без причины нельзя закрыть вручную',
    money: 'комплаенс-проверка может блокировать банковскую проверку основания',
    documents: 'учредительные документы, полномочия и реквизиты проверяются отдельно',
    execution: 'допуск связан с конкретными сделками',
    next: 'комплаенс или оператор',
    cta: 'Запросить документы', href: '/platform-v7/compliance',
    hidden: 'скрыто: ручной обход допуска без основания',
    intents: [
      { label: 'Проверить допуск', href: '/platform-v7/compliance', result: 'открыть статус стороны и причины остановки', tone: 'document' },
      { label: 'Запросить документы', href: '/platform-v7/compliance?task=request-docs', result: 'собрать недостающий пакет', tone: 'warning' },
      { label: 'Проверить полномочия', href: '/platform-v7/compliance?task=authority', result: 'сверить подписанта и реквизиты', tone: 'success' },
      { label: 'Проверить подключения', href: '/platform-v7/connectors', result: 'увидеть состояние внешних контуров без завышения', tone: 'integration' },
    ],
    attention: ['Допуск связан с конкретными сделками', 'Ручной обход допуска запрещён', 'Внешние подключения показываются только по подтверждённому статусу'],
    recent: [
      { label: 'Проверка стороны', href: '/platform-v7/compliance?party=current', result: 'продолжить допуск', tone: 'document' },
    ],
  },
  operator: {
    title: 'Оператор', tone: 'dispute', mode: 'operations',
    now: 'очередь показывает сделки, которые требуют действия сейчас',
    blocked: 'причина остановки, деньги, документы и срок реакции вынесены наверх',
    money: 'к банковскому шагу, под удержанием и под риском сверяются по сделкам',
    documents: 'видно, кто должен загрузить или подписать пакет',
    execution: 'транспорт, приёмка, спор и банк собраны в один контур',
    next: 'ответственная роль по каждой строке очереди',
    cta: 'Открыть очередь действий', href: '/platform-v7/control-tower',
    hidden: 'скрыто: тихое ручное редактирование без следа',
    intents: [
      { label: 'Открыть очередь действий', href: '/platform-v7/control-tower', result: 'увидеть сделки по риску и деньгам', tone: 'dispute' },
      { label: 'Проверить сделки', href: '/platform-v7/deals', result: 'открыть активные сделки и статусы', tone: 'info' },
      { label: 'Разобрать остановку', href: '/platform-v7/operator', result: 'найти причину и владельца шага', tone: 'warning' },
      { label: 'Проверить расчёты', href: '/platform-v7/bank/clean', result: 'увидеть суммы к проверке и удержания', tone: 'money' },
      { label: 'Открыть контроль допуска', href: '/platform-v7/compliance', result: 'проверить стороны, документы и полномочия', tone: 'document' },
    ],
    attention: ['Сортировка должна идти по деньгам, сроку и риску', 'Ручное действие без журнала недопустимо', 'Каждая остановка должна иметь владельца'],
    recent: [
      { label: 'Очередь высокого риска', href: '/platform-v7/control-tower', result: 'продолжить разбор сделок', tone: 'dispute' },
      { label: 'Расчёты к проверке', href: '/platform-v7/bank/clean', result: 'проверить денежный контур', tone: 'money' },
    ],
  },
  executive: {
    title: 'Руководитель', tone: 'info', mode: 'partner',
    now: 'видна сводка по обороту, рискам, срокам реакции и зрелости контура',
    blocked: 'ручные действия и внешние подключения не скрываются',
    money: 'экономика и деньги под риском показаны отдельно',
    documents: 'документные остановки входят в общий риск',
    execution: 'операционная зрелость читается по всей цепочке сделки',
    next: 'оператор или владелец контура',
    cta: 'Открыть сводку', href: '/platform-v7/executive',
    hidden: 'скрыто: неподтверждённые заявления о зрелости',
    intents: [
      { label: 'Открыть сводку', href: '/platform-v7/executive', result: 'увидеть деньги, риски и работу контура', tone: 'info' },
      { label: 'Проверить деньги', href: '/platform-v7/money', result: 'увидеть резерв, удержания и сумму под риском', tone: 'money' },
      { label: 'Проверить сделки', href: '/platform-v7/deals', result: 'открыть активные сделки и причины остановки', tone: 'warning' },
      { label: 'Открыть отчёты', href: '/platform-v7/reports', result: 'смотреть показатели без лишних экранов', tone: 'document' },
      { label: 'Проверить расчёты', href: '/platform-v7/bank/clean', result: 'увидеть денежные основания и сверку', tone: 'bank' },
    ],
    attention: ['Нужно видеть деньги, риск и ручной слой отдельно', 'Неподтверждённые подключения не называются готовыми', 'Решения ведут к сделкам, расчётам и отчётам'],
    recent: [
      { label: 'Сводка рисков', href: '/platform-v7/executive', result: 'проверить управленческую картину', tone: 'info' },
      { label: 'Расчёты', href: '/platform-v7/bank/clean', result: 'проверить денежный контур', tone: 'bank' },
    ],
  },
  investor: {
    title: 'Инвестор', tone: 'info', mode: 'partner',
    now: 'показаны зрелость, оборот, риски и экономика контура исполнения',
    blocked: 'внешние подключения и ручные действия показаны честно',
    money: 'оборот, экономика сделки и спорные суммы отделены от обещаний',
    documents: 'готовность документов влияет на зрелость исполнения',
    execution: 'маршрут сделки и внешние подключения не смешиваются',
    next: 'команда продукта',
    cta: 'Открыть инвесторский режим', href: '/platform-v7/investor',
    hidden: 'скрыто: неподтверждённые заявления о боевой готовности и активных интеграциях',
    intents: [
      { label: 'Открыть инвесторский режим', href: '/platform-v7/investor', result: 'увидеть зрелость, экономику и риски', tone: 'info' },
      { label: 'Проверить экономику', href: '/platform-v7/reports', result: 'открыть отчёты и денежные показатели', tone: 'money' },
      { label: 'Проверить доверие', href: '/platform-v7/trust', result: 'увидеть статус внешних контуров и ограничений', tone: 'document' },
      { label: 'Открыть сделки', href: '/platform-v7/deals', result: 'проверить путь сделки и события', tone: 'warning' },
    ],
    attention: ['Архитектурная сила отделена от подтверждённой зрелости', 'Экономика и спорные суммы не смешиваются с обещаниями', 'Внешние подключения показываются честно'],
    recent: [
      { label: 'Инвесторская сводка', href: '/platform-v7/investor', result: 'продолжить проверку проекта', tone: 'info' },
    ],
  },
};

export function RoleExecutionSummary({ role }: { role: PlatformV7ExecutionRole }) {
  const summary = PLATFORM_V7_ROLE_EXECUTION_SUMMARIES[role];
  const tone = getPlatformV7ToneTokens(summary.tone);
  const primaryIntent = summary.intents[0];
  const secondaryIntents = summary.intents.slice(1);
  const rows = role === 'driver'
    ? [['Сейчас', summary.now], ['Остановило рейс', summary.blocked], ['Скрыто от роли', summary.money], ['Документы рейса', summary.documents], ['Исполнение', summary.execution], ['Следующий шаг', summary.next]]
    : [['Сейчас', summary.now], ['Остановило сделку', summary.blocked], ['Деньги', summary.money], ['Документы', summary.documents], ['Груз и исполнение', summary.execution], ['Следующий владелец', summary.next]];

  return (
    <section data-testid={`role-execution-summary-${role}`} aria-label={`Рабочее место роли: ${summary.title}`} style={shellStyle}>
      <div style={heroStyle}>
        <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
            <P7Badge tone={summary.tone}>{summary.title}</P7Badge>
            <P7Badge tone="neutral">{modeLabel(summary.mode)}</P7Badge>
            <P7Badge tone="neutral">рабочий контур</P7Badge>
          </div>
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
            <h1 style={headlineStyle}>{summary.title}: выберите рабочую цель</h1>
            <p style={leadStyle}>На экране оставлены только понятные входы в работу. Выберите действие — система откроет нужную сделку, документ, расчёт, рейс или спор.</p>
          </div>
          <div style={pathStyle} aria-label="Логика работы">
            {['цель', 'рабочий экран', 'действие', 'журнал'].map((item, index) => (
              <span key={item} style={pathItemStyle}><b>{index + 1}</b>{item}</span>
            ))}
          </div>
        </div>

        <div data-testid={`role-primary-task-${role}`} style={{ ...primaryTaskStyle, borderColor: tone.border }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={sectionEyebrowStyle}>Главный рабочий ход</span>
            <Link href={primaryIntent.href} data-testid={`role-execution-primary-action-${role}`} style={{ ...bigActionStyle, background: tone.fg }}>
              {primaryIntent.label}
              <span aria-hidden="true">→</span>
            </Link>
            <span style={smallMutedStyle}>{primaryIntent.result}</span>
          </div>
          <div style={stateCardStyle}>
            <span style={sectionEyebrowStyle}>Состояние</span>
            <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 13, lineHeight: 1.45 }}>{summary.now}</strong>
          </div>
        </div>
      </div>

      <div data-testid={`role-intent-surface-${role}`} aria-label={`Действия роли: ${summary.title}`} style={{ ...intentSurfaceStyle, borderColor: tone.border, background: tone.bg }}>
        <div style={surfaceHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Что нужно сделать?</h2>
            <div style={smallMutedStyle}>Нажатие ведёт не в пустой раздел, а к конкретному рабочему сценарию.</div>
          </div>
          <Link href={summary.href} data-testid={`role-execution-secondary-action-${role}`} style={secondaryActionStyle}>Открыть основной экран</Link>
        </div>
        <div style={secondaryGridStyle}>
          {secondaryIntents.map((intent) => <IntentCard key={`${intent.label}-${intent.href}`} intent={intent} fallbackTone={summary.tone} role={role} />)}
        </div>
      </div>

      <div style={operationsGridStyle}>
        <InfoList title="Требует внимания" items={summary.attention} tone={summary.tone} />
        <RecentList role={role} items={summary.recent} fallbackTone={summary.tone} />
      </div>

      <div data-testid="platform-v7-role-workspace-hint" style={{ ...controlStripStyle, borderColor: tone.border }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={sectionEyebrowStyle}>Ролевые границы</span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: PLATFORM_V7_TOKENS.color.textPrimary, fontWeight: 760 }}>{summary.hidden}</span>
        </div>
        <Link href={summary.href} style={secondaryActionStyle}>Перейти к роли</Link>
      </div>

      {MONEY_TREE_ROLES.has(role) ? <MoneyTreeStrip /> : null}

      <div style={factsGridStyle}>{rows.map(([label, value]) => <FactCard key={label} label={label} value={value} />)}</div>
    </section>
  );
}

function IntentCard({ intent, fallbackTone, role }: { intent: RoleExecutionIntent; fallbackTone: PlatformV7Tone; role: PlatformV7ExecutionRole }) {
  const intentTone = getPlatformV7ToneTokens(intent.tone ?? fallbackTone);

  return (
    <Link href={intent.href} data-testid={`role-intent-action-${role}`} aria-label={`${intent.label}: ${intent.result}`} style={{ ...intentCardStyle, borderColor: intentTone.border }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
        <span style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 14, lineHeight: 1.2, fontWeight: 860 }}>{intent.label}</span>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: intentTone.bg, color: intentTone.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>→</span>
      </span>
      <span style={smallMutedStyle}>{intent.result}</span>
    </Link>
  );
}

function InfoList({ title, items, tone }: { title: string; items: string[]; tone: PlatformV7Tone }) {
  const toneTokens = getPlatformV7ToneTokens(tone);
  return (
    <div data-testid="role-attention-list" style={panelStyle}>
      <div style={panelTitleStyle}>{title}</div>
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
        {items.map((item) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: PLATFORM_V7_TOKENS.spacing.xs, alignItems: 'start', color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 13, lineHeight: 1.4 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, marginTop: 5, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: toneTokens.fg }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentList({ role, items, fallbackTone }: { role: PlatformV7ExecutionRole; items: RoleExecutionIntent[]; fallbackTone: PlatformV7Tone }) {
  return (
    <div data-testid={`role-recent-work-${role}`} style={panelStyle}>
      <div style={panelTitleStyle}>Продолжить начатое</div>
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
        {items.map((item) => {
          const itemTone = getPlatformV7ToneTokens(item.tone ?? fallbackTone);
          return (
            <Link key={`${item.label}-${item.href}`} href={item.href} style={{ ...recentLinkStyle, borderColor: itemTone.border }}>
              <span style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontWeight: 820 }}>{item.label}</span>
              <span style={smallMutedStyle}>{item.result}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted, padding: PLATFORM_V7_TOKENS.spacing.sm, minWidth: 0 }}>
      <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.micro.size, color: PLATFORM_V7_TOKENS.color.textMuted, textTransform: 'uppercase', letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing, fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight }}>{label}</div>
      <div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.xxs, fontSize: 13, lineHeight: 1.45, color: PLATFORM_V7_TOKENS.color.textPrimary, fontWeight: 760 }}>{value}</div>
    </div>
  );
}

function modeLabel(mode: RoleExecutionSummaryConfig['mode']): string {
  switch (mode) {
    case 'commercial': return 'коммерческий контур';
    case 'field': return 'полевой контур';
    case 'audit': return 'доказательный контур';
    case 'money': return 'денежный контур';
    case 'operations': return 'операционный контур';
    case 'partner': default: return 'партнёрский контур';
  }
}

const shellStyle = { background: PLATFORM_V7_TOKENS.color.surface, border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.xl, padding: PLATFORM_V7_TOKENS.spacing.lg, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, boxShadow: PLATFORM_V7_TOKENS.shadow.soft } as const;
const heroStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 360px)', gap: PLATFORM_V7_TOKENS.spacing.md, alignItems: 'stretch' } as const;
const headlineStyle = { margin: 0, color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: `clamp(25px, 5vw, ${PLATFORM_V7_TOKENS.typography.h1.size}px)`, lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight, fontWeight: 850, letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing } as const;
const leadStyle = { margin: 0, color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: PLATFORM_V7_TOKENS.typography.body.size, lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight, maxWidth: 760 } as const;
const pathStyle = { display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap', alignItems: 'center' } as const;
const pathItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: PLATFORM_V7_TOKENS.color.surfaceMuted, color: PLATFORM_V7_TOKENS.color.textSecondary, padding: '7px 10px', fontSize: 12, fontWeight: 760 } as const;
const primaryTaskStyle = { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.xl, background: PLATFORM_V7_TOKENS.color.backgroundElevated, padding: PLATFORM_V7_TOKENS.spacing.md, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm, minWidth: 0 } as const;
const bigActionStyle = { textDecoration: 'none', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, padding: '13px 14px', borderRadius: PLATFORM_V7_TOKENS.radius.md, color: PLATFORM_V7_TOKENS.color.surface, fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' } as const;
const sectionEyebrowStyle = { fontSize: PLATFORM_V7_TOKENS.typography.micro.size, color: PLATFORM_V7_TOKENS.color.textMuted, textTransform: 'uppercase', letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing, fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight } as const;
const smallMutedStyle = { color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 12, lineHeight: 1.35, fontWeight: 650 } as const;
const stateCardStyle = { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted, padding: PLATFORM_V7_TOKENS.spacing.sm, display: 'grid', gap: 4 } as const;
const intentSurfaceStyle = { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.xl, padding: PLATFORM_V7_TOKENS.spacing.md, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm } as const;
const surfaceHeaderStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap' } as const;
const sectionTitleStyle = { margin: 0, color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 18, lineHeight: 1.25, fontWeight: 850 } as const;
const secondaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm } as const;
const operationsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm } as const;
const controlStripStyle = { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, background: PLATFORM_V7_TOKENS.color.surface, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.sm, display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.sm, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' } as const;
const factsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm } as const;
const secondaryActionStyle = { textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: PLATFORM_V7_TOKENS.radius.sm, background: PLATFORM_V7_TOKENS.color.surface, color: PLATFORM_V7_TOKENS.color.textPrimary, border: `1px solid ${PLATFORM_V7_TOKENS.color.borderStrong}`, fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const intentCardStyle = { textDecoration: 'none', minHeight: 92, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, padding: PLATFORM_V7_TOKENS.spacing.sm, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: PLATFORM_V7_TOKENS.color.surface, border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, boxShadow: PLATFORM_V7_TOKENS.shadow.soft } as const;
const panelStyle = { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, background: PLATFORM_V7_TOKENS.color.surface, padding: PLATFORM_V7_TOKENS.spacing.md, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm, minWidth: 0 } as const;
const panelTitleStyle = { color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 14, lineHeight: 1.3, fontWeight: 850 } as const;
const recentLinkStyle = { textDecoration: 'none', display: 'grid', gap: 3, border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted, padding: PLATFORM_V7_TOKENS.spacing.sm } as const;
