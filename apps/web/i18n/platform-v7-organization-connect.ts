export type OrganizationConnectLocale = 'ru' | 'en' | 'zh';

type SelectOption = { value: string; label: string };

export type OrganizationConnectCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  organization: string;
  inn: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  role: string;
  scenario: string;
  consent: string;
  submit: string;
  submitting: string;
  call: string;
  note: string;
  required: string;
  successTitle: string;
  successText: string;
  requestLabel: string;
  replayText: string;
  rateLimited: string;
  conflict: string;
  unavailable: string;
  retry: string;
  jsRequired: string;
  protectedContinue: string;
  roles: SelectOption[];
  scenarios: SelectOption[];
};

const roles = {
  ru: [
    ['PRODUCER_SELLER', 'Производитель / продавец'],
    ['BUYER_PROCESSOR', 'Покупатель / переработчик'],
    ['LOGISTICS', 'Логистика'],
    ['STORAGE_ELEVATOR', 'Хранение / элеватор'],
    ['LAB_SURVEYOR', 'Лаборатория / сюрвейер'],
    ['BANK_FINANCE', 'Банк / финансовая организация'],
    ['PUBLIC_INDUSTRY_PARTNER', 'Государственный / отраслевой партнёр'],
  ],
  en: [
    ['PRODUCER_SELLER', 'Producer / seller'],
    ['BUYER_PROCESSOR', 'Buyer / processor'],
    ['LOGISTICS', 'Logistics'],
    ['STORAGE_ELEVATOR', 'Storage / elevator'],
    ['LAB_SURVEYOR', 'Laboratory / surveyor'],
    ['BANK_FINANCE', 'Bank / financial organisation'],
    ['PUBLIC_INDUSTRY_PARTNER', 'Public / industry partner'],
  ],
  zh: [
    ['PRODUCER_SELLER', '生产商 / 卖方'],
    ['BUYER_PROCESSOR', '买方 / 加工商'],
    ['LOGISTICS', '物流'],
    ['STORAGE_ELEVATOR', '仓储 / 筒仓'],
    ['LAB_SURVEYOR', '实验室 / 检验机构'],
    ['BANK_FINANCE', '银行 / 金融机构'],
    ['PUBLIC_INDUSTRY_PARTNER', '政府 / 行业合作方'],
  ],
} satisfies Record<OrganizationConnectLocale, [string, string][]>;

const scenarios = {
  ru: [
    ['DEAL_EXECUTION', 'Исполнение сделки'],
    ['LOGISTICS_ACCEPTANCE', 'Логистика и приёмка'],
    ['QUALITY_LAB', 'Качество и лаборатория'],
    ['DOCUMENTS_EVIDENCE', 'Документы и доказательства'],
    ['FINANCE_SETTLEMENT', 'Финансирование и расчёты'],
    ['EXTERNAL_INTEGRATION', 'Интеграция с внешней системой'],
  ],
  en: [
    ['DEAL_EXECUTION', 'Deal execution'],
    ['LOGISTICS_ACCEPTANCE', 'Logistics and acceptance'],
    ['QUALITY_LAB', 'Quality and laboratory'],
    ['DOCUMENTS_EVIDENCE', 'Documents and evidence'],
    ['FINANCE_SETTLEMENT', 'Financing and settlement'],
    ['EXTERNAL_INTEGRATION', 'External-system integration'],
  ],
  zh: [
    ['DEAL_EXECUTION', '交易执行'],
    ['LOGISTICS_ACCEPTANCE', '物流与验收'],
    ['QUALITY_LAB', '质量与实验室'],
    ['DOCUMENTS_EVIDENCE', '文件与证据'],
    ['FINANCE_SETTLEMENT', '融资与结算'],
    ['EXTERNAL_INTEGRATION', '外部系统集成'],
  ],
} satisfies Record<OrganizationConnectLocale, [string, string][]>;

function options(items: [string, string][]): SelectOption[] {
  return items.map(([value, label]) => ({ value, label }));
}

const ru: OrganizationConnectCopy = {
  eyebrow: 'Подключение организации',
  title: 'Начните подключение с рабочего сценария',
  lead: 'Заявка поступит в защищённый операционный контур. Мы проверим организацию, сценарий и состав необходимой интеграции.',
  organization: 'Организация', inn: 'ИНН', name: 'ФИО', position: 'Должность', phone: 'Телефон', email: 'Email', role: 'Роль организации', scenario: 'Интересующий сценарий',
  consent: 'Я согласен на обработку указанных данных для рассмотрения заявки на подключение.',
  submit: 'Отправить заявку', submitting: 'Отправляем…', call: 'Позвонить вместо формы',
  note: 'После отправки система выдаст номер заявки. Подача заявки не создаёт аккаунт, роль или организацию без проверки.',
  required: 'Проверь обязательные поля.',
  successTitle: 'Заявка зарегистрирована', successText: 'Оператор проверит данные и свяжется по указанным контактам.', requestLabel: 'Номер заявки', replayText: 'Повторная отправка распознана: новая заявка не создана.',
  rateLimited: 'Слишком много попыток. Повтори отправку позже.', conflict: 'Данные формы изменились после первой отправки. Обнови страницу и отправь новую заявку.', unavailable: 'Контур приёма временно недоступен. Позвони нам или повтори позже.', retry: 'Повторить отправку',
  jsRequired: 'Без JavaScript публичная форма заблокирована, чтобы персональные данные не попали в URL.', protectedContinue: 'Перейти в защищённую регистрацию',
  roles: options(roles.ru), scenarios: options(scenarios.ru),
};

const en: OrganizationConnectCopy = {
  eyebrow: 'Organisation connection', title: 'Start with an operating scenario', lead: 'The request enters the protected operations workflow. We will verify the organisation, scenario and required integration scope.',
  organization: 'Organisation', inn: 'Tax ID', name: 'Full name', position: 'Position', phone: 'Phone', email: 'Email', role: 'Organisation role', scenario: 'Scenario of interest',
  consent: 'I consent to processing the supplied data to review this connection request.', submit: 'Submit request', submitting: 'Submitting…', call: 'Call instead',
  note: 'The system returns a request number. Submission does not create an account, role or organisation before verification.', required: 'Check the required fields.',
  successTitle: 'Request registered', successText: 'An operator will verify the data and contact you using the supplied details.', requestLabel: 'Request number', replayText: 'The repeated submission was recognised; no duplicate request was created.',
  rateLimited: 'Too many attempts. Submit again later.', conflict: 'The form changed after the first submission. Refresh the page and create a new request.', unavailable: 'The intake workflow is temporarily unavailable. Call us or retry later.', retry: 'Retry submission',
  jsRequired: 'Without JavaScript the public form is locked so personal data cannot enter the URL.', protectedContinue: 'Continue in protected registration',
  roles: options(roles.en), scenarios: options(scenarios.en),
};

const zh: OrganizationConnectCopy = {
  eyebrow: '机构接入', title: '从明确的运营场景开始接入', lead: '申请将进入受保护的运营流程。我们会核验机构、场景和所需集成范围。',
  organization: '机构', inn: '税号', name: '姓名', position: '职务', phone: '电话', email: '邮箱', role: '机构角色', scenario: '关注场景',
  consent: '我同意为审核接入申请而处理所填写的数据。', submit: '提交申请', submitting: '正在提交…', call: '改为电话联系',
  note: '提交后系统会生成申请编号。审核前不会自动创建账户、角色或机构。', required: '请检查必填字段。',
  successTitle: '申请已登记', successText: '运营人员将核验信息并通过所填写的联系方式联系你。', requestLabel: '申请编号', replayText: '系统识别到重复提交，未创建重复申请。',
  rateLimited: '提交次数过多，请稍后重试。', conflict: '首次提交后表单内容已变化，请刷新页面并创建新申请。', unavailable: '接收流程暂时不可用，请致电或稍后重试。', retry: '重新提交',
  jsRequired: '未启用 JavaScript 时公开表单会被锁定，避免个人数据进入网址。', protectedContinue: '进入受保护的注册流程',
  roles: options(roles.zh), scenarios: options(scenarios.zh),
};

export function getOrganizationConnectCopy(locale: string): OrganizationConnectCopy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
