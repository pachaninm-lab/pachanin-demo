import '@/styles/platform-v7-public-register.css';
import '@/styles/platform-v7-public-register-official.css';
import '@/styles/platform-v7-public-register-reflow.css';
import '@/styles/platform-v7-canonical-public-v1.css';
import { CanonicalBottomNav, CanonicalPublicHeader } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { RegisterFormClientPublic } from './RegisterFormClientPublic';

type Locale = 'ru' | 'en' | 'zh';
type RegisterSearchParams = Record<string, string | string[] | undefined>;
type PublicRegistrationIntent = 'sell' | 'buy' | 'execution' | 'finance';
type PublicWorkspace = 'seller' | 'buyer' | 'logistics' | 'bank';

const WORKSPACE_BY_INTENT: Record<PublicRegistrationIntent, PublicWorkspace> = {
  sell: 'seller',
  buy: 'buyer',
  execution: 'logistics',
  finance: 'bank',
};

const PAGE_COPY = {
  ru: {
    nav: 'Навигация страницы регистрации',
    login: 'Войти',
    home: 'На главную',
    language: 'Сменить язык',
    kicker: 'Регистрация на платформе',
    title: 'Регистрация организации и пользователя',
    lead: 'Укажите достоверные сведения об организации и заявителе. После отправки заявки подтвердите адрес электронной почты и дождитесь результата проверки. Выберите предполагаемый формат участия — права доступа предоставляются только после проверки и одобрения заявки.',
  },
  en: {
    nav: 'Registration page navigation',
    login: 'Sign in',
    home: 'Home',
    language: 'Change language',
    kicker: 'Platform registration',
    title: 'Organization and user registration',
    lead: 'Provide accurate organization and applicant details. After submitting the application, confirm the email address and wait for the review result. Select the intended participation type; access rights are granted only after the application has been reviewed and approved.',
  },
  zh: {
    nav: '注册页面导航',
    login: '登录',
    home: '首页',
    language: '切换语言',
    kicker: '平台注册',
    title: '组织和用户注册',
    lead: '请填写真实、准确的组织和申请人信息。提交申请后，请确认电子邮箱并等待审核结果。请选择计划参与的平台身份；访问权限仅在申请审核并获批准后授予。',
  },
} satisfies Record<Locale, Record<string, string>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localeFrom(value: string | undefined): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function registrationIntent(value: string | undefined): PublicRegistrationIntent | null {
  return value === 'sell' || value === 'buy' || value === 'execution' || value === 'finance' ? value : null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<RegisterSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const locale = localeFrom(first(params.lang));
  const verifyToken = String(first(params.verify) || '').trim().slice(0, 512);
  const statusToken = String(first(params.statusToken) || '').trim().slice(0, 512);
  const intent = registrationIntent(first(params.intent));
  const initialWorkspace = intent ? WORKSPACE_BY_INTENT[intent] : undefined;
  const copy = PAGE_COPY[locale];
  return (
    <main className='p0-register-page'>
      <div className='p0-register-shell'>
        <CanonicalPublicHeader locale={locale} activePath='/platform-v7/register' />

        <section className='p0-register-hero' aria-labelledby='p0-register-title'>
          <small>{copy.kicker}</small>
          <h1 id='p0-register-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </section>

        <RegisterFormClientPublic
          locale={locale}
          verifyToken={verifyToken || undefined}
          initialStatusToken={statusToken || undefined}
          initialWorkspace={initialWorkspace}
        />
      </div>
      <CanonicalBottomNav locale={locale} active='/platform-v7/register' />
    </main>
  );
}
