import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
import '@/styles/platform-v7-public-product-entry-variants.css';
import '@/styles/platform-v7-public-product-experience-v5.css';
import '@/styles/platform-v7-public-deal-explorer-mobile.css';
import '@/styles/platform-v7-public-deal-journey-v5.css';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicDealEntryGate } from '@/components/platform-v7/PublicDealEntryGate';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import { PublicExperienceScrollCoordinator } from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductEntryVariantsCopy } from '@/i18n/public-product-entry-variants';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import { getPublicDealJourneyV5Copy } from '@/i18n/public-deal-journey-v5';
import {
  DEFAULT_TOUR_STATE,
  normalizeTourEntryVariant,
  normalizeTourState,
} from '@/lib/platform-v7/public-product-experience-state';

type Locale = 'ru' | 'en' | 'zh';

const PAGE_COPY: Record<Locale, Readonly<{
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lead: string;
  exampleNotice: string;
  register: string;
  back: string;
  trust: string;
}>> = {
  ru: {
    title: 'Как проходит агросделка — Прозрачная Цена',
    description: 'Путь одной сделки в растениеводстве: условия, выбор контрагента, договорённости, доставка, приёмка, качество, документы, расчёт и закрытие.',
    kicker: 'Как работает Сделка',
    heading: 'От условий до закрытия — один понятный путь',
    lead: 'Сначала разберите обычное успешное исполнение. Затем при необходимости переключитесь на частичную приёмку или спор и посмотрите, как меняются действия, документы и расчётные основания.',
    exampleNotice: 'Ниже используется вымышленный пример. Он объясняет механику платформы и не содержит реальных сделок, организаций или банковских операций.',
    register: 'Зарегистрироваться',
    back: 'На главную',
    trust: 'Доверие',
  },
  en: {
    title: 'How an agricultural Deal works — Transparent Price',
    description: 'One crop-trade journey from terms and counterparty selection through delivery, acceptance, quality, documents, settlement and closure.',
    kicker: 'How a Deal works',
    heading: 'One clear path from terms to closure',
    lead: 'Start with ordinary successful execution. If needed, switch to partial acceptance or dispute and see how actions, documents and settlement grounds change.',
    exampleNotice: 'The flow below uses fictional data to explain platform mechanics. It contains no real deals, organisations or banking operations.',
    register: 'Register',
    back: 'Back to home',
    trust: 'Trust',
  },
  zh: {
    title: '农业交易如何运行 — 透明价格',
    description: '一笔种植业交易从条件和交易方选择，到交付、验收、质量、文件、结算与关闭的完整路径。',
    kicker: '交易如何运行',
    heading: '从条件到关闭，一条清晰路径',
    lead: '先查看普通成功履约流程。如有需要，再切换到部分验收或争议，了解操作、文件和结算依据如何变化。',
    exampleNotice: '下方使用虚构数据说明平台机制，不包含真实交易、机构或银行操作。',
    register: '注册',
    back: '返回首页',
    trust: '信任',
  },
};


const SUMMARY_COPY = {
  ru: {
    stagesTitle: 'Семь этапов одной Сделки',
    stages: [
      ['Товар / потребность', 'Фиксируется исходный товар или потребность и относящиеся условия.'],
      ['Торги', 'Предложения и коммерческие условия остаются связаны с исходным объектом.'],
      ['Обязательства', 'Выбранные условия становятся основанием дальнейшего исполнения и документов.'],
      ['Доставка', 'Маршрут, транспортная задача, водитель и события перевозки связаны со Сделкой.'],
      ['Приёмка и качество', 'Вес, приёмка, проба, методика и результат относятся к конкретной партии.'],
      ['Документы и расчёт', 'Документы и подтверждённые факты показывают, есть ли основание финансового действия.'],
      ['Закрытие', 'Итог, решения, отклонения и доказательства остаются в единой истории Сделки.'],
    ],
    participantsTitle: 'Кто участвует',
    participants: 'Продавец · Покупатель · Логистика · Водитель · Элеватор / хранение · Лаборатория · Сюрвейер · Банк / финансы · Сотрудник подключённой организации',
    statesTitle: 'Норма, отклонение и спор',
    states: [
      ['Норма', 'Исполнение соответствует условиям; расчётное основание подтверждается предусмотренными фактами и документами.'],
      ['Отклонение', 'Факт отличается от условия; уполномоченная сторона выбирает предусмотренный Сделкой вариант, а расчёт ждёт решения.'],
      ['Спор', 'Источники или позиции расходятся; финансовое действие остаётся остановленным до достаточного основания и рассмотрения связанных доказательств.'],
    ],
    detailTitle: 'Подробный путь по ролям',
    detailLead: 'Ниже можно посмотреть ту же Сделку глазами конкретного участника и разобрать документы, деньги, риск и следующий шаг.',
  },
  en: {
    stagesTitle: 'Seven stages of one Deal',
    stages: [
      ['Product / demand', 'The originating product or demand and relevant terms are recorded.'],
      ['Bidding', 'Offers and commercial terms stay linked to the originating object.'],
      ['Obligations', 'Selected terms become the basis for subsequent execution and documents.'],
      ['Delivery', 'Route, transport task, driver and transport events stay linked to the Deal.'],
      ['Acceptance and quality', 'Weight, acceptance, sample, method and result relate to the specific lot.'],
      ['Documents and settlement', 'Documents and confirmed facts show whether a financial action has sufficient basis.'],
      ['Closure', 'Outcome, decisions, deviations and evidence remain in one Deal history.'],
    ],
    participantsTitle: 'Who participates',
    participants: 'Seller · Buyer · Logistics · Driver · Elevator / storage · Laboratory · Surveyor · Bank / finance · Employee of a connected organisation',
    statesTitle: 'Normal, deviation and dispute',
    states: [
      ['Normal', 'Execution matches the terms; the settlement basis is confirmed by the required facts and documents.'],
      ['Deviation', 'A fact differs from a term; an authorised party chooses an allowed option while settlement awaits the decision.'],
      ['Dispute', 'Sources or positions conflict; financial action remains paused until sufficient basis exists and linked evidence is reviewed.'],
    ],
    detailTitle: 'Detailed journey by role',
    detailLead: 'Below you can view the same Deal from a participant perspective and inspect documents, money, risk and the next step.',
  },
  zh: {
    stagesTitle: '同一笔交易的七个阶段',
    stages: [
      ['商品 / 需求', '记录原始商品或需求以及相关条件。'],
      ['竞价', '报价和商业条件与原始对象保持关联。'],
      ['义务', '选定条件成为后续履约和文件的依据。'],
      ['交付', '路线、运输任务、司机和运输事件与交易关联。'],
      ['验收与质量', '重量、验收、样品、方法和结果都对应具体批次。'],
      ['文件与结算', '文件和已确认事实表明金融操作是否具备充分依据。'],
      ['关闭', '结果、决定、偏差和证据保留在同一交易历史中。'],
    ],
    participantsTitle: '参与方',
    participants: '卖方 · 买方 · 物流 · 司机 · 筒仓 / 仓储 · 实验室 · 检验机构 · 银行 / 金融 · 已接入机构员工',
    statesTitle: '正常、偏差与争议',
    states: [
      ['正常', '履约符合条件；结算依据由规定的事实和文件确认。'],
      ['偏差', '事实与条件不同；获授权一方选择交易允许的处理方案，结算等待决定。'],
      ['争议', '来源或立场冲突；在具备充分依据并审查关联证据前，金融操作保持暂停。'],
    ],
    detailTitle: '按角色查看详细流程',
    detailLead: '下方可以从具体参与方视角查看同一笔交易，并了解文件、资金、风险和下一步。',
  },
} as const;

const HOW_IT_WORKS_PUBLIC_CSS = `
.pc-hiw-summary{display:grid;gap:22px;margin:18px 0 30px;padding:26px;border:1px solid #d7e2dc;border-radius:22px;background:#fbfdfc}
.pc-hiw-summary h2,.pc-hiw-summary h3{margin:0;color:#173429;letter-spacing:-.025em}.pc-hiw-summary h2{font-size:clamp(26px,3vw,38px)}.pc-hiw-summary h3{font-size:18px}
.pc-hiw-stages{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}.pc-hiw-stages:focus-visible{outline:3px solid #7cc59a;outline-offset:3px}.pc-hiw-stages li{min-width:0;padding:14px;border:1px solid #dce6e0;border-radius:14px;background:#fff}.pc-hiw-stages i{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:#edf6f0;color:#087a3b;font-style:normal;font-size:11px;font-weight:800}.pc-hiw-stages strong{display:block;margin-top:18px;color:#294237;font-size:12px;line-height:1.35}.pc-hiw-stages p{margin:7px 0 0;color:#65746c;font-size:11px;line-height:1.45}
.pc-hiw-participants{padding:16px 18px;border-radius:14px;background:#edf5f0}.pc-hiw-participants p{margin:7px 0 0;color:#40584b;font-size:13px;line-height:1.55}
.pc-hiw-states{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pc-hiw-states article{padding:18px;border:1px solid #dce6e0;border-radius:15px;background:#fff}.pc-hiw-states strong{color:#173429;font-size:14px}.pc-hiw-states p{margin:8px 0 0;color:#63726a;font-size:12px;line-height:1.5}
.pc-hiw-detail{padding-top:4px;border-top:1px solid #dce6e0}.pc-hiw-detail p{margin:8px 0 0;color:#63726a;font-size:13px;line-height:1.55}
@media(max-width:960px){.pc-hiw-stages{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:640px){.pc-hiw-summary{padding:18px 14px}.pc-hiw-stages{grid-auto-flow:column;grid-auto-columns:minmax(170px,78vw);grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}.pc-hiw-stages li{scroll-snap-align:start}.pc-hiw-states{grid-template-columns:1fr}}
.pc-ppe-page[data-testid='platform-v7-deal-from-inside'] .pc-ppe-stage-nav > .pc-ppe-icon-button {
  flex: 0 0 44px;
  width: 44px;
  min-width: 44px;
  min-height: 44px;
}
/* Public exploration focuses on context, action and grounds instead of status
 * fields. Underlying route/state authority remains unchanged for navigation. */
.pc-ppe-page[data-testid='platform-v7-deal-from-inside'] .pc-ppe-deal-state > div[data-tone='action'],
.pc-ppe-page[data-testid='platform-v7-deal-from-inside'] .pc-ppe-v5-stage-main > p,
.pc-ppe-page[data-testid='platform-v7-deal-from-inside'] .pc-ppe-document-card summary small {
  display: none !important;
}
`;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function sanitizeVisibleDealCopy<T>(value: T, locale: Locale): T {
  const replacements: Record<Locale, readonly (readonly [string, string])[]> = {
    ru: [
      ['готовность расчёта', 'основание расчёта'],
      ['Готовность расчёта', 'Основание расчёта'],
      ['расчётный статус', 'расчётный контекст'],
      ['статус партии', 'события партии'],
      ['Активного блокера нет', 'Критического блокера нет'],
      ['Полная готовность расчёта', 'Полное основание расчёта'],
      ['Готовность финансового действия', 'Основание финансового действия'],
    ],
    en: [
      ['settlement readiness', 'settlement basis'],
      ['Settlement readiness', 'Settlement basis'],
      ['settlement status', 'settlement context'],
      ['lot status', 'lot events'],
      ['No active blocker', 'No critical blocker'],
      ['Full settlement readiness', 'Complete settlement basis'],
    ],
    zh: [
      ['结算准备状态', '结算依据'],
      ['完整结算准备', '完整结算依据'],
      ['批次状态', '批次事件'],
    ],
  };

  const transform = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return replacements[locale].reduce((text, [from, to]) => text.replaceAll(from, to), node);
    }
    if (Array.isArray(node)) return node.map(transform);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, transform(child)]));
    }
    return node;
  };

  return transform(value) as T;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const copy = PAGE_COPY[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: '/platform-v7/how-it-works',
      languages: {
        ru: '/platform-v7/how-it-works?lang=ru',
        en: '/platform-v7/how-it-works?lang=en',
        zh: '/platform-v7/how-it-works?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicDealFromInsidePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const locale = await getLocale();
  const normalizedLocale = localeOf(locale);
  const pageCopy = PAGE_COPY[normalizedLocale];
  const copy = sanitizeVisibleDealCopy(getPublicProductExperienceCopy(locale), normalizedLocale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const journeyUi = getPublicDealJourneyV5Copy(locale);
  const entryCopy = getPublicProductEntryVariantsCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const initialEntry = normalizeTourEntryVariant(searchParams?.entry);
  const initialState = normalizeTourState(searchParams ?? {}, {
    ...DEFAULT_TOUR_STATE,
    stage: 'terms',
    perspective: 'buyer',
  });
  const localizedHref = (path: string) => `${path}?lang=${encodeURIComponent(normalizedLocale)}`;
  const registerHref = localizedHref('/platform-v7/register');
  const loginHref = localizedHref('/platform-v7/login');
  const homeHref = localizedHref('/platform-v7');
  void journeyUi;
  const nav = (
    <>
      <a href={`${homeHref}#how-it-works`}>{ui.header.howItWorks}</a>
      <a href={`${homeHref}#participants`}>{ui.header.participants}</a>
      <a href={`${homeHref}#trust`}>{ui.header.reliability}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-deal-from-inside'>
      <style>{HOW_IT_WORKS_PUBLIC_CSS}</style>
      <a className='pc-skip-link' href='#pc-ppe-explorer-title'>{chrome('skipToContent')}</a>
      <PublicExperienceScrollCoordinator />
      <PublicSiteHeader
        ariaLabel={copy.header.aria}
        brandHomeLabel={copy.header.brandHome}
        navLabel={copy.header.aria}
        menuLabel={ui.header.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={
          <div className='pc-v6-header-actions'>
            <a href={loginHref} className='entry-login'>{copy.header.signIn}</a>
            <a href={registerHref} className='pc-ppe-primary-button'>{pageCopy.register}</a>
          </div>
        }
      />

      <div className='pc-ppe-shell'>
        <header className='pc-ppe-explorer-intro'>
          <div>
            <span className='pc-ppe-kicker'>{pageCopy.kicker}</span>
            <h1 id='pc-ppe-explorer-title'>{pageCopy.heading}</h1>
            <p>{pageCopy.lead}</p>
            <div className='pc-ppe-demo-banner' role='note'>{pageCopy.exampleNotice}</div>
          </div>
          <div className='pc-ppe-explorer-intro-actions'>
            <a href={homeHref} className='pc-ppe-back-link'>
              <PublicExperienceIcon name='arrow' size={18} style={{ transform: 'rotate(180deg)' }} />
              <span>{pageCopy.back}</span>
            </a>
          </div>
        </header>

        <section className='pc-hiw-summary' aria-labelledby='pc-hiw-stages-title'>
          <h2 id='pc-hiw-stages-title'>{SUMMARY_COPY[normalizedLocale].stagesTitle}</h2>
          <ol className='pc-hiw-stages' tabIndex={0} aria-labelledby='pc-hiw-stages-title'>
            {SUMMARY_COPY[normalizedLocale].stages.map(([title, text], index) => (
              <li key={title}><i>{index + 1}</i><strong>{title}</strong><p>{text}</p></li>
            ))}
          </ol>
          <div className='pc-hiw-participants'>
            <h3>{SUMMARY_COPY[normalizedLocale].participantsTitle}</h3>
            <p>{SUMMARY_COPY[normalizedLocale].participants}</p>
          </div>
          <div>
            <h3>{SUMMARY_COPY[normalizedLocale].statesTitle}</h3>
            <div className='pc-hiw-states'>
              {SUMMARY_COPY[normalizedLocale].states.map(([title, text]) => <article key={title}><strong>{title}</strong><p>{text}</p></article>)}
            </div>
          </div>
          <div className='pc-hiw-detail'>
            <h3>{SUMMARY_COPY[normalizedLocale].detailTitle}</h3>
            <p>{SUMMARY_COPY[normalizedLocale].detailLead}</p>
          </div>
        </section>

        <PublicDealEntryGate
          copy={copy}
          entryCopy={entryCopy}
          locale={locale}
          initialEntry={initialEntry}
          initialState={initialState}
        />
        <noscript>
          <a href={registerHref} className='pc-ppe-primary-button'>{pageCopy.register}</a>
        </noscript>
      </div>

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'>
            <strong>Прозрачная Цена</strong>
            <p>{ui.footer.note}</p>
          </div>
          <nav aria-label={copy.header.aria}>
            <a href={localizedHref('/platform-v7/about')}>{ui.footer.about}</a>
            <a href={localizedHref('/platform-v7/trust')}>{pageCopy.trust}</a>
            <a href={localizedHref('/platform-v7/privacy')}>{ui.footer.privacy}</a>
            <a href={localizedHref('/platform-v7/terms')}>{ui.footer.terms}</a>
            <a href={localizedHref('/platform-v7/contact')}>{ui.footer.contact}</a>
          </nav>
          <small>{ui.footer.disclaimer}</small>
          <span>© {new Date().getUTCFullYear()} Прозрачная Цена</span>
        </div>
      </footer>
    </main>
  );
}
