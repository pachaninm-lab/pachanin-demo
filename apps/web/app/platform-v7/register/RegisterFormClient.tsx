'use client';

import * as React from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { applyCsrfHeader } from '@/lib/csrf';

type Locale = 'ru' | 'en' | 'zh';

type RegistrationStatus = {
  applicationId?: string;
  status?: string;
  nextAction?: string;
  submittedAt?: string;
  updatedAt?: string;
  reason?: string | null;
  version?: string;
  correlationId?: string;
  statusToken?: string;
};

type Copy = {
  requiredNote: string;
  participationSection: string;
  participationLead: string;
  organizationSection: string;
  organizationLead: string;
  applicantSection: string;
  applicantLead: string;
  consentSection: string;
  consentLead: string;
  workspace: string;
  orgType: string;
  legalName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  region: string;
  fullName: string;
  position: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  passwordHint: string;
  passwordMismatch: string;
  showPassword: string;
  hidePassword: string;
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
  reference: string;
  statusUpdating: string;
  waitForUpdate: string;
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
    requiredNote: 'Поля со знаком * обязательны для заполнения.',
    participationSection: 'Формат участия',
    participationLead: 'Выберите предполагаемый формат участия. Права доступа и доступные действия будут определены после проверки и одобрения заявки.',
    organizationSection: 'Сведения об организации',
    organizationLead: 'Укажите сведения, по которым можно однозначно идентифицировать организацию или предпринимателя.',
    applicantSection: 'Заявитель и доступ',
    applicantLead: 'Укажите данные заявителя и задайте пароль для последующего входа в личный кабинет.',
    consentSection: 'Подтверждение условий',
    consentLead: 'Перед отправкой проверьте сведения. Они будут использованы для рассмотрения заявки и предоставления доступа.',
    workspace: 'Формат участия',
    orgType: 'Правовой статус',
    legalName: 'Наименование организации / ФИО предпринимателя',
    inn: 'ИНН',
    kpp: 'КПП (при наличии)',
    ogrn: 'ОГРН / ОГРНИП (при наличии)',
    region: 'Регион',
    fullName: 'ФИО заявителя',
    position: 'Должность или статус',
    phone: 'Телефон',
    email: 'Адрес электронной почты',
    password: 'Пароль',
    confirmPassword: 'Повторите пароль',
    passwordHint: '12–128 символов. Используйте как минимум три группы: строчные буквы, прописные буквы, цифры, специальные знаки.',
    passwordMismatch: 'Пароли не совпадают. Введите одинаковый пароль в обоих полях.',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    terms: 'Пользовательского соглашения',
    privacy: 'Политикой обработки персональных данных',
    acceptTerms: 'Я принимаю условия',
    acceptPrivacy: 'Я ознакомлен(а) с',
    submit: 'Отправить заявку на регистрацию',
    submitting: 'Заявка отправляется…',
    unavailable: 'Сейчас не удалось выполнить действие. Повторите попытку позднее.',
    invalid: 'Заполните обязательные поля и проверьте введённые данные.',
    submissionAccepted: 'На указанный адрес будет направлено письмо, если он может быть использован для регистрации. Если учётная запись уже существует, воспользуйтесь входом или восстановлением доступа.',
    verifyTitle: 'Подтверждение электронной почты',
    verifyLead: 'После подтверждения адреса заявка будет направлена на проверку. Доступ к личному кабинету предоставляется только после одобрения и активации заявки.',
    verifyButton: 'Подтвердить адрес электронной почты',
    verifying: 'Адрес подтверждается…',
    verifyInvalid: 'Ссылка недействительна, срок её действия истёк или она уже была использована.',
    statusTitle: 'Статус регистрации',
    refresh: 'Обновить статус',
    nextAction: 'Следующий шаг',
    applicationId: 'Номер заявки',
    status: 'Статус',
    reason: 'Комментарий по заявке',
    reference: 'Номер обращения',
    statusUpdating: 'Информация по заявке обновляется',
    waitForUpdate: 'Ожидайте обновления информации по заявке.',
    login: 'Войти',
    recovery: 'Восстановить доступ',
    resend: 'Отправить письмо повторно',
    resending: 'Письмо отправляется…',
    resendAccepted: 'Если заявка ожидает подтверждения электронной почты, мы направим новое письмо на указанный адрес.',
    additionalInformation: 'Дополнительные сведения',
    additionalPlaceholder: 'Введите сведения, которые были запрошены. Не указывайте пароль, коды подтверждения и другие секретные данные.',
    sendInformation: 'Отправить сведения',
    sendingInformation: 'Сведения отправляются…',
    informationSent: 'Дополнительные сведения сохранены. Заявка снова направлена на проверку.',
    statusLabels: {
      EMAIL_VERIFICATION_REQUIRED: 'Ожидается подтверждение электронной почты',
      ORGANIZATION_VERIFICATION_PENDING: 'Заявка находится на проверке',
      ADDITIONAL_INFORMATION_REQUIRED: 'Нужны дополнительные сведения',
      APPROVED: 'Заявка одобрена. Доступ активируется',
      ACTIVATED: 'Доступ активирован',
      REJECTED: 'Заявка отклонена',
      SUSPENDED: 'Рассмотрение заявки приостановлено',
      EXPIRED: 'Срок действия заявки истёк',
      CANCELLED: 'Заявка отменена',
    },
    nextLabels: {
      VERIFY_EMAIL: 'Откройте письмо и подтвердите адрес электронной почты.',
      WAIT_FOR_REVIEW: 'Ожидайте результата проверки заявки.',
      PROVIDE_ADDITIONAL_INFORMATION: 'Предоставьте запрошенные дополнительные сведения.',
      WAIT_FOR_ACTIVATION: 'Ожидайте завершения активации доступа.',
      LOGIN: 'Войдите в личный кабинет с подтверждённой учётной записью.',
      CONTACT_SUPPORT: 'При обращении в поддержку сообщите номер обращения, указанный ниже.',
      START_NEW_APPLICATION: 'Подайте новую заявку на регистрацию.',
      WAIT: 'Ожидайте обновления информации по заявке.',
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
    requiredNote: 'Fields marked * are required.',
    participationSection: 'Participation type',
    participationLead: 'Select the intended participation type. Access rights and available actions are determined only after the application has been reviewed and approved.',
    organizationSection: 'Organization details',
    organizationLead: 'Provide the details needed to identify the organization or sole proprietor.',
    applicantSection: 'Applicant and access',
    applicantLead: 'Provide the applicant details and create a password for subsequent sign-in.',
    consentSection: 'Terms and privacy',
    consentLead: 'Review the information before submitting. It will be used to review the application and provide access.',
    workspace: 'Participation type',
    orgType: 'Legal status',
    legalName: 'Organization legal name / proprietor full name',
    inn: 'Tax ID (INN)',
    kpp: 'KPP (if applicable)',
    ogrn: 'OGRN / OGRNIP (if applicable)',
    region: 'Region',
    fullName: 'Applicant full name',
    position: 'Position or status',
    phone: 'Phone',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    passwordHint: '12–128 characters. Use at least three groups: lowercase letters, uppercase letters, digits and special characters.',
    passwordMismatch: 'The passwords do not match. Enter the same password in both fields.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    terms: 'User Agreement',
    privacy: 'Personal Data Processing Policy',
    acceptTerms: 'I accept the',
    acceptPrivacy: 'I have read the',
    submit: 'Submit registration application',
    submitting: 'Submitting application…',
    unavailable: 'The requested action is temporarily unavailable. Please try again later.',
    invalid: 'Complete the required fields and check the entered information.',
    submissionAccepted: 'An email will be sent to the address provided if it can be used for registration. If an account already exists, use sign in or access recovery.',
    verifyTitle: 'Email confirmation',
    verifyLead: 'After the email address is confirmed, the application will be sent for review. Account access is provided only after the application has been approved and activated.',
    verifyButton: 'Confirm email address',
    verifying: 'Confirming address…',
    verifyInvalid: 'The link is invalid, has expired or has already been used.',
    statusTitle: 'Registration status',
    refresh: 'Refresh status',
    nextAction: 'Next step',
    applicationId: 'Application number',
    status: 'Status',
    reason: 'Application comment',
    reference: 'Request reference',
    statusUpdating: 'Application information is being updated',
    waitForUpdate: 'Wait for updated application information.',
    login: 'Sign in',
    recovery: 'Restore access',
    resend: 'Resend email',
    resending: 'Sending email…',
    resendAccepted: 'If the application is awaiting email confirmation, a new email will be sent to the address provided.',
    additionalInformation: 'Additional information',
    additionalPlaceholder: 'Enter the requested information. Do not include passwords, verification codes or other secret data.',
    sendInformation: 'Send information',
    sendingInformation: 'Sending information…',
    informationSent: 'The additional information was saved. The application has been returned for review.',
    statusLabels: {
      EMAIL_VERIFICATION_REQUIRED: 'Email confirmation pending',
      ORGANIZATION_VERIFICATION_PENDING: 'Application under review',
      ADDITIONAL_INFORMATION_REQUIRED: 'Additional information required',
      APPROVED: 'Application approved. Access is being activated',
      ACTIVATED: 'Access activated',
      REJECTED: 'Application rejected',
      SUSPENDED: 'Application review suspended',
      EXPIRED: 'Application expired',
      CANCELLED: 'Application cancelled',
    },
    nextLabels: {
      VERIFY_EMAIL: 'Open the email and confirm your email address.',
      WAIT_FOR_REVIEW: 'Wait for the application review result.',
      PROVIDE_ADDITIONAL_INFORMATION: 'Provide the requested additional information.',
      WAIT_FOR_ACTIVATION: 'Wait for access activation to finish.',
      LOGIN: 'Sign in with the confirmed account.',
      CONTACT_SUPPORT: 'Provide the request reference shown below when contacting support.',
      START_NEW_APPLICATION: 'Submit a new registration application.',
      WAIT: 'Wait for updated application information.',
    },
    workspaces: [
      { value: 'seller', label: 'Agricultural producer / seller' },
      { value: 'buyer', label: 'Buyer' },
      { value: 'logistics', label: 'Logistics organization' },
      { value: 'driver', label: 'Driver' },
      { value: 'elevator', label: 'Elevator / grain storage facility' },
      { value: 'lab', label: 'Laboratory' },
      { value: 'surveyor', label: 'Surveyor / independent inspector' },
      { value: 'bank', label: 'Bank / financial organization' },
      { value: 'employee', label: 'Employee of an existing organization' },
    ],
    orgTypes: [
      { value: 'LEGAL', label: 'Legal entity' },
      { value: 'INDIVIDUAL', label: 'Sole proprietor' },
      { value: 'SELF_EMPLOYED', label: 'Self-employed' },
    ],
  },
  zh: {
    requiredNote: '标有 * 的字段为必填项。',
    participationSection: '参与方式',
    participationLead: '请选择计划参与的平台身份。访问权限和可执行操作仅在申请审核并获批准后确定。',
    organizationSection: '组织信息',
    organizationLead: '请填写能够准确识别组织或个体经营者的信息。',
    applicantSection: '申请人与访问设置',
    applicantLead: '请填写申请人信息，并设置后续登录所需的密码。',
    consentSection: '条款与个人信息',
    consentLead: '提交前请核对信息。所填信息将用于审核申请并授予访问权限。',
    workspace: '参与方式',
    orgType: '法律身份',
    legalName: '组织法定名称 / 经营者姓名',
    inn: '税号（INN）',
    kpp: 'KPP（如适用）',
    ogrn: 'OGRN / OGRNIP（如适用）',
    region: '地区',
    fullName: '申请人姓名',
    position: '职务或身份',
    phone: '电话',
    email: '电子邮箱',
    password: '密码',
    confirmPassword: '再次输入密码',
    passwordHint: '12–128 个字符。至少使用以下三类字符：小写字母、大写字母、数字、特殊符号。',
    passwordMismatch: '两次输入的密码不一致。请在两个字段中输入相同的密码。',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    terms: '用户协议',
    privacy: '个人信息处理政策',
    acceptTerms: '我接受',
    acceptPrivacy: '我已阅读',
    submit: '提交注册申请',
    submitting: '正在提交申请…',
    unavailable: '当前无法完成该操作。请稍后重试。',
    invalid: '请填写必填项并检查所填信息。',
    submissionAccepted: '如果该电子邮箱可用于注册，我们会向该地址发送确认邮件。如果账户已存在，请直接登录或恢复访问权限。',
    verifyTitle: '确认电子邮箱',
    verifyLead: '确认电子邮箱后，申请将进入审核。只有在申请获批准并完成激活后，才会提供账户访问权限。',
    verifyButton: '确认电子邮箱',
    verifying: '正在确认邮箱…',
    verifyInvalid: '链接无效、已过期或已被使用。',
    statusTitle: '注册状态',
    refresh: '更新状态',
    nextAction: '下一步',
    applicationId: '申请编号',
    status: '状态',
    reason: '申请说明',
    reference: '申请查询编号',
    statusUpdating: '申请信息正在更新',
    waitForUpdate: '请等待申请信息更新。',
    login: '登录',
    recovery: '恢复访问权限',
    resend: '重新发送邮件',
    resending: '正在发送邮件…',
    resendAccepted: '如果申请正在等待邮箱确认，我们会向所填地址重新发送邮件。',
    additionalInformation: '补充信息',
    additionalPlaceholder: '请填写要求补充的信息。不要填写密码、验证码或其他秘密信息。',
    sendInformation: '提交补充信息',
    sendingInformation: '正在提交补充信息…',
    informationSent: '补充信息已保存，申请已重新进入审核。',
    statusLabels: {
      EMAIL_VERIFICATION_REQUIRED: '等待确认电子邮箱',
      ORGANIZATION_VERIFICATION_PENDING: '申请正在审核',
      ADDITIONAL_INFORMATION_REQUIRED: '需要补充信息',
      APPROVED: '申请已批准，正在激活访问权限',
      ACTIVATED: '访问权限已激活',
      REJECTED: '申请已拒绝',
      SUSPENDED: '申请审核已暂停',
      EXPIRED: '申请已过期',
      CANCELLED: '申请已取消',
    },
    nextLabels: {
      VERIFY_EMAIL: '打开邮件并确认电子邮箱。',
      WAIT_FOR_REVIEW: '等待申请审核结果。',
      PROVIDE_ADDITIONAL_INFORMATION: '提交要求补充的信息。',
      WAIT_FOR_ACTIVATION: '等待访问权限激活完成。',
      LOGIN: '使用已确认的账户登录。',
      CONTACT_SUPPORT: '联系支持时，请提供下方显示的申请查询编号。',
      START_NEW_APPLICATION: '重新提交注册申请。',
      WAIT: '请等待申请信息更新。',
    },
    workspaces: [
      { value: 'seller', label: '农业生产者 / 卖方' },
      { value: 'buyer', label: '买方' },
      { value: 'logistics', label: '物流组织' },
      { value: 'driver', label: '司机' },
      { value: 'elevator', label: '粮库 / 粮食仓储设施' },
      { value: 'lab', label: '实验室' },
      { value: 'surveyor', label: '检验员 / 独立检查员' },
      { value: 'bank', label: '银行 / 金融机构' },
      { value: 'employee', label: '现有组织员工' },
    ],
    orgTypes: [
      { value: 'LEGAL', label: '法人实体' },
      { value: 'INDIVIDUAL', label: '个体经营者' },
      { value: 'SELF_EMPLOYED', label: '自雇人员' },
    ],
  },
};

function field(form: FormData, name: string) {
  return String(form.get(name) || '').trim();
}

export function RegisterFormClient({
  locale,
  verifyToken,
  initialStatusToken,
}: {
  locale: Locale;
  verifyToken?: string;
  initialStatusToken?: string;
}) {
  const copy = COPY[locale];
  const idempotencyKey = React.useRef<string>(globalThis.crypto?.randomUUID?.() || `reg-${Date.now()}-${Math.random()}`);
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
      const response = await fetch(`/api/auth/registration/status?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => ({} as RegistrationStatus & { code?: string }));
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
    const element = event.currentTarget;
    if (!element.checkValidity()) {
      element.reportValidity();
      setError(copy.invalid);
      return;
    }
    const form = new FormData(element);
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
      workspace: field(form, 'workspace'),
      orgType: field(form, 'orgType'),
      orgLegalName: field(form, 'orgLegalName'),
      orgInn: field(form, 'orgInn'),
      orgKpp: field(form, 'orgKpp') || undefined,
      orgOgrn: field(form, 'orgOgrn') || undefined,
      region: field(form, 'region'),
      fullName: field(form, 'fullName'),
      position: field(form, 'position'),
      phone: field(form, 'phone'),
      email: field(form, 'email').toLowerCase(),
      password,
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
      locale,
    };

    setSubmitting(true);
    setError('');
    setCorrelationId('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: applyCsrfHeader({
            'Content-Type': 'application/json',
            'idempotency-key': idempotencyKey.current,
          }),
          body: JSON.stringify(payload),
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      const result = await response.json().catch(() => ({} as RegistrationStatus & { accepted?: boolean; code?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) {
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setSubmittedEmail(payload.email);
      setSubmissionAccepted(true);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unavailable';
      setError(reason === 'invalid' ? copy.invalid : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendEmail() {
    if (!submittedEmail || submitting) return;
    setSubmitting(true);
    setError('');
    setResendMessage('');
    try {
      const response = await fetch('/api/auth/registration/resend', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: submittedEmail, locale }),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({} as { accepted?: boolean; correlationId?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) throw new Error('resend_failed');
      setResendMessage(copy.resendAccepted);
    } catch {
      setError(copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyEmail() {
    if (!verifyToken || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/registration/verify', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: verifyToken, locale }),
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const result = await response.json().catch(() => ({} as RegistrationStatus & { ok?: boolean; code?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true || !result.statusToken) throw new Error('verify_failed');
      setVerificationCompleted(true);
      setStatusToken(result.statusToken);
      setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=${locale}`);
    } catch {
      setError(copy.verifyInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdditionalInformation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responseText = additionalInformation.trim();
    if (!statusToken || informationSubmitting || responseText.length < 8) {
      setError(copy.invalid);
      return;
    }
    setInformationSubmitting(true);
    setError('');
    setInformationMessage('');
    try {
      const response = await fetch('/api/auth/registration/additional-information', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ statusToken, response: responseText }),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({} as RegistrationStatus & { ok?: boolean }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true) throw new Error('information_failed');
      setAdditionalInformation('');
      setInformationMessage(copy.informationSent);
      setStatus((current) => ({ ...current, ...result, reason: null }));
    } catch {
      setError(copy.unavailable);
    } finally {
      setInformationSubmitting(false);
    }
  }

  const reference = correlationId || status?.correlationId || '';

  if (verifyToken && !verificationCompleted && !status) {
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-verify-title'>
        <ShieldCheck size={40} aria-hidden='true' />
        <h2 id='p0-register-verify-title'>{copy.verifyTitle}</h2>
        <p>{copy.verifyLead}</p>
        {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
        {reference ? <p className='p0-register-correlation'><strong>{copy.reference}:</strong> {reference}</p> : null}
        <button type='button' className='p0-register-primary' onClick={verifyEmail} disabled={submitting} aria-busy={submitting}>
          {submitting ? copy.verifying : copy.verifyButton}
        </button>
      </section>
    );
  }

  if (submissionAccepted) {
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
        <ShieldCheck size={40} aria-hidden='true' />
        <h2 id='p0-register-status-title'>{copy.statusTitle}</h2>
        <p>{copy.submissionAccepted}</p>
        {resendMessage ? <p role='status'>{resendMessage}</p> : null}
        {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
        {reference ? <p className='p0-register-correlation'><strong>{copy.reference}:</strong> {reference}</p> : null}
        <div className='p0-register-actions'>
          <button type='button' className='p0-register-secondary' onClick={() => void resendEmail()} disabled={submitting}>
            {submitting ? copy.resending : copy.resend}
          </button>
          <a className='p0-register-secondary' href='/platform-v7/login'>{copy.login}</a>
          <a className='p0-register-primary' href='/platform-v7/forgot-password'>{copy.recovery}</a>
        </div>
      </section>
    );
  }

  if (statusToken || status) {
    const statusCode = String(status?.status || 'EMAIL_VERIFICATION_REQUIRED');
    const nextCode = String(status?.nextAction || 'VERIFY_EMAIL');
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
        {statusCode === 'ACTIVATED' ? <CheckCircle2 size={40} aria-hidden='true' /> : <ShieldCheck size={40} aria-hidden='true' />}
        <h2 id='p0-register-status-title'>{copy.statusTitle}</h2>
        <dl className='p0-register-status-list'>
          <div><dt>{copy.applicationId}</dt><dd>{status?.applicationId || '—'}</dd></div>
          <div><dt>{copy.status}</dt><dd>{copy.statusLabels[statusCode] || copy.statusUpdating}</dd></div>
          <div><dt>{copy.nextAction}</dt><dd>{copy.nextLabels[nextCode] || copy.waitForUpdate}</dd></div>
          {status?.reason ? <div><dt>{copy.reason}</dt><dd>{status.reason}</dd></div> : null}
        </dl>
        {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
        {informationMessage ? <p role='status'>{informationMessage}</p> : null}
        {reference ? <p className='p0-register-correlation'><strong>{copy.reference}:</strong> {reference}</p> : null}
        {statusCode === 'ADDITIONAL_INFORMATION_REQUIRED' ? (
          <form className='p0-register-additional-form' onSubmit={submitAdditionalInformation}>
            <label>
              <span>{copy.additionalInformation}</span>
              <textarea
                value={additionalInformation}
                onChange={(event) => setAdditionalInformation(event.target.value)}
                minLength={8}
                maxLength={4000}
                placeholder={copy.additionalPlaceholder}
                required
                disabled={informationSubmitting}
              />
            </label>
            <button type='submit' className='p0-register-primary' disabled={informationSubmitting || additionalInformation.trim().length < 8}>
              {informationSubmitting ? copy.sendingInformation : copy.sendInformation}
            </button>
          </form>
        ) : null}
        <div className='p0-register-actions'>
          <button type='button' className='p0-register-secondary' onClick={() => void loadStatus(statusToken)} disabled={statusLoading || !statusToken}>
            <RefreshCw size={17} aria-hidden='true' />{statusLoading ? '…' : copy.refresh}
          </button>
          {statusCode === 'ACTIVATED' ? <a className='p0-register-primary' href='/platform-v7/login'>{copy.login}</a> : null}
        </div>
      </section>
    );
  }

  return (
    <form className='p0-register-form' onSubmit={submitRegistration}>
      <p className='p0-register-required-note'>{copy.requiredNote}</p>

      <section className='p0-register-card'>
        <div className='p0-register-section-heading'><h2>1. {copy.participationSection}</h2><p>{copy.participationLead}</p></div>
        <div className='p0-register-grid'>
          <label><span>{copy.workspace} *</span><select name='workspace' defaultValue='seller' required>{copy.workspaces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>{copy.orgType} *</span><select name='orgType' defaultValue='LEGAL' required>{copy.orgTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
      </section>

      <section className='p0-register-card'>
        <div className='p0-register-section-heading'><h2>2. {copy.organizationSection}</h2><p>{copy.organizationLead}</p></div>
        <div className='p0-register-grid'>
          <label className='p0-register-wide'><span>{copy.legalName} *</span><input name='orgLegalName' minLength={2} maxLength={300} required autoComplete='organization' /></label>
          <label><span>{copy.inn} *</span><input name='orgInn' inputMode='numeric' pattern='(?:[0-9]{10}|[0-9]{12})' required /></label>
          <label><span>{copy.kpp}</span><input name='orgKpp' inputMode='numeric' pattern='[0-9]{9}' /></label>
          <label><span>{copy.ogrn}</span><input name='orgOgrn' inputMode='numeric' pattern='(?:[0-9]{13}|[0-9]{15})' /></label>
          <label><span>{copy.region} *</span><input name='region' minLength={2} maxLength={160} required autoComplete='address-level1' /></label>
        </div>
      </section>

      <section className='p0-register-card'>
        <div className='p0-register-section-heading'><h2>3. {copy.applicantSection}</h2><p>{copy.applicantLead}</p></div>
        <div className='p0-register-grid'>
          <label><span>{copy.fullName} *</span><input name='fullName' minLength={2} maxLength={200} required autoComplete='name' /></label>
          <label><span>{copy.position} *</span><input name='position' minLength={2} maxLength={200} required autoComplete='organization-title' /></label>
          <label><span>{copy.phone} *</span><input name='phone' type='tel' minLength={7} maxLength={24} pattern='\+?[0-9()\-\s]{7,24}' required autoComplete='tel' /></label>
          <label><span>{copy.email} *</span><input name='email' type='email' maxLength={254} required autoComplete='email' autoCapitalize='none' spellCheck={false} /></label>
          <label className='p0-register-wide'><span>{copy.password} *</span><div className='p0-register-password-control'><input name='password' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' aria-describedby='p0-register-password-hint' /><button type='button' className='p0-register-password-toggle' onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? copy.hidePassword : copy.showPassword} title={passwordVisible ? copy.hidePassword : copy.showPassword}>{passwordVisible ? <EyeOff size={18} aria-hidden='true' /> : <Eye size={18} aria-hidden='true' />}</button></div><small id='p0-register-password-hint'>{copy.passwordHint}</small></label>
          <label className='p0-register-wide'><span>{copy.confirmPassword} *</span><input name='confirmPassword' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' /></label>
        </div>
      </section>

      <section className='p0-register-card p0-register-consents'>
        <div className='p0-register-section-heading'><h2>4. {copy.consentSection}</h2><p>{copy.consentLead}</p></div>
        <label><input name='acceptTerms' type='checkbox' value='yes' required /><span>{copy.acceptTerms} <a href='/platform-v7/terms' target='_blank' rel='noreferrer'>{copy.terms}</a>.</span></label>
        <label><input name='acceptPrivacy' type='checkbox' value='yes' required /><span>{copy.acceptPrivacy} <a href='/platform-v7/privacy' target='_blank' rel='noreferrer'>{copy.privacy}</a>.</span></label>
      </section>

      {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
      {reference ? <p className='p0-register-correlation'><strong>{copy.reference}:</strong> {reference}</p> : null}
      <button className='p0-register-primary p0-register-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.submitting : copy.submit}
      </button>
      <div className='p0-register-help-links'>
        <a href='/platform-v7/login'>{copy.login}</a>
        <a href='/platform-v7/forgot-password'>{copy.recovery}</a>
      </div>
    </form>
  );
}
