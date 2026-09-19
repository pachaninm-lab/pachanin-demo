import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import type { PlatformV7RouteIconKey } from './platformV7RouteIcons';

export type RoleIntentAction = {
  label: string;
  verb: string;
  description: string;
  href: string;
  targetRoute: string;
  requiredPermission: string;
  iconKey: PlatformV7RouteIconKey;
  resultLabel: string;
  owner: string;
};

export type RoleIntentItem = {
  label: string;
  href: string;
  owner: string;
  iconKey: PlatformV7RouteIconKey;
  resultLabel: string;
};

export type RoleIntentConfig = {
  role: PlatformRole;
  title: string;
  subtitle: string;
  primaryActions: RoleIntentAction[];
  attentionItems: RoleIntentItem[];
  continueItems: RoleIntentItem[];
};

function action(
  label: string,
  verb: string,
  description: string,
  href: string,
  iconKey: PlatformV7RouteIconKey,
  resultLabel: string,
  owner: string,
  requiredPermission = 'membership.role.allowed'
): RoleIntentAction {
  return { label, verb, description, href, targetRoute: href, requiredPermission, iconKey, resultLabel, owner };
}

function item(label: string, href: string, owner: string, iconKey: PlatformV7RouteIconKey, resultLabel: string): RoleIntentItem {
  return { label, href, owner, iconKey, resultLabel };
}

export const ROLE_INTENT_ACTIONS: Record<PlatformRole, RoleIntentConfig> = {
  buyer: {
    role: 'buyer',
    title: 'Рабочее место покупателя',
    subtitle: 'Покупка, поставка, документы, оплата и спор — через следующий проверяемый шаг.',
    primaryActions: [
      action('Купить зерно', 'Купить', 'Открыть отбор партий и перейти к закупке.', '/platform-v7/procurement', 'auction', 'сформировать запрос или выбрать партию', 'Покупатель'),
      action('Продолжить сделку', 'Продолжить', 'Вернуться к активной сделке и снять ближайшую остановку.', '/platform-v7/deals/DL-9102', 'deal', 'открыть текущую сделку', 'Покупатель'),
      action('Проверить оплату', 'Проверить', 'Сверить резерв, удержание и банковское основание.', '/platform-v7/bank/payment-basis', 'settlement', 'понять статус оплаты', 'Банк'),
      action('Принять поставку', 'Принять', 'Перейти к приёмке рейса и фактической массе.', '/platform-v7/deal-acceptance', 'acceptance', 'сверить факт поставки', 'Элеватор'),
      action('Подписать документы', 'Подписать', 'Открыть документы, которые держат банковскую проверку.', '/platform-v7/deal-documents-basis', 'documents', 'закрыть документный стоп', 'Покупатель'),
      action('Сообщить о проблеме', 'Сообщить', 'Открыть спор по качеству, весу или документам.', '/platform-v7/disputes', 'dispute', 'создать связанный спор', 'Арбитр'),
    ],
    attentionItems: [
      item('сделка ждёт оплаты', '/platform-v7/bank/payment-basis', 'Банк', 'settlement', 'проверить основание'),
      item('документы ждут подписи', '/platform-v7/deal-documents-basis', 'Покупатель', 'documents', 'подписать пакет'),
      item('спор открыт 3 дня', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'проверить доказательства'),
    ],
    continueItems: [
      item('Сделка №1042 — ожидает приёмки', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'принять рейс'),
      item('Документы №1038 — не хватает СДИЗ', '/platform-v7/deal-documents-basis', 'Оператор', 'documents', 'проверить СДИЗ'),
    ],
  },
  seller: {
    role: 'seller',
    title: 'Рабочее место продавца',
    subtitle: 'Партия, ФГИС, ставка, отгрузка, документы и путь к оплате.',
    primaryActions: [
      action('Продать зерно', 'Продать', 'Создать партию и довести её до допуска.', '/platform-v7/seller/lots', 'fgis', 'подготовить партию к сделке', 'Продавец'),
      action('Подтвердить ФГИС-партию', 'Подтвердить', 'Сверить владельца, ФГИС-лот и СДИЗ.', '/platform-v7/fgis-access', 'fgis', 'создать основание импорта', 'Продавец'),
      action('Ответить покупателю', 'Ответить', 'Открыть сделки, где покупатель ждёт решения.', '/platform-v7/deals', 'deal', 'снять ожидание покупателя', 'Продавец'),
      action('Продолжить сделку', 'Продолжить', 'Вернуться к сделке после ставки.', '/platform-v7/auction/deal-basis', 'deal', 'проверить основание сделки', 'Оператор'),
      action('Отгрузить зерно', 'Отгрузить', 'Перейти к рейсу из основания сделки.', '/platform-v7/deal-logistics', 'logistics', 'назначить или подтвердить рейс', 'Логистика'),
      action('Получить оплату', 'Получить', 'Проверить, что держит оплату: документы, качество или спор.', '/platform-v7/bank/payment-basis', 'settlement', 'понять путь к оплате', 'Банк'),
    ],
    attentionItems: [
      item('не хватает СДИЗ', '/platform-v7/fgis-access', 'Продавец', 'fgis', 'прикрепить СДИЗ'),
      item('покупатель ждёт ответа', '/platform-v7/deals', 'Продавец', 'deal', 'ответить по сделке'),
      item('документы ждут подписи', '/platform-v7/deal-documents-basis', 'Продавец', 'documents', 'подписать пакет'),
    ],
    continueItems: [
      item('ФГИС-лот №2607-014 — требуется допуск', '/platform-v7/auction/admission', 'Комплаенс', 'compliance', 'закрыть допуск'),
      item('Рейс №77 — водитель в пути', '/platform-v7/deal-logistics', 'Логистика', 'logistics', 'проверить рейс'),
    ],
  },
  operator: {
    role: 'operator',
    title: 'Рабочее место оператора',
    subtitle: 'Проблемные сделки, допуск, ответственные, документы и блокировки.',
    primaryActions: [
      action('Проверить проблемные сделки', 'Проверить', 'Открыть сделки с риском, удержанием или спором.', '/platform-v7/control-tower', 'deal', 'найти главную остановку', 'Оператор'),
      action('Допустить ФГИС-лот', 'Допустить', 'Провести импорт и допуск партии.', '/platform-v7/auction/admission', 'fgis', 'закрыть проверку партии', 'Комплаенс'),
      action('Продолжить сделку', 'Продолжить', 'Открыть основание после аукциона.', '/platform-v7/auction/deal-basis', 'deal', 'связать ставку и рейс', 'Оператор'),
      action('Назначить ответственного', 'Назначить', 'Передать следующий шаг владельцу процесса.', '/platform-v7/control-tower', 'compliance', 'снять неопределённость владельца', 'Оператор'),
      action('Проверить документы', 'Проверить', 'Открыть комплект документов до банковской проверки.', '/platform-v7/deal-documents-basis', 'documents', 'найти документный стоп', 'Оператор'),
      action('Разобрать блокировку', 'Разобрать', 'Открыть спор или комплаенс-стоп.', '/platform-v7/disputes', 'dispute', 'снять блокировку по фактам', 'Арбитр'),
    ],
    attentionItems: [
      item('партия требует допуска', '/platform-v7/auction/admission', 'Комплаенс', 'fgis', 'проверить допуск'),
      item('рейс без водителя', '/platform-v7/deal-logistics', 'Логистика', 'logistics', 'назначить водителя'),
      item('спор открыт 3 дня', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'проверить SLA'),
    ],
    continueItems: [
      item('Сделка №1042 — ожидает приёмки', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'передать на приёмку'),
      item('Документы №1038 — не хватает СДИЗ', '/platform-v7/deal-documents-basis', 'Оператор', 'documents', 'закрыть комплект'),
    ],
  },
  logistics: {
    role: 'logistics',
    title: 'Рабочее место логистики',
    subtitle: 'Рейсы, маршруты, водители, прибытие и проблема в пути.',
    primaryActions: [
      action('Назначить рейс', 'Назначить', 'Создать рейс из основания сделки.', '/platform-v7/deal-logistics', 'logistics', 'назначить рейс', 'Логистика'),
      action('Продолжить рейс', 'Продолжить', 'Открыть активный маршрут.', '/platform-v7/logistics', 'logistics', 'продолжить исполнение рейса', 'Логистика'),
      action('Проверить маршрут', 'Проверить', 'Сверить путь, окно и отклонение.', '/platform-v7/logistics', 'logistics', 'найти маршрутный риск', 'Логистика'),
      action('Назначить водителя', 'Назначить', 'Передать рейс водителю.', '/platform-v7/driver', 'logistics', 'закрепить водителя', 'Логистика'),
      action('Подтвердить прибытие', 'Подтвердить', 'Передать рейс в приёмку.', '/platform-v7/deal-acceptance', 'acceptance', 'открыть приёмку', 'Элеватор'),
      action('Сообщить проблему', 'Сообщить', 'Открыть проблему по рейсу.', '/platform-v7/disputes', 'dispute', 'связать проблему со сделкой', 'Логистика'),
    ],
    attentionItems: [
      item('рейс без водителя', '/platform-v7/deal-logistics', 'Логистика', 'logistics', 'назначить водителя'),
      item('машина ждёт приёмку', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'передать на вес'),
      item('маршрут отклонён', '/platform-v7/logistics', 'Логистика', 'logistics', 'проверить маршрут'),
    ],
    continueItems: [
      item('Рейс №77 — водитель в пути', '/platform-v7/logistics', 'Логистика', 'logistics', 'открыть рейс'),
      item('Сделка №1042 — ожидает приёмки', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'принять машину'),
    ],
  },
  driver: {
    role: 'driver',
    title: 'Рабочее место водителя',
    subtitle: 'Один рейс, один следующий шаг, минимум текста.',
    primaryActions: [
      action('Открыть мой рейс', 'Открыть', 'Показать текущий рейс и маршрут.', '/platform-v7/driver', 'logistics', 'увидеть текущий рейс', 'Водитель'),
      action('Подтвердить прибытие', 'Подтвердить', 'Зафиксировать прибытие на точку.', '/platform-v7/deal-acceptance', 'acceptance', 'передать рейс на приёмку', 'Водитель'),
      action('Загрузить фото', 'Загрузить', 'Передать фотофиксацию по рейсу.', '/platform-v7/driver', 'documents', 'добавить доказательство', 'Водитель'),
      action('Показать документы', 'Показать', 'Открыть документы по рейсу.', '/platform-v7/deal-documents-basis', 'documents', 'показать пакет рейса', 'Водитель'),
      action('Сообщить проблему', 'Сообщить', 'Открыть проблему по рейсу.', '/platform-v7/disputes', 'dispute', 'зафиксировать инцидент', 'Водитель'),
      action('Завершить рейс', 'Завершить', 'Передать рейс в закрытие после приёмки.', '/platform-v7/deal-acceptance', 'acceptance', 'закрыть полевой этап', 'Водитель'),
    ],
    attentionItems: [
      item('рейс ждёт прибытия', '/platform-v7/driver', 'Водитель', 'logistics', 'подтвердить прибытие'),
      item('не хватает фото', '/platform-v7/driver', 'Водитель', 'documents', 'загрузить фото'),
    ],
    continueItems: [
      item('Рейс №77 — водитель в пути', '/platform-v7/driver', 'Водитель', 'logistics', 'открыть маршрут'),
      item('Приёмка №1042 — ждёт машину', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'подтвердить прибытие'),
    ],
  },
  surveyor: {
    role: 'surveyor',
    title: 'Рабочее место сюрвейера',
    subtitle: 'Осмотр, фото, вес, доказательства и передача в спорный контур.',
    primaryActions: [
      action('Открыть назначение', 'Открыть', 'Посмотреть назначенный осмотр.', '/platform-v7/surveyor', 'acceptance', 'открыть осмотр', 'Сюрвейер'),
      action('Зафиксировать вес', 'Зафиксировать', 'Сохранить весовое доказательство.', '/platform-v7/deal-acceptance', 'acceptance', 'добавить вес', 'Сюрвейер'),
      action('Загрузить фото', 'Загрузить', 'Добавить фото к evidence pack.', '/platform-v7/surveyor', 'documents', 'добавить фото', 'Сюрвейер'),
      action('Сообщить расхождение', 'Сообщить', 'Открыть спорный показатель.', '/platform-v7/disputes', 'dispute', 'связать расхождение со спором', 'Сюрвейер'),
    ],
    attentionItems: [item('не хватает фотофиксации', '/platform-v7/surveyor', 'Сюрвейер', 'documents', 'загрузить фото')],
    continueItems: [item('Осмотр №1042 — ждёт доказательства', '/platform-v7/surveyor', 'Сюрвейер', 'acceptance', 'добавить акт')],
  },
  elevator: {
    role: 'elevator',
    title: 'Рабочее место элеватора',
    subtitle: 'Машина, вес, проба, приёмка, расхождение и документы.',
    primaryActions: [
      action('Принять машину', 'Принять', 'Открыть рейс на приёмку.', '/platform-v7/deal-acceptance', 'acceptance', 'начать приёмку', 'Элеватор'),
      action('Зафиксировать вес', 'Зафиксировать', 'Внести фактическую массу по рейсу.', '/platform-v7/deal-acceptance', 'acceptance', 'сохранить вес', 'Элеватор'),
      action('Передать пробу', 'Передать', 'Передать пробу в лабораторию.', '/platform-v7/lab', 'quality', 'открыть качество', 'Лаборатория'),
      action('Подтвердить приёмку', 'Подтвердить', 'Закрыть приёмку конкретного рейса.', '/platform-v7/deal-acceptance', 'acceptance', 'подтвердить факт приёмки', 'Элеватор'),
      action('Сообщить расхождение', 'Сообщить', 'Открыть проблему по весу или качеству.', '/platform-v7/disputes', 'dispute', 'запустить разбор', 'Элеватор'),
      action('Открыть документы', 'Открыть', 'Проверить акт веса и акт приёмки.', '/platform-v7/deal-documents-basis', 'documents', 'проверить документы', 'Элеватор'),
    ],
    attentionItems: [
      item('машина ждёт вес', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'зафиксировать вес'),
      item('проба не передана', '/platform-v7/lab', 'Лаборатория', 'quality', 'передать пробу'),
    ],
    continueItems: [item('Сделка №1042 — ожидает приёмки', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'принять рейс')],
  },
  lab: {
    role: 'lab',
    title: 'Рабочее место лаборатории',
    subtitle: 'Проба, качество, отклонения, протокол и спорный показатель.',
    primaryActions: [
      action('Принять пробу', 'Принять', 'Открыть входящую пробу.', '/platform-v7/lab', 'quality', 'принять пробу', 'Лаборатория'),
      action('Внести качество', 'Внести', 'Зафиксировать показатели качества.', '/platform-v7/lab', 'quality', 'сохранить качество', 'Лаборатория'),
      action('Проверить отклонения', 'Проверить', 'Сравнить показатели с допуском.', '/platform-v7/lab', 'quality', 'найти отклонения', 'Лаборатория'),
      action('Подтвердить протокол', 'Подтвердить', 'Закрыть протокол качества.', '/platform-v7/deal-documents-basis', 'documents', 'передать протокол в документы', 'Лаборатория'),
      action('Сообщить спорный показатель', 'Сообщить', 'Открыть спор по качеству.', '/platform-v7/disputes', 'dispute', 'связать показатель со спором', 'Лаборатория'),
      action('Открыть сделку', 'Открыть', 'Посмотреть сделку, к которой относится проба.', '/platform-v7/deals/DL-9102', 'deal', 'проверить связку со сделкой', 'Лаборатория'),
    ],
    attentionItems: [
      item('показатель требует проверки', '/platform-v7/lab', 'Лаборатория', 'quality', 'проверить отклонение'),
      item('протокол ждёт подтверждения', '/platform-v7/deal-documents-basis', 'Лаборатория', 'documents', 'подтвердить протокол'),
    ],
    continueItems: [item('Проба №1042 — ждёт протокол', '/platform-v7/lab', 'Лаборатория', 'quality', 'внести качество')],
  },
  bank: {
    role: 'bank',
    title: 'Рабочее место банка',
    subtitle: 'Основание, документы, риск и подготовка расчёта без live banking claims.',
    primaryActions: [
      action('Проверить основание', 'Проверить', 'Сверить сделку, документы и банковское основание.', '/platform-v7/bank/payment-basis', 'settlement', 'проверить платёжное основание', 'Банк'),
      action('Проверить оплату', 'Проверить', 'Посмотреть резерв и удержание.', '/platform-v7/bank', 'settlement', 'понять статус оплаты', 'Банк'),
      action('Подготовить расчёт', 'Подготовить', 'Собрать расчёт к проверке.', '/platform-v7/bank/payment-basis', 'settlement', 'подготовить расчёт', 'Банк'),
      action('Проверить документы', 'Проверить', 'Сверить комплект для банковской проверки.', '/platform-v7/deal-documents-basis', 'documents', 'найти документный стоп', 'Банк'),
      action('Проверить риск', 'Проверить', 'Открыть риск по участникам и сделке.', '/platform-v7/compliance', 'compliance', 'оценить риск', 'Комплаенс'),
      action('Вернуть на доработку', 'Вернуть', 'Вернуть основание ответственному.', '/platform-v7/bank/payment-basis', 'settlement', 'зафиксировать доработку', 'Банк'),
    ],
    attentionItems: [
      item('основание требует проверки', '/platform-v7/bank/payment-basis', 'Банк', 'settlement', 'проверить основание'),
      item('документы ждут сверки', '/platform-v7/deal-documents-basis', 'Банк', 'documents', 'проверить комплект'),
      item('риск требует решения', '/platform-v7/compliance', 'Комплаенс', 'compliance', 'проверить риск'),
    ],
    continueItems: [item('Сделка №1042 — ждёт банковской проверки', '/platform-v7/bank/payment-basis', 'Банк', 'settlement', 'проверить основание')],
  },
  compliance: {
    role: 'compliance',
    title: 'Рабочее место комплаенса',
    subtitle: 'Участник, ФГИС-лот, покупатель, документы, риск и блокировка действия.',
    primaryActions: [
      action('Проверить участника', 'Проверить', 'Сверить организацию и полномочия.', '/platform-v7/compliance', 'compliance', 'проверить участника', 'Комплаенс'),
      action('Проверить ФГИС-лот', 'Проверить', 'Сверить ФГИС-лот, СДИЗ и владельца.', '/platform-v7/fgis-access', 'fgis', 'проверить лот', 'Комплаенс'),
      action('Проверить покупателя', 'Проверить', 'Сверить допуск покупателя.', '/platform-v7/auction/admission', 'compliance', 'подтвердить допуск', 'Комплаенс'),
      action('Проверить документы', 'Проверить', 'Открыть документные блокеры.', '/platform-v7/deal-documents-basis', 'documents', 'проверить пакет', 'Комплаенс'),
      action('Разобрать риск', 'Разобрать', 'Открыть риск по сделке.', '/platform-v7/compliance', 'compliance', 'закрыть риск', 'Комплаенс'),
      action('Заблокировать действие', 'Заблокировать', 'Зафиксировать запрет до проверки.', '/platform-v7/compliance', 'compliance', 'остановить рискованное действие', 'Комплаенс'),
    ],
    attentionItems: [
      item('партия требует допуска', '/platform-v7/auction/admission', 'Комплаенс', 'fgis', 'проверить допуск'),
      item('не хватает СДИЗ', '/platform-v7/fgis-access', 'Комплаенс', 'fgis', 'проверить СДИЗ'),
      item('покупатель ждёт допуска', '/platform-v7/auction/admission', 'Комплаенс', 'compliance', 'проверить покупателя'),
    ],
    continueItems: [item('ФГИС-лот №2607-014 — требуется допуск', '/platform-v7/auction/admission', 'Комплаенс', 'fgis', 'закрыть допуск')],
  },
  arbitrator: {
    role: 'arbitrator',
    title: 'Рабочее место арбитра',
    subtitle: 'Спор, доказательства, вес, качество, документы и решение.',
    primaryActions: [
      action('Открыть спор', 'Открыть', 'Открыть связанный спор по сделке.', '/platform-v7/disputes', 'dispute', 'выбрать спор', 'Арбитр'),
      action('Проверить доказательства', 'Проверить', 'Сверить evidence pack.', '/platform-v7/disputes/DK-2024-89', 'dispute', 'проверить пакет доказательств', 'Арбитр'),
      action('Сравнить вес', 'Сравнить', 'Сверить массу по рейсу и акту.', '/platform-v7/deal-acceptance', 'acceptance', 'проверить вес', 'Арбитр'),
      action('Сравнить качество', 'Сравнить', 'Сверить лабораторный протокол.', '/platform-v7/lab', 'quality', 'проверить качество', 'Арбитр'),
      action('Запросить документ', 'Запросить', 'Запросить недостающий документ.', '/platform-v7/deal-documents-basis', 'documents', 'закрыть документный разрыв', 'Арбитр'),
      action('Зафиксировать решение', 'Зафиксировать', 'Подготовить решение по спору.', '/platform-v7/disputes/DK-2024-89', 'dispute', 'зафиксировать решение', 'Арбитр'),
    ],
    attentionItems: [
      item('спор открыт 3 дня', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'проверить SLA'),
      item('не хватает доказательств веса', '/platform-v7/deal-acceptance', 'Арбитр', 'acceptance', 'сравнить вес'),
    ],
    continueItems: [item('Спор №DK-2024-89 — ждёт решения', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'зафиксировать решение')],
  },
  executive: {
    role: 'executive',
    title: 'Рабочее место руководителя',
    subtitle: 'Сделки, деньги, блокировки, споры, выручка и отчёт.',
    primaryActions: [
      action('Проверить сделки', 'Проверить', 'Открыть портфель сделок.', '/platform-v7/deals', 'deal', 'увидеть сделки', 'Руководитель'),
      action('Проверить деньги', 'Проверить', 'Посмотреть резерв, удержание и банковские основания.', '/platform-v7/bank', 'settlement', 'увидеть деньги под риском', 'Руководитель'),
      action('Проверить блокировки', 'Проверить', 'Открыть стоп-факторы.', '/platform-v7/control-tower', 'compliance', 'увидеть блокировки', 'Оператор'),
      action('Проверить споры', 'Проверить', 'Открыть активные споры.', '/platform-v7/disputes', 'dispute', 'увидеть спорность', 'Арбитр'),
      action('Проверить выручку', 'Проверить', 'Открыть аналитику.', '/platform-v7/analytics', 'settlement', 'увидеть выручку', 'Руководитель'),
      action('Открыть отчёт', 'Открыть', 'Открыть управленческий отчёт.', '/platform-v7/analytics', 'documents', 'собрать отчёт', 'Руководитель'),
    ],
    attentionItems: [
      item('спор открыт 3 дня', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'проверить спор'),
      item('сделка ждёт оплаты', '/platform-v7/bank/payment-basis', 'Банк', 'settlement', 'проверить основание'),
      item('партия требует допуска', '/platform-v7/auction/admission', 'Комплаенс', 'fgis', 'проверить допуск'),
    ],
    continueItems: [
      item('Сделка №1042 — ожидает приёмки', '/platform-v7/deal-acceptance', 'Элеватор', 'acceptance', 'проверить приёмку'),
      item('Спор №DK-2024-89 — ждёт решения', '/platform-v7/disputes/DK-2024-89', 'Арбитр', 'dispute', 'проверить решение'),
    ],
  },
};

export const ROLE_INTENT_ROLES = Object.keys(ROLE_INTENT_ACTIONS) as PlatformRole[];

export function getRoleIntentConfig(role: PlatformRole) {
  return ROLE_INTENT_ACTIONS[role];
}
