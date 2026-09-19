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
    lead: 'Вес, качество и условия Сделки связываются с документами и расчётными основаниями. Данные учётной системы или ЭДО могут становиться частью этого контекста только через разрешённый для организации маршрут обмена и с понятным источником.',
    flowLabel: 'Путь закрытия Сделки',
    flow: [
      { label: 'Сделка', text: 'Условия и стороны зафиксированы' },
      { label: 'Поставка и качество', text: 'Фактические события связаны со Сделкой' },
      { label: 'Документы', text: 'Основание связано со Сделкой' },
      { label: 'Учёт и ЭДО', text: 'Маршрут и источник данных определяются для организации' },
      { label: 'Расчёт и закрытие', text: 'Видны основания и следующий требуемый шаг' },
    ],
    people: [
      {
        audience: 'Производителю',
        title: 'Только действительно нужные действия',
        text: 'Платформа показывает ответственного, имеющиеся расчётные основания и следующий шаг, если участие пользователя требуется.',
      },
      {
        audience: 'Бухгалтеру',
        title: 'Связь с привычным учётом через управляемый маршрут данных',
        text: 'Для 1С или ЭДО платформа использует отдельный маршрут обмена. В Сделку попадают только данные, полученные из разрешённого источника в пределах прав организации; автоматический обмен и отсутствие двойного ввода не обещаются сами по себе.',
      },
      {
        audience: 'Покупателю',
        title: 'Документы сопоставлены с исполнением',
        text: 'Количество, качество, цена и версия документа рассматриваются вместе с зафиксированными фактами Сделки до расчёта и закрытия.',
      },
    ],
    gekta: {
      eyebrow: 'Гекта объясняет по-человечески',
      title: 'Факт поставки зафиксирован. Следующий шаг — документы.',
      text: 'Пример показывает, как Гекта может объяснить факты Сделки, имеющиеся основания и следующий шаг без самостоятельного решения.',
      status: 'Контекст примера',
    },
    connection: {
      title: 'Маршрут обмена определяется для конкретной организации',
      text: 'Схема зависит от используемой учётной системы, ЭДО, прав и официальных интерфейсов. Платформа не приписывает внешней системе данные или действие без соответствующего источника.',
    },
    protection: {
      title: 'Пробелы в основаниях не скрываются',
      text: 'Если внешнего основания нет или данные расходятся, платформа показывает проблему, источник и ответственного вместо положительного предположения.',
    },
    systemsLabel: 'Возможные направления обмена данными',
    systems: ['1С', '1С-ЭДО', 'Диадок', 'Saby / СБИС'],
    boundary: 'Перечень показывает возможные направления интеграции, а не факт обмена с конкретной организацией. Платформа не заменяет 1С, Диадок, Saby или 1С-ЭДО; каждый внешний факт должен иметь соответствующий источник и основание обмена.',
  },
  en: {
    eyebrow: 'Deal completion',
    title: 'From delivery to documents and settlement grounds in one process',
    lead: 'Weight, quality and Deal terms are linked to documents and settlement grounds. Accounting or EDI data can enter this context only through an organisation-authorised exchange route with a clear source.',
    flowLabel: 'Deal completion path',
    flow: [
      { label: 'Deal', text: 'Terms and parties are fixed' },
      { label: 'Delivery and quality', text: 'Actual events are linked to the Deal' },
      { label: 'Documents', text: 'Each basis is tied to the Deal' },
      { label: 'Accounting and EDI', text: 'Route and data source are defined for the organisation' },
      { label: 'Settlement and close', text: 'Grounds and the next required action are clear' },
    ],
    people: [
      {
        audience: 'For the producer',
        title: 'Only the actions that really matter',
        text: 'The platform shows the responsible party, available settlement grounds and the next action when user participation is required.',
      },
      {
        audience: 'For the accountant',
        title: 'Link familiar accounting through a managed data route',
        text: '1C or EDI uses a separate exchange route. Only data obtained from an authorised source within organisation rights enters the Deal; automatic exchange and zero duplicate entry are not implied.',
      },
      {
        audience: 'For the buyer',
        title: 'Documents are compared with execution',
        text: 'Quantity, quality, price and document version are considered together with recorded Deal facts before settlement and close.',
      },
    ],
    gekta: {
      eyebrow: 'Gekta explains it plainly',
      title: 'Delivery fact recorded. Next step: documents.',
      text: 'This example shows how Gekta can explain Deal facts, available grounds and the next step without taking the decision itself.',
      status: 'Example context',
    },
    connection: {
      title: 'The exchange route is defined for each organisation',
      text: 'The route depends on the accounting system, EDI setup, permissions and official interfaces. The platform does not attribute data or an action to an external system without the corresponding source.',
    },
    protection: {
      title: 'Missing grounds stay visible',
      text: 'When an external ground is absent or data conflicts, the platform shows the issue, source and responsible party instead of a positive assumption.',
    },
    systemsLabel: 'Possible data-exchange directions',
    systems: ['1C', '1C EDI', 'Diadoc', 'Saby'],
    boundary: 'The list describes possible integration directions, not evidence of exchange for a specific organisation. The platform does not replace 1C, Diadoc, Saby or 1C EDI; every external fact requires a corresponding source and exchange basis.',
  },
  zh: {
    eyebrow: '交易闭环',
    title: '从交付到文件与结算依据，形成一条清晰流程',
    lead: '重量、质量和交易条件与文件和结算依据关联。会计或电子文件数据只有通过机构获授权的数据交换路径并带有明确来源时，才能进入这一上下文。',
    flowLabel: '交易闭环路径',
    flow: [
      { label: '交易', text: '条件与双方已经固定' },
      { label: '交付与质量', text: '实际事件与交易关联' },
      { label: '文件', text: '每项依据都关联到交易' },
      { label: '会计与电子文件', text: '机构的数据路径和来源单独确定' },
      { label: '结算与关闭', text: '依据和下一项必要操作清晰可见' },
    ],
    people: [
      {
        audience: '对生产者',
        title: '只显示真正需要的动作',
        text: '平台显示负责人、已有结算依据，以及确实需要用户参与时的下一步。',
      },
      {
        audience: '对会计人员',
        title: '通过受管理的数据路径关联现有会计系统',
        text: '1C 或电子文件使用独立的数据交换路径。只有来自获授权来源且符合机构权限的数据才进入交易；平台不会因此自动承诺数据自动交换或完全避免重复录入。',
      },
      {
        audience: '对买方',
        title: '文件与履约事实一起核对',
        text: '数量、质量、价格和文件版本在结算和关闭前与已记录的交易事实一起核对。',
      },
    ],
    gekta: {
      eyebrow: 'Gekta 用简单语言说明',
      title: '交付事实已记录。下一步：文件。',
      text: '此示例展示 Gekta 如何解释交易事实、已有依据和下一步，而不会自行作出决定。',
      status: '示例上下文',
    },
    connection: {
      title: '每个机构单独确定数据交换路径',
      text: '具体路径取决于会计系统、电子文件环境、权限和官方接口。没有对应来源时，平台不会把数据或操作归给外部系统。',
    },
    protection: {
      title: '缺失依据不会被隐藏',
      text: '缺少外部依据或数据不一致时，平台显示问题、来源和负责人，而不是给出正面假设。',
    },
    systemsLabel: '可能的数据交换方向',
    systems: ['1C', '1C 电子文件', 'Diadoc', 'Saby'],
    boundary: '该列表表示可能的集成方向，并不证明某个机构已经发生数据交换。平台不替代 1C、Diadoc、Saby 或 1C 电子文件；每个外部事实都需要对应来源和数据交换依据。',
  },
} as const;

export type PlatformV7AccountingValueCopy = WidenCopy<typeof copies.ru>;

export function getPlatformV7AccountingValueCopy(locale: string): PlatformV7AccountingValueCopy {
  if (locale.startsWith('en')) return copies.en;
  if (locale.startsWith('zh')) return copies.zh;
  return copies.ru;
}
