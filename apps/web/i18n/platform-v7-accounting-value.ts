export type PlatformV7AccountingValueLocale = 'ru' | 'en' | 'zh';

const copies = {
  ru: {
    eyebrow: 'Закрытие Сделки',
    title: 'От поставки до документов и денег — в одном понятном процессе',
    lead: 'Вес, качество и условия Сделки становятся основанием для документов. После подключения организация продолжает работать в своей 1С и ЭДО, а платформа возвращает статусы в Сделку и показывает следующий шаг.',
    flowLabel: 'Путь закрытия Сделки',
    flow: [
      { label: 'Сделка', text: 'Условия и стороны зафиксированы' },
      { label: 'Поставка и качество', text: 'Подтверждены фактические события' },
      { label: 'Документы', text: 'Основание связано со Сделкой' },
      { label: '1С и ЭДО', text: 'Учёт и обмен остаются привычными' },
      { label: 'Оплата и закрытие', text: 'Понятно, что завершено и что ждёт действия' },
    ],
    people: [
      {
        audience: 'Фермеру',
        title: 'Только действительно нужные действия',
        text: 'Не нужно разбираться в бухгалтерских программах. Платформа показывает ответственного, статус денег и одно действие, если оно требуется.',
      },
      {
        audience: 'Бухгалтеру',
        title: 'Привычная 1С без двойного ввода',
        text: 'После подключения бухгалтер продолжает работать в своей учётной системе и ЭДО. Данные Сделки и подтверждённые статусы не приходится переносить вручную между окнами.',
      },
      {
        audience: 'Покупателю',
        title: 'Документы совпадают с реальной поставкой',
        text: 'Количество, качество, цена и версия документа сопоставлены с фактами Сделки до расчёта и закрытия.',
      },
    ],
    gekta: {
      eyebrow: 'Гекта объясняет по-человечески',
      title: 'Поставка принята. Документы готовы к проверке.',
      text: 'От вас сейчас ничего не требуется. Следующее действие назначено бухгалтеру организации.',
      status: 'Пример понятного статуса',
    },
    connection: {
      title: 'Подключение — один раз для организации',
      text: 'Не для каждого сотрудника и без обязательного выезда нашей команды. Конкретный режим определяется по учётной системе и ЭДО организации.',
    },
    protection: {
      title: 'Ошибки и подозрительные действия не проходят молча',
      text: 'Подмена реквизитов, неизвестная подпись, повторный платёж или расхождение с 1С требуют дополнительной проверки.',
    },
    systemsLabel: 'Предусмотренные маршруты подключения',
    systems: ['1С', '1С-ЭДО', 'Диадок', 'Saby / СБИС'],
    boundary: 'Платформа не заменяет 1С, Диадок, Saby или 1С-ЭДО. Она связывает подтверждённые события со Сделкой. Доступность конкретного маршрута подтверждается при подключении организации.',
  },
  en: {
    eyebrow: 'Deal completion',
    title: 'From delivery to documents and money in one clear process',
    lead: 'Weight, quality and Deal terms become the basis for documents. Once connected, the organisation keeps using its familiar accounting and EDI systems while the platform returns verified statuses to the Deal and shows the next step.',
    flowLabel: 'Deal completion path',
    flow: [
      { label: 'Deal', text: 'Terms and parties are fixed' },
      { label: 'Delivery and quality', text: 'Actual events are confirmed' },
      { label: 'Documents', text: 'Each basis is tied to the Deal' },
      { label: 'Accounting and EDI', text: 'Existing work tools remain in place' },
      { label: 'Payment and close', text: 'Completed and pending actions are clear' },
    ],
    people: [
      {
        audience: 'For the producer',
        title: 'Only the actions that really matter',
        text: 'No need to understand accounting software. The platform shows the owner, money status and one action when participation is required.',
      },
      {
        audience: 'For the accountant',
        title: 'Familiar accounting without duplicate entry',
        text: 'After connection, the accountant continues in the existing accounting and EDI systems. Deal data and verified statuses do not need to be retyped across applications.',
      },
      {
        audience: 'For the buyer',
        title: 'Documents match the actual delivery',
        text: 'Quantity, quality, price and document version are compared with Deal facts before settlement and close.',
      },
    ],
    gekta: {
      eyebrow: 'Gekta explains it plainly',
      title: 'Delivery accepted. Documents are ready for review.',
      text: 'No action is required from you now. The next step is assigned to the organisation accountant.',
      status: 'Example of a clear status',
    },
    connection: {
      title: 'Connect once for the organisation',
      text: 'Not for every employee and without a mandatory on-site visit from our team. The route is selected according to the organisation accounting and EDI setup.',
    },
    protection: {
      title: 'Errors and suspicious actions do not pass silently',
      text: 'Changed bank details, an unknown signature, a repeated payment or an accounting mismatch require an additional check.',
    },
    systemsLabel: 'Supported connection routes',
    systems: ['1C', '1C EDI', 'Diadoc', 'Saby'],
    boundary: 'The platform does not replace 1C, Diadoc, Saby or 1C EDI. It connects verified events to the Deal. Availability of a particular route is confirmed during organisation connection.',
  },
  zh: {
    eyebrow: '交易闭环',
    title: '从交付到单据与资金，形成一条清晰流程',
    lead: '重量、质量和交易条件成为单据依据。完成接入后，机构继续使用原有会计和电子单据系统，平台把已确认状态带回交易并显示下一步。',
    flowLabel: '交易闭环路径',
    flow: [
      { label: '交易', text: '条件与双方已经固定' },
      { label: '交付与质量', text: '实际事件已经确认' },
      { label: '单据', text: '每项依据都关联到交易' },
      { label: '会计与电子单据', text: '保留原有工作工具' },
      { label: '付款与关闭', text: '已完成与待处理事项一目了然' },
    ],
    people: [
      {
        audience: '对生产者',
        title: '只显示真正需要的动作',
        text: '无需理解会计软件。平台显示负责人、资金状态，以及确实需要参与时的唯一下一步。',
      },
      {
        audience: '对会计人员',
        title: '保留熟悉系统，避免重复录入',
        text: '接入后，会计人员继续使用原有会计和电子单据系统，交易数据与已确认状态无需在多个窗口重复录入。',
      },
      {
        audience: '对买方',
        title: '单据与实际交付一致',
        text: '数量、质量、价格和单据版本在结算与关闭前与交易事实核对。',
      },
    ],
    gekta: {
      eyebrow: 'Gekta 用简单语言说明',
      title: '交付已验收，单据已准备审核。',
      text: '当前无需你操作。下一步已分配给机构会计人员。',
      status: '清晰状态示例',
    },
    connection: {
      title: '每个机构只需接入一次',
      text: '无需为每位员工重复配置，也不要求我们的团队必须上门。系统会根据机构现有会计与电子单据环境选择接入方式。',
    },
    protection: {
      title: '错误和可疑操作不会被静默放行',
      text: '收款信息变更、未知签名、重复付款或会计数据不一致都需要额外检查。',
    },
    systemsLabel: '预设接入路径',
    systems: ['1C', '1C 电子单据', 'Diadoc', 'Saby'],
    boundary: '平台不替代 1C、Diadoc、Saby 或 1C 电子单据，而是把已确认事件关联到交易。具体接入路径在机构连接时确认。',
  },
} as const;

export type PlatformV7AccountingValueCopy = typeof copies.ru;

export function getPlatformV7AccountingValueCopy(locale: string): PlatformV7AccountingValueCopy {
  if (locale.startsWith('en')) return copies.en as PlatformV7AccountingValueCopy;
  if (locale.startsWith('zh')) return copies.zh as PlatformV7AccountingValueCopy;
  return copies.ru;
}
