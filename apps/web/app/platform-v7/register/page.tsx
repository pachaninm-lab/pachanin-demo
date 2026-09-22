import '@/styles/platform-v7-public-register.css';
import '@/styles/platform-v7-public-register-official.css';
import '@/styles/platform-v7-public-register-reflow.css';
import '@/styles/platform-v7-canonical-public-v1.css';
import '@/styles/platform-v7-public-market.css';
import { CanonicalBottomNav, CanonicalPublicHeader } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { marketHref, publicMarketContext, publicMarketRegistrationContext, type PublicCrop } from '@/lib/platform-v7/public-market-navigation';
import { RegisterFormClientPublic } from './RegisterFormClientPublic';

type Locale = 'ru' | 'en' | 'zh';
type RegisterSearchParams = Record<string, string | string[] | undefined>;
type PublicRegistrationIntent = 'sell' | 'buy' | 'execution' | 'finance';
type PublicWorkspace = 'seller' | 'buyer' | 'logistics' | 'bank';
const WORKSPACE_BY_INTENT: Record<PublicRegistrationIntent, PublicWorkspace> = {
  sell: 'seller', buy: 'buyer', execution: 'logistics', finance: 'bank',
};
const PAGE_COPY = {
  ru: {
    nav: 'Навигация страницы подключения', login: 'Войти', home: 'На главную', language: 'Сменить язык',
    kicker: 'Заявка на подключение', title: 'Подключение организации',
    lead: 'Укажите данные организации и контакт для связи. После проверки заявки мы сообщим о доступе. После отправки потребуется подтвердить адрес электронной почты.',
    selection: 'Ваш выбор на рынке', buy: 'Купить', sell: 'Продать', back: 'Вернуться на рынок',
    backOffer: 'Вернуться к предложению', contextNote: 'Выбор сохранён для навигации. Доступ к торгам предоставляется после проверки заявки.',
  },
  en: {
    nav: 'Application page navigation', login: 'Sign in', home: 'Home', language: 'Change language',
    kicker: 'Apply for platform access', title: 'Connect your organisation',
    lead: 'Enter your organisation details and a contact. We will let you know about access after reviewing your application. You will need to confirm your email address after submitting it.',
    selection: 'Your market selection', buy: 'Buy', sell: 'Sell', back: 'Back to market',
    backOffer: 'Back to the offer', contextNote: 'Your selection is kept for navigation. Trading access is granted after your application is reviewed.',
  },
  zh: {
    nav: '接入申请页面导航', login: '登录', home: '首页', language: '切换语言',
    kicker: '申请接入平台', title: '机构接入',
    lead: '请填写机构信息及联系方式。审核申请后，我们会通知您访问权限的情况。提交申请后，您需要确认电子邮箱。',
    selection: '您在市场中的选择', buy: '采购', sell: '销售', back: '返回市场',
    backOffer: '返回所选供求信息', contextNote: '您的选择仅用于页面导航。申请审核通过后才会开放交易权限。',
  },
} satisfies Record<Locale, Record<string, string>>;
const CROP_LABELS: Record<Locale, Record<PublicCrop, string>> = {
  ru: {wheat:'Пшеница',barley:'Ячмень',corn:'Кукуруза',sunflower:'Подсолнечник',soybean:'Соя',rapeseed:'Рапс',rye:'Рожь',oats:'Овёс'},
  en: {wheat:'Wheat',barley:'Barley',corn:'Corn',sunflower:'Sunflower',soybean:'Soybean',rapeseed:'Rapeseed',rye:'Rye',oats:'Oats'},
  zh: {wheat:'小麦',barley:'大麦',corn:'玉米',sunflower:'向日葵',soybean:'大豆',rapeseed:'油菜籽',rye:'黑麦',oats:'燕麦'},
};
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function localeFrom(value: string | undefined): Locale { return value === 'en' || value === 'zh' ? value : 'ru'; }
function registrationIntent(value: string | undefined): PublicRegistrationIntent | null {
  return value === 'sell' || value === 'buy' || value === 'execution' || value === 'finance' ? value : null;
}

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<RegisterSearchParams> }) {
  const params = (await searchParams) ?? {};
  const locale = localeFrom(first(params.lang));
  const verifyToken = String(first(params.verify) || '').trim().slice(0, 512);
  const statusToken = String(first(params.statusToken) || '').trim().slice(0, 512);
  const intent = registrationIntent(first(params.intent));
  const initialWorkspace = intent ? WORKSPACE_BY_INTENT[intent] : undefined;
  // Selection and original return filters are separate public hints, outside the auth payload.
  const marketSelection = publicMarketRegistrationContext(params);
  const selectedCrop = marketSelection?.selectedCrop || '';
  const selectedLot = marketSelection?.lotRef || null;
  const returnContext = marketSelection?.filters ?? publicMarketContext();
  const returnHref = marketHref(locale, returnContext);
  const hasPublicSelection = marketSelection !== null;
  const copy = PAGE_COPY[locale];
  const localeControl = <div className='pc-site-locale-cluster' aria-label={copy.language}>
    {(['ru','en','zh'] as const).map((targetLocale) => {
      const query = new URLSearchParams({ lang: targetLocale });
      if (verifyToken) query.set('verify', verifyToken);
      if (statusToken) query.set('statusToken', statusToken);
      if (intent) query.set('intent', intent);
      if (selectedCrop) query.set('crop', selectedCrop);
      if (selectedLot) query.set('lot', selectedLot);
      if (hasPublicSelection) query.set('returnTo', marketHref(targetLocale, returnContext));
      return <a key={targetLocale} className='pc-site-locale-option' data-active={targetLocale === locale ? 'true' : 'false'} aria-current={targetLocale === locale ? 'page' : undefined} href={`/platform-v7/register?${query.toString()}`}>{targetLocale === 'zh' ? '中文' : targetLocale.toUpperCase()}</a>;
    })}
  </div>;
  return <main className='p0-register-page'>
    <div className='p0-register-shell'>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7/register' localeControl={localeControl} />
      <section className='p0-register-hero' aria-labelledby='p0-register-title'>
        <small>{copy.kicker}</small><h1 id='p0-register-title'>{copy.title}</h1><p>{copy.lead}</p>
      </section>
      {hasPublicSelection ? <aside className='pc-cp-application-context' aria-label={copy.selection} data-testid='public-application-context'>
        <strong>{copy.selection}{intent === 'sell' || intent === 'buy' ? `: ${copy[intent]}` : ''}{selectedCrop ? ` · ${CROP_LABELS[locale][selectedCrop]}` : ''}</strong>
        <p>{copy.contextNote}</p>
        <a href={returnHref}>{copy.back}</a>
        {selectedLot ? <a href={marketHref(locale, returnContext, selectedLot)}>{copy.backOffer}</a> : null}
      </aside> : null}
      <RegisterFormClientPublic locale={locale} verifyToken={verifyToken || undefined} initialStatusToken={statusToken || undefined} initialWorkspace={initialWorkspace} />
    </div>
    <CanonicalBottomNav locale={locale} active='/platform-v7/register' />
  </main>;
}
