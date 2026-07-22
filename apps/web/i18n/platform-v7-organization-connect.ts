export type OrganizationConnectLocale = 'ru' | 'en' | 'zh';

type Copy = {
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
  call: string;
  note: string;
  required: string;
  roles: string[];
  scenarios: string[];
};

const ru: Copy = {
  eyebrow: 'Подключение организации',
  title: 'Начните подключение с понятного рабочего сценария',
  lead: 'Форма проверяет состав заявки, но не отправляет персональные данные до подключения подтверждённого серверного контура.',
  organization: 'Организация', inn: 'ИНН', name: 'ФИО', position: 'Должность', phone: 'Телефон', email: 'Email', role: 'Роль организации', scenario: 'Интересующий сценарий',
  consent: 'Я согласен на обработку данных после перехода в защищённый контур подключения.', submit: 'Продолжить подключение', call: 'Позвонить вместо формы',
  note: 'На этом этапе данные остаются в браузере и не сохраняются. После подтверждения server endpoint форма будет переведена на полноценную отправку.', required: 'Заполните обязательные поля.',
  roles: ['Производитель / продавец','Покупатель / переработчик','Логистика','Хранение / элеватор','Лаборатория / сюрвейер','Банк / финансовая организация','Государственный / отраслевой партнёр'],
  scenarios: ['Исполнение сделки','Логистика и приёмка','Качество и лаборатория','Документы и доказательства','Финансирование и расчёты','Интеграция с внешней системой']
};

const en: Copy = {
  eyebrow: 'Organisation connection', title: 'Start with a clear operating scenario', lead: 'The form validates the request structure but does not transmit personal data until a verified server-side intake is connected.',
  organization: 'Organisation', inn: 'Tax ID', name: 'Full name', position: 'Position', phone: 'Phone', email: 'Email', role: 'Organisation role', scenario: 'Scenario of interest',
  consent: 'I consent to data processing after transition to the protected connection contour.', submit: 'Continue connection', call: 'Call instead',
  note: 'At this stage data stays in the browser and is not stored. Full submission will be enabled only after the server endpoint is accepted.', required: 'Complete the required fields.',
  roles: ['Producer / seller','Buyer / processor','Logistics','Storage / elevator','Laboratory / surveyor','Bank / financial organisation','Public / industry partner'],
  scenarios: ['Deal execution','Logistics and acceptance','Quality and laboratory','Documents and evidence','Financing and settlement','External-system integration']
};

const zh: Copy = {
  eyebrow: '机构接入', title: '从明确的运营场景开始接入', lead: '在经过验证的服务器接收链路上线前，表单只校验申请结构，不传输个人数据。',
  organization: '机构', inn: '税号', name: '姓名', position: '职务', phone: '电话', email: '邮箱', role: '机构角色', scenario: '关注场景',
  consent: '进入受保护的接入流程后，我同意处理相关数据。', submit: '继续接入', call: '改为电话联系',
  note: '当前阶段数据仅保留在浏览器中，不会存储。服务器端点通过验收后才启用正式提交。', required: '请填写必填字段。',
  roles: ['生产商 / 卖方','买方 / 加工商','物流','仓储 / 筒仓','实验室 / 检验机构','银行 / 金融机构','政府 / 行业合作方'],
  scenarios: ['交易执行','物流与验收','质量与实验室','文件与证据','融资与结算','外部系统集成']
};

export function getOrganizationConnectCopy(locale: string): Copy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
