export type PlatformV7AccountingValueLocale = 'ru' | 'en' | 'zh';

type WidenCopy<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly WidenCopy<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: WidenCopy<T[Key]> }
      : T;

const copies = {
  ru: {
    eyebrow: 'Закрытие Сделки',
    title: 'От поставки до документов и расчётных оснований — в одном процессе',
    lead: 'Вес, качество и условия Сделки связываются с документами и расчётными основаниями. Если для организации подтверждён конкретный маршрут обмена с учётной системой или ЭДО, платформа может связывать его статусы со Сделкой; без подтверждения такой обмен не считается активным.',
    flowLabel: 'Путь закрытия Сделки',
    flow: [
      { label: 'Сделка', text: 'Условия и стороны зафиксированы' },
      { label: 'Поставка и качество', text: 'Подтверждены фактические события' },
      { label: 'Документы', text: 'Основание связано со Сделкой' },
      { label: 'Учёт и ЭДО', text: 'Маршрут обмена подтверждается для организации' },
      { label: 'Расчёт и закрытие', text: 'Понятно, что подтверждено и что ждёт действия' },
    ],
    people: [
      {
        audience: 'Производителю',
        title: 'Только действительно нужные действия',
        text: 'Платформа показывает ответственного, состояние расчётных оснований и следующий шаг, если участие пользователя требуется.',
      },
      {
        audience: 'Бухгалтеру',
        title: 'Связь с привычным учётом — после подтверждения подключения',
        text: 'Если для организации подключён согласованный маршрут 1С или ЭДО, подтверждённые статусы могут связываться со Сделкой. До такого подключения платформа не обещает автоматический обмен или отсутствие двойного ввода.',
      },
      {
        audience: 'Покупателю',
        title: 'Документы сопоставлены с исполнением',
        text: 'Количество, качество, цена и версия документа рассматриваются вместе с подтверждёнными фактами Сделки до расчёта и закрытия.',
      },
    ],
    gekta: {
      eyebrow: 'Гекта объясняет по-человечески',
      title: 'Поставка принята. Документы готовы к проверке.',
      text: 'Пример показывает, как Гекта может объяснить состояние Сделки и следующий шаг на доступных подтверждённых данных.',
      status: 'Пример понятного статуса',
    },
    connection: {
      title: 'Подключение определяется для конкретной организации',
      text: 'Схема зависит от используемой учётной системы, ЭДО, прав и доступных официальных интерфейсов. Неподтверждённый маршрут не обозначается как работающий.',
    },
    protection: {
      title: 'Ошибки и неподтверждённые статусы не скрываются',
      text: 'Если внешняя система не подтвердила действие или данные расходятся, платформа показывает проблему и ответственного вместо ложного статуса «готово».',
    },
    systemsLabel: 'Возможные маршруты подключения',
    systems: ['1С', '1С-ЭДО', 'Диадок', 'Saby / СБИС'],
    boundary: 'Перечень показывает поддерживаемые направления интеграции, а не подтверждение активного соединения. Платформа не заменяет 1С, Диадок, Saby или 1С-ЭДО; доступность конкретного маршрута и фактический обмен подтверждаются отдельно для организации.',
  },
  en: {
    eyebrow: 'Deal completion',
    title: 'From delivery to documents and settlement grounds in one process',
    lead: 'Weight, quality and Deal terms are linked to documents and settlement grounds. If a specific accounting or EDI connection is confirmed for the organisation, its verified statuses can be linked back to the Deal; without that confirmation no exchange is presented as active.',
    flowLabel: 'Deal completion path',
    flow: [
      { label: 'Deal', text: 'Terms and parties are fixed' },
      { label: 'Delivery and quality', text: 'Actual events are confirmed' },
      { label: 'Documents', text: 'Each basis is tied to the Deal' },
      { label: 'Accounting and EDI', text: 'The exchange route is confirmed per organisation' },
      { label: 'Settlement and close', text: 'Confirmed and pending actions are clear' },
    ],
    people: [
      {
        audience: 'For the producer',
        title: 'Only the actions that really matter',
        text: 'The platform shows the responsible party, settlement-ground status and the next action when user participation is required.',
      },
      {
        audience: 'For the accountant',
        title: 'Link familiar accounting only after connection is confirmed',
        text: 'When an agreed 1C or EDI route is connected for the organisation, verified statuses can be linked to the Deal. Before that, the platform does not promise automatic exchange or zero duplicate entry.',
      },
      {
        audience: 'For the buyer',
        title: 'Documents are compared with execution',
        text: 'Quantity, quality, price and document version are considered together with verified Deal facts before settlement and close.',
      },
    ],
    gekta: {
      eyebrow: 'Gekta explains it plainly',
      title: 'Delivery accepted. Documents are ready for review.',
      text: 'This example shows how Gekta can explain Deal state and the next step using available verified data.',
      status: 'Example of a clear status',
    },
    connection: {
      title: 'Connection is determined for each organisation',
      text: 'The route depends on the accounting system, EDI setup, permissions and available official interfaces. An unconfirmed route is never shown as working.',
    },
    protection: {
      title: 'Errors and unverified statuses remain visible',
      text: 'When an external system has not confirmed an action or data does not match, the platform shows the problem and owner instead of a false “done” status.',
    },
    systemsLabel: 'Possible connection routes',
    systems: ['1C', '1C EDI', 'Diadoc', 'Saby'],
    boundary: 'The list describes supported integration directions, not active connections. The platform does not replace 1C, Diadoc, Saby or 1C EDI; availability and actual exchange are confirmed separately for each organisation.',
  },
  zh: {
    eyebrow: '交易闭环',
    title: '从交付到文件与结算依据，形成一条清晰流程',
    lead: '重量、质量和交易条件与文件和结算依据关联。只有在机构的会计或电子文件接入已确认后，平台才会把其已确认状态关联到交易；未确认接入不会显示为已启用。',
    flowLabel: '交易闭环路径',
    flow: [
      { label: '交易', text: '条件与双方已经固定' },
      { label: '交付与质量', text: '实际事件已经确认' },
      { label: '文件', text: '每项依据都关联到交易' },
      { label: '会计与电子文件', text: '接入路径按机构单独确认' },
      { label: '结算与关闭', text: '已确认与待处理事项一目了然' },
    ],
    people: [
      {
        audience: '对生产者',
        title: '只显示真正需要的动作',
        text: '平台显示负责人、结算依据状态，以及确实需要用户参与时的下一步。',
      },
      {
        audience: '对会计人员',
        title: '只有接入确认后才关联现有会计系统',
        text: '当机构的 1C 或电子文件路径已经确认接入时，已验证状态可以关联到交易。在此之前，平台不会承诺自动交换或完全避免重复录入。',
      },
      {
        audience: '对买方',
        title: '文件与履约事实一起核对',
        text: '数量、质量、价格和文件版本在结算和关闭前与已确认的交易事实一起核对。',
      },
    ],
    gekta: {
      eyebrow: 'Gekta 用简单语言说明',
      title: '交付已验收，文件已准备审核。',
      text: '此示例展示 Gekta 如何基于可用且已确认的数据解释交易状态和下一步。',
      status: '清晰状态示例',
    },
    connection: {
      title: '每个机构单独确定接入方式',
      text: '具体路径取决于现有会计系统、电子文件环境、权限和可用官方接口。未确认路径不会显示为正在工作。',
    },
    protection: {
      title: '错误和未经确认的状态不会被隐藏',
      text: '当外部系统尚未确认操作或数据不一致时，平台会显示问题和负责人，而不是给出虚假的“已完成”状态。',
    },
    systemsLabel: '可能的接入路径',
    systems: ['1C', '1C 电子文件', 'Diadoc', 'Saby'],
    boundary: '该列表表示支持的集成方向，并不代表已经建立活动连接。平台不替代 1C、Diadoc、Saby 或 1C 电子文件；具体可用性和实际交换需要针对机构单独确认。',
  },
} as const;

export type PlatformV7AccountingValueCopy = WidenCopy<typeof copies.ru>;

export function getPlatformV7AccountingValueCopy(locale: string): PlatformV7AccountingValueCopy {
  if (locale.startsWith('en')) return copies.en;
  if (locale.startsWith('zh')) return copies.zh;
  return copies.ru;
}
