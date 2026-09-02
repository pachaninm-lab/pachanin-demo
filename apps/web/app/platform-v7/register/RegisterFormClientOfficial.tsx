'use client';

import * as React from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { applyCsrfHeader } from '@/lib/csrf';

type Locale = 'ru' | 'en' | 'zh';

type RegistrationStatus = {
  applicationId?: string;
  status?: string;
  nextAction?: string;
  reason?: string | null;
  correlationId?: string;
  statusToken?: string;
  ok?: boolean;
};

type Copy = {
  participationTitle: string;
  participationLead: string;
  organizationTitle: string;
  organizationLead: string;
  existingOrganizationLead: string;
  applicantTitle: string;
  applicantLead: string;
  consentTitle: string;
  requiredNote: string;
  workspace: string;
  orgType: string;
  legalName: string;
  inn: string;
  innHint: string;
  kpp: string;
  kppHint: string;
  ogrn: string;
  ogrnHint: string;
  region: string;
  fullName: string;
  position: string;
  phone: string;
  phonePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  confirmPassword: string;
  passwordHint: string;
  showPassword: string;
  hidePassword: string;
  passwordMismatch: string;
  terms: string;
  privacy: string;
  acceptTerms: string;
  acceptPrivacy: string;
  submit: string;
  submitting: string;
  unavailable: string;
  invalid: string;
  submissionAccepted: string;
  verifyTitle: string;
  verifyLead: string;
  verifyButton: string;
  verifying: string;
  verifyInvalid: string;
  statusTitle: string;
  refresh: string;
  nextAction: string;
  applicationId: string;
  status: string;
  reason: string;
  unknownStatus: string;
  unknownNextAction: string;
  supportReference: string;
  login: string;
  recovery: string;
  resend: string;
  resending: string;
  resendAccepted: string;
  additionalInformation: string;
  additionalPlaceholder: string;
  sendInformation: string;
  sendingInformation: string;
  informationSent: string;
  statusLabels: Record<string, string>;
  nextLabels: Record<string, string>;
  workspaces: Array<{ value: string; label: string }>;
  orgTypes: Array<{ value: string; label: string }>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    participationTitle: '1. Формат участия',
    participationLead: 'Выберите, как вы планируете работать на платформе. Окончательные полномочия назначаются сервером после проверки заявки.',
    organizationTitle: '2. Сведения об организации',
    organizationLead: 'Укажите сведения, позволяющие однозначно идентифицировать организацию или предпринимателя.',
    existingOrganizationLead: 'Укажите сведения существующей организации, к которой вы запрашиваете присоединение. Новая организация при этом не создаётся.',
    applicantTitle: '3. Заявитель и доступ',
    applicantLead: 'Укажите контактные данные заявителя и задайте пароль для дальнейшего входа.',
    consentTitle: '4. Подтверждение условий',
    requiredNote: 'Поля со знаком * обязательны для заполнения.',
    workspace: 'Формат участия *',
    orgType: 'Статус организации *',
    legalName: 'Наименование организации / ФИО предпринимателя *',
    inn: 'ИНН *',
    innHint: '10 цифр для юридического лица или 12 цифр для ИП / физического лица.',
    kpp: 'КПП (при наличии)',
    kppHint: '9 цифр. Для ИП и самозанятых обычно не указывается.',
    ogrn: 'ОГРН / ОГРНИП (при наличии)',
    ogrnHint: '13 цифр для ОГРН или 15 цифр для ОГРНИП.',
    region: 'Регион *',
    fullName: 'ФИО заявителя *',
    position: 'Должность / статус *',
    phone: 'Телефон *',
    phonePlaceholder: '+7 900 000-00-00',
    email: 'Адрес электронной почты *',
    emailPlaceholder: 'name@company.ru',
    password: 'Пароль *',
    confirmPassword: 'Повторите пароль *',
    passwordHint: '12–128 символов. Используйте как минимум три группы: строчные буквы, прописные буквы, цифры, специальные знаки. Не используйте очевидные последовательности.',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    passwordMismatch: 'Пароли не совпадают. Проверьте введённые значения.',
    terms: 'Пользовательского соглашения',
    privacy: 'Политики обработки персональных данных',
    acceptTerms: 'Я принимаю условия',
    acceptPrivacy: 'Я ознакомлен(а) с',
    submit: 'Отправить заявку на регистрацию',
    submitting: 'Заявка отправляется…',
    unavailable: 'Сервис регистрации временно недоступен. Доступ не создан. Повторите попытку позднее.',
    invalid: 'Проверьте обязательные поля и подтверждения.',
    submissionAccepted: 'Заявка принята. Если указанный адрес доступен для новой регистрации, на него будет направлено письмо с подтверждением. Если учётная запись уже существует, воспользуйтесь входом или восстановлением доступа.',
    verifyTitle: 'Подтверждение электронной почты',
    verifyLead: 'Подтверждение адреса электронной почты не открывает личный кабинет. После подтверждения заявка будет направлена на проверку.',
    verifyButton: 'Подтвердить адрес электронной почты',
    verifying: 'Адрес подтверждается…',
    verifyInvalid: 'Ссылка недействительна, срок её действия истёк или она уже была использована.',
    statusTitle: 'Статус регистрации',
    refresh: 'Обновить статус',
    nextAction: 'Что делать дальше',
    applicationId: 'Номер заявки',
    status: 'Текущий статус',
    reason: 'Комментарий по заявке',
    unknownStatus: 'Статус обновляется',
    unknownNextAction: 'Ожидайте обновления информации по заявке.',
    supportReference: 'Идентификатор обращения:',
    login: 'Войти',
    recovery: 'Восстановить доступ',
    resend: 'Отправить письмо повторно',
    resending: 'Письмо отправляется…',
    resendAccepted: 'Если заявка ожидает подтверждения электронной почты, новое письмо будет направлено повторно.',
    additionalInformation: 'Ответ на запрос проверяющего',
    additionalPlaceholder: 'Укажите запрошенные сведения и при необходимости основание. Не указывайте пароль, коды подтверждения и другие секретные данные.',
    sendInformation: 'Отправить уточнение',
    sendingInformation: 'Уточнение отправляется…',
    informationSent: 'Уточнение сохранено. Заявка возвращена в очередь проверки.',
    statusLabels: {
      EMAIL_VERIFICATION_REQUIRED: 'Ожидается подтверждение электронной почты',
      ORGANIZATION_VERIFICATION_PENDING: 'Заявка находится на проверке',
      ADDITIONAL_INFORMATION_REQUIRED: 'Требуются дополнительные сведения',
      APPROVED: 'Заявка одобрена, выполняется активация',
      ACTIVATED: 'Доступ активирован',
      REJECTED: 'Заявка отклонена',
      SUSPENDED: 'Рассмотрение заявки приостановлено',
      EXPIRED: 'Срок действия заявки истёк',
      CANCELLED: 'Заявка отменена',
    },
    nextLabels: {
      VERIFY_EMAIL: 'Откройте письмо и подтвердите адрес электронной почты.',
      WAIT_FOR_REVIEW: 'Ожидайте решения по заявке. Доступ в личный кабинет пока закрыт.',
      PROVIDE_ADDITIONAL_INFORMATION: 'Предоставьте запрошенные дополнительные сведения.',
      WAIT_FOR_ACTIVATION: 'Ожидайте завершения активации доступа.',
      LOGIN: 'Войдите с подтверждённой учётной записью.',
      CONTACT_SUPPORT: 'При обращении в поддержку сообщите идентификатор обращения, указанный ниже.',
      START_NEW_APPLICATION: 'Подайте новую заявку на регистрацию.',
      WAIT: 'Ожидайте следующего изменения статуса.',
    },
    workspaces: [
      { value: 'seller', label: 'Сельхозпроизводитель / продавец продукции' },
      { value: 'buyer', label: 'Покупатель продукции' },
      { value: 'logistics', label: 'Логистическая организация' },
      { value: 'driver', label: 'Водитель' },
      { value: 'elevator', label: 'Элеватор / зернохранилище' },
      { value: 'lab', label: 'Лаборатория' },
      { value: 'surveyor', label: 'Сюрвейер / независимый инспектор' },
      { value: 'bank', label: 'Банк / финансовая организация' },
      { value: 'employee', label: 'Сотрудник существующей организации' },
    ],
    orgTypes: [
      { value: 'LEGAL', label: 'Юридическое лицо' },
      { value: 'INDIVIDUAL', label: 'Индивидуальный предприниматель' },
      { value: 'SELF_EMPLOYED', label: 'Самозанятый' },
    ],
  },
  en: {
    participationTitle: '1. Participation format', participationLead: 'Choose how you plan to use the platform. Final permissions are assigned by the server after the application is reviewed.', organizationTitle: '2. Organization details', organizationLead: 'Provide the details required to identify the organization or entrepreneur.', existingOrganizationLead: 'Provide the details of the existing organization you are requesting to join. A new organization will not be created.', applicantTitle: '3. Applicant and access', applicantLead: 'Provide the applicant contact details and set the password for future sign-in.', consentTitle: '4. Terms confirmation', requiredNote: 'Fields marked * are required.', workspace: 'Participation format *', orgType: 'Organization status *', legalName: 'Legal name / entrepreneur name *', inn: 'Tax ID *', innHint: '10 or 12 digits, depending on the entity type.', kpp: 'KPP (if applicable)', kppHint: '9 digits.', ogrn: 'OGRN / OGRNIP (if applicable)', ogrnHint: '13 or 15 digits.', region: 'Region *', fullName: 'Applicant full name *', position: 'Position / status *', phone: 'Phone *', phonePlaceholder: '+7 900 000-00-00', email: 'Email address *', emailPlaceholder: 'name@company.com', password: 'Password *', confirmPassword: 'Repeat password *', passwordHint: '12–128 characters. Use at least three groups: lowercase letters, uppercase letters, digits and symbols. Avoid obvious sequences.', showPassword: 'Show password', hidePassword: 'Hide password', passwordMismatch: 'The passwords do not match.', terms: 'User Agreement', privacy: 'Personal Data Processing Policy', acceptTerms: 'I accept the', acceptPrivacy: 'I have reviewed the', submit: 'Submit registration application', submitting: 'Submitting application…', unavailable: 'Registration is temporarily unavailable. No access was created. Try again later.', invalid: 'Check the required fields and confirmations.', submissionAccepted: 'The application was accepted. If the address can be used for a new registration, a confirmation email will be sent. If an account already exists, use sign in or access recovery.', verifyTitle: 'Email address confirmation', verifyLead: 'Confirming the email address does not open the workspace. The application will be sent for review after confirmation.', verifyButton: 'Confirm email address', verifying: 'Confirming address…', verifyInvalid: 'The link is invalid, expired or has already been used.', statusTitle: 'Registration status', refresh: 'Refresh status', nextAction: 'What to do next', applicationId: 'Application number', status: 'Current status', reason: 'Application comment', unknownStatus: 'Status is being updated', unknownNextAction: 'Wait for updated application information.', supportReference: 'Support reference:', login: 'Sign in', recovery: 'Restore access', resend: 'Resend email', resending: 'Sending email…', resendAccepted: 'If the application is awaiting email confirmation, a new message will be sent.', additionalInformation: 'Response to reviewer request', additionalPlaceholder: 'Provide the requested information and basis where needed. Do not enter passwords, confirmation codes or other secrets.', sendInformation: 'Send clarification', sendingInformation: 'Sending clarification…', informationSent: 'The clarification was saved. The application returned to the review queue.',
    statusLabels: { EMAIL_VERIFICATION_REQUIRED: 'Email confirmation pending', ORGANIZATION_VERIFICATION_PENDING: 'Application under review', ADDITIONAL_INFORMATION_REQUIRED: 'Additional information required', APPROVED: 'Application approved; activation in progress', ACTIVATED: 'Access activated', REJECTED: 'Application rejected', SUSPENDED: 'Application review suspended', EXPIRED: 'Application expired', CANCELLED: 'Application cancelled' },
    nextLabels: { VERIFY_EMAIL: 'Open the message and confirm your email address.', WAIT_FOR_REVIEW: 'Wait for the application decision. Workspace access remains closed.', PROVIDE_ADDITIONAL_INFORMATION: 'Provide the requested additional information.', WAIT_FOR_ACTIVATION: 'Wait for access activation to finish.', LOGIN: 'Sign in with the confirmed account.', CONTACT_SUPPORT: 'When contacting support, provide the reference shown below.', START_NEW_APPLICATION: 'Submit a new registration application.', WAIT: 'Wait for the next status change.' },
    workspaces: [{ value: 'seller', label: 'Agricultural producer / seller' }, { value: 'buyer', label: 'Buyer' }, { value: 'logistics', label: 'Logistics organization' }, { value: 'driver', label: 'Driver' }, { value: 'elevator', label: 'Elevator / grain storage' }, { value: 'lab', label: 'Laboratory' }, { value: 'surveyor', label: 'Surveyor / independent inspector' }, { value: 'bank', label: 'Bank / financial organization' }, { value: 'employee', label: 'Employee of an existing organization' }], orgTypes: [{ value: 'LEGAL', label: 'Legal entity' }, { value: 'INDIVIDUAL', label: 'Sole proprietor' }, { value: 'SELF_EMPLOYED', label: 'Self-employed' }],
  },
  zh: {
    participationTitle: '1. 参与方式', participationLead: '请选择您计划使用平台的方式。最终权限将在申请审核后由服务器分配。', organizationTitle: '2. 组织信息', organizationLead: '请提供用于识别组织或经营者的信息。', existingOrganizationLead: '请提供您申请加入的现有组织信息。系统不会因此创建新组织。', applicantTitle: '3. 申请人和访问权限', applicantLead: '请提供申请人的联系信息，并设置后续登录密码。', consentTitle: '4. 条款确认', requiredNote: '带 * 的字段为必填项。', workspace: '参与方式 *', orgType: '组织类型 *', legalName: '法定名称 / 经营者姓名 *', inn: '税号 *', innHint: '根据主体类型填写 10 位或 12 位数字。', kpp: 'KPP（如适用）', kppHint: '9 位数字。', ogrn: 'OGRN / OGRNIP（如适用）', ogrnHint: '13 位或 15 位数字。', region: '地区 *', fullName: '申请人姓名 *', position: '职位 / 身份 *', phone: '电话 *', phonePlaceholder: '+7 900 000-00-00', email: '电子邮箱 *', emailPlaceholder: 'name@company.cn', password: '密码 *', confirmPassword: '再次输入密码 *', passwordHint: '长度 12–128 个字符，至少包含以下三类：小写字母、大写字母、数字、特殊符号。请避免明显的连续字符。', showPassword: '显示密码', hidePassword: '隐藏密码', passwordMismatch: '两次输入的密码不一致。', terms: '用户协议', privacy: '个人数据处理政策', acceptTerms: '我接受', acceptPrivacy: '我已阅读', submit: '提交注册申请', submitting: '正在提交申请…', unavailable: '注册服务暂时不可用。未创建访问权限。请稍后重试。', invalid: '请检查必填字段和确认项。', submissionAccepted: '申请已受理。如果该地址可用于新注册，系统会发送确认邮件。如果账户已存在，请登录或恢复访问权限。', verifyTitle: '确认电子邮箱', verifyLead: '确认电子邮箱不会直接开放工作区。确认后申请将进入审核。', verifyButton: '确认电子邮箱', verifying: '正在确认…', verifyInvalid: '链接无效、已过期或已被使用。', statusTitle: '注册状态', refresh: '更新状态', nextAction: '下一步', applicationId: '申请编号', status: '当前状态', reason: '申请说明', unknownStatus: '状态正在更新', unknownNextAction: '请等待申请信息更新。', supportReference: '支持编号：', login: '登录', recovery: '恢复访问权限', resend: '重新发送邮件', resending: '正在发送邮件…', resendAccepted: '如果申请正在等待邮箱确认，系统会重新发送邮件。', additionalInformation: '回复审核请求', additionalPlaceholder: '请提供所需信息和依据。不要填写密码、确认码或其他秘密信息。', sendInformation: '提交补充说明', sendingInformation: '正在提交…', informationSent: '补充说明已保存，申请已返回审核队列。',
    statusLabels: { EMAIL_VERIFICATION_REQUIRED: '等待邮箱确认', ORGANIZATION_VERIFICATION_PENDING: '申请审核中', ADDITIONAL_INFORMATION_REQUIRED: '需要补充信息', APPROVED: '申请已批准，正在激活', ACTIVATED: '访问权限已激活', REJECTED: '申请已拒绝', SUSPENDED: '申请审核已暂停', EXPIRED: '申请已过期', CANCELLED: '申请已取消' },
    nextLabels: { VERIFY_EMAIL: '请打开邮件并确认电子邮箱。', WAIT_FOR_REVIEW: '请等待审核结果。工作区访问仍处于关闭状态。', PROVIDE_ADDITIONAL_INFORMATION: '请提供所需补充信息。', WAIT_FOR_ACTIVATION: '请等待访问权限激活完成。', LOGIN: '请使用已确认的账户登录。', CONTACT_SUPPORT: '联系支持时，请提供下方编号。', START_NEW_APPLICATION: '提交新的注册申请。', WAIT: '请等待下一次状态更新。' },
    workspaces: [{ value: 'seller', label: '农业生产者 / 卖方' }, { value: 'buyer', label: '买方' }, { value: 'logistics', label: '物流组织' }, { value: 'driver', label: '司机' }, { value: 'elevator', label: '粮库 / 储粮设施' }, { value: 'lab', label: '实验室' }, { value: 'surveyor', label: '检验员 / 独立检查员' }, { value: 'bank', label: '银行 / 金融机构' }, { value: 'employee', label: '现有组织员工' }], orgTypes: [{ value: 'LEGAL', label: '法人实体' }, { value: 'INDIVIDUAL', label: '个体经营者' }, { value: 'SELF_EMPLOYED', label: '自雇人员' }],
  },
};

function field(form: FormData, name: string) {
  return String(form.get(name) || '').trim();
}

function safeStatusLabel(copy: Copy, code: string) {
  return copy.statusLabels[code] || copy.unknownStatus;
}

function safeNextLabel(copy: Copy, code: string) {
  return copy.nextLabels[code] || copy.unknownNextAction;
}

export function RegisterFormClientOfficial({ locale, verifyToken, initialStatusToken }: { locale: Locale; verifyToken?: string; initialStatusToken?: string }) {
  const copy = COPY[locale];
  const idempotencyKey = React.useRef<string>(globalThis.crypto?.randomUUID?.() || `reg-${Date.now()}-${Math.random()}`);
  const [workspace, setWorkspace] = React.useState('seller');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');
  const [statusToken, setStatusToken] = React.useState(initialStatusToken || '');
  const [status, setStatus] = React.useState<RegistrationStatus | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(Boolean(initialStatusToken));
  const [verificationCompleted, setVerificationCompleted] = React.useState(false);
  const [submissionAccepted, setSubmissionAccepted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');
  const [resendMessage, setResendMessage] = React.useState('');
  const [additionalInformation, setAdditionalInformation] = React.useState('');
  const [informationSubmitting, setInformationSubmitting] = React.useState(false);
  const [informationMessage, setInformationMessage] = React.useState('');
  const [passwordVisible, setPasswordVisible] = React.useState(false);

  const loadStatus = React.useCallback(async (token: string) => {
    if (!token) return;
    setStatusLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/registration/status?token=${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(payload.correlationId || ''));
      if (!response.ok || payload.ok === false) throw new Error('status_failed');
      setStatus(payload);
    } catch {
      setError(copy.unavailable);
    } finally {
      setStatusLoading(false);
    }
  }, [copy.unavailable]);

  React.useEffect(() => {
    if (initialStatusToken) void loadStatus(initialStatusToken);
  }, [initialStatusToken, loadStatus]);

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formElement = event.currentTarget;
    if (!formElement.checkValidity()) {
      formElement.reportValidity();
      setError(copy.invalid);
      return;
    }
    const form = new FormData(formElement);
    if (form.get('acceptTerms') !== 'yes' || form.get('acceptPrivacy') !== 'yes') {
      setError(copy.invalid);
      return;
    }
    const password = field(form, 'password');
    if (password !== field(form, 'confirmPassword')) {
      setError(copy.passwordMismatch);
      return;
    }
    const payload = {
      workspace: field(form, 'workspace'), orgType: field(form, 'orgType'), orgLegalName: field(form, 'orgLegalName'), orgInn: field(form, 'orgInn'),
      orgKpp: field(form, 'orgKpp') || undefined, orgOgrn: field(form, 'orgOgrn') || undefined, region: field(form, 'region'), fullName: field(form, 'fullName'),
      position: field(form, 'position'), phone: field(form, 'phone'), email: field(form, 'email').toLowerCase(), password,
      termsVersion: '2026-07-31', privacyVersion: '2026-07-31', acceptTerms: true, acceptPrivacy: true, locale,
    };
    setSubmitting(true); setError(''); setCorrelationId('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/register', { method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': idempotencyKey.current }), body: JSON.stringify(payload), cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      } finally { window.clearTimeout(timer); }
      const result = await response.json().catch(() => ({} as RegistrationStatus & { accepted?: boolean }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) {
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setSubmittedEmail(payload.email); setSubmissionAccepted(true);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unavailable';
      setError(reason === 'invalid' ? copy.invalid : copy.unavailable);
    } finally { setSubmitting(false); }
  }

  async function resendEmail() {
    if (!submittedEmail || submitting) return;
    setSubmitting(true); setError(''); setResendMessage('');
    try {
      const response = await fetch('/api/auth/registration/resend', { method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: JSON.stringify({ email: submittedEmail, locale }), cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000) });
      const result = await response.json().catch(() => ({} as { accepted?: boolean; correlationId?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) throw new Error('resend_failed');
      setResendMessage(copy.resendAccepted);
    } catch { setError(copy.unavailable); } finally { setSubmitting(false); }
  }

  async function verifyEmail() {
    if (!verifyToken || submitting) return;
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/auth/registration/verify', { method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: JSON.stringify({ token: verifyToken, locale }), cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true || !result.statusToken) throw new Error('verify_failed');
      setVerificationCompleted(true); setStatusToken(result.statusToken); setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=${locale}`);
    } catch { setError(copy.verifyInvalid); } finally { setSubmitting(false); }
  }

  async function submitAdditionalInformation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responseText = additionalInformation.trim();
    if (!statusToken || informationSubmitting || responseText.length < 8) { setError(copy.invalid); return; }
    setInformationSubmitting(true); setError(''); setInformationMessage('');
    try {
      const response = await fetch('/api/auth/registration/additional-information', { method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: JSON.stringify({ statusToken, response: responseText }), cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000) });
      const result = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true) throw new Error('information_failed');
      setAdditionalInformation(''); setInformationMessage(copy.informationSent); setStatus((current) => ({ ...current, ...result, reason: null }));
    } catch { setError(copy.unavailable); } finally { setInformationSubmitting(false); }
  }

  const reference = correlationId || status?.correlationId || '';
  const referenceNode = reference ? <p className='p0-register-reference'><strong>{copy.supportReference}</strong> <span>{reference}</span></p> : null;

  if (verifyToken && !verificationCompleted && !status) {
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-verify-title'>
      <ShieldCheck size={40} aria-hidden='true' /><h2 id='p0-register-verify-title'>{copy.verifyTitle}</h2><p>{copy.verifyLead}</p>
      {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}{referenceNode}
      <button type='button' className='p0-register-primary' onClick={verifyEmail} disabled={submitting} aria-busy={submitting}>{submitting ? copy.verifying : copy.verifyButton}</button>
    </section>;
  }

  if (submissionAccepted) {
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
      <ShieldCheck size={40} aria-hidden='true' /><h2 id='p0-register-status-title'>{copy.statusTitle}</h2><p>{copy.submissionAccepted}</p>
      {resendMessage ? <p role='status'>{resendMessage}</p> : null}{error ? <p className='p0-register-error' role='alert'>{error}</p> : null}{referenceNode}
      <div className='p0-register-actions'><button type='button' className='p0-register-primary' onClick={() => void resendEmail()} disabled={submitting}>{submitting ? copy.resending : copy.resend}</button><a className='p0-register-secondary' href='/platform-v7/login'>{copy.login}</a><a className='p0-register-secondary' href='/platform-v7/forgot-password'>{copy.recovery}</a></div>
    </section>;
  }

  if (statusToken || status) {
    const statusCode = String(status?.status || 'EMAIL_VERIFICATION_REQUIRED');
    const nextCode = String(status?.nextAction || 'VERIFY_EMAIL');
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
      {statusCode === 'ACTIVATED' ? <CheckCircle2 size={40} aria-hidden='true' /> : <ShieldCheck size={40} aria-hidden='true' />}
      <h2 id='p0-register-status-title'>{copy.statusTitle}</h2>
      <dl className='p0-register-status-list'><div><dt>{copy.applicationId}</dt><dd>{status?.applicationId || '—'}</dd></div><div><dt>{copy.status}</dt><dd>{safeStatusLabel(copy, statusCode)}</dd></div><div><dt>{copy.nextAction}</dt><dd>{safeNextLabel(copy, nextCode)}</dd></div>{status?.reason ? <div><dt>{copy.reason}</dt><dd>{status.reason}</dd></div> : null}</dl>
      {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}{informationMessage ? <p role='status'>{informationMessage}</p> : null}{referenceNode}
      {statusCode === 'ADDITIONAL_INFORMATION_REQUIRED' ? <form className='p0-register-additional-form' onSubmit={submitAdditionalInformation}><label><span>{copy.additionalInformation}</span><textarea value={additionalInformation} onChange={(event) => setAdditionalInformation(event.target.value)} minLength={8} maxLength={4000} placeholder={copy.additionalPlaceholder} required disabled={informationSubmitting} /></label><button type='submit' className='p0-register-primary' disabled={informationSubmitting || additionalInformation.trim().length < 8}>{informationSubmitting ? copy.sendingInformation : copy.sendInformation}</button></form> : null}
      <div className='p0-register-actions'><button type='button' className='p0-register-secondary' onClick={() => void loadStatus(statusToken)} disabled={statusLoading || !statusToken}><RefreshCw size={17} aria-hidden='true' />{statusLoading ? '…' : copy.refresh}</button>{statusCode === 'ACTIVATED' ? <a className='p0-register-primary' href='/platform-v7/login'>{copy.login}</a> : null}</div>
    </section>;
  }

  return <form className='p0-register-form' onSubmit={submitRegistration}>
    <p className='p0-register-required-note'>{copy.requiredNote}</p>
    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>{copy.participationTitle}</h2><p>{copy.participationLead}</p></div><div className='p0-register-grid'>
      <label><span>{copy.workspace}</span><select name='workspace' value={workspace} onChange={(event) => setWorkspace(event.target.value)} required>{copy.workspaces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>{copy.orgType}</span><select name='orgType' defaultValue='LEGAL' required>{copy.orgTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div></section>

    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>{copy.organizationTitle}</h2><p>{workspace === 'employee' ? copy.existingOrganizationLead : copy.organizationLead}</p></div><div className='p0-register-grid'>
      <label className='p0-register-wide'><span>{copy.legalName}</span><input name='orgLegalName' minLength={2} maxLength={300} required autoComplete='organization' /></label>
      <label><span>{copy.inn}</span><input name='orgInn' inputMode='numeric' pattern='(?:[0-9]{10}|[0-9]{12})' required aria-describedby='p0-register-inn-hint' /><small id='p0-register-inn-hint'>{copy.innHint}</small></label>
      <label><span>{copy.kpp}</span><input name='orgKpp' inputMode='numeric' pattern='[0-9]{9}' aria-describedby='p0-register-kpp-hint' /><small id='p0-register-kpp-hint'>{copy.kppHint}</small></label>
      <label><span>{copy.ogrn}</span><input name='orgOgrn' inputMode='numeric' pattern='(?:[0-9]{13}|[0-9]{15})' aria-describedby='p0-register-ogrn-hint' /><small id='p0-register-ogrn-hint'>{copy.ogrnHint}</small></label>
      <label><span>{copy.region}</span><input name='region' minLength={2} maxLength={160} required autoComplete='address-level1' /></label>
    </div></section>

    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>{copy.applicantTitle}</h2><p>{copy.applicantLead}</p></div><div className='p0-register-grid'>
      <label><span>{copy.fullName}</span><input name='fullName' minLength={2} maxLength={200} required autoComplete='name' /></label>
      <label><span>{copy.position}</span><input name='position' minLength={2} maxLength={200} required autoComplete='organization-title' /></label>
      <label><span>{copy.phone}</span><input name='phone' type='tel' minLength={7} maxLength={24} pattern='\+?[0-9()\-\s]{7,24}' required autoComplete='tel' placeholder={copy.phonePlaceholder} /></label>
      <label><span>{copy.email}</span><input name='email' type='email' maxLength={254} required autoComplete='email' autoCapitalize='none' spellCheck={false} placeholder={copy.emailPlaceholder} /></label>
      <label className='p0-register-wide'><span>{copy.password}</span><div className='p0-register-password-control'><input name='password' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' aria-describedby='p0-register-password-hint' /><button type='button' className='p0-register-password-toggle' onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? copy.hidePassword : copy.showPassword} title={passwordVisible ? copy.hidePassword : copy.showPassword}>{passwordVisible ? <EyeOff size={18} aria-hidden='true' /> : <Eye size={18} aria-hidden='true' />}</button></div><small id='p0-register-password-hint'>{copy.passwordHint}</small></label>
      <label className='p0-register-wide'><span>{copy.confirmPassword}</span><div className='p0-register-password-control'><input name='confirmPassword' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' /><span className='p0-register-password-spacer' aria-hidden='true' /></div></label>
    </div></section>

    <section className='p0-register-card p0-register-consents'><div className='p0-register-section-heading'><h2>{copy.consentTitle}</h2></div><label><input name='acceptTerms' type='checkbox' value='yes' required /><span>{copy.acceptTerms} <a href='/platform-v7/terms' target='_blank' rel='noreferrer'>{copy.terms}</a>.</span></label><label><input name='acceptPrivacy' type='checkbox' value='yes' required /><span>{copy.acceptPrivacy} <a href='/platform-v7/privacy' target='_blank' rel='noreferrer'>{copy.privacy}</a>.</span></label></section>

    {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
    <button className='p0-register-primary p0-register-submit' type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? copy.submitting : copy.submit}</button>
    <div className='p0-register-help-links'><a href='/platform-v7/login'>{copy.login}</a><a href='/platform-v7/forgot-password'>{copy.recovery}</a></div>
  </form>;
}
