import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import {
  ArrowRight,
  Banknote,
  Handshake,
  Truck,
  Wheat,
} from 'lucide-react';
import {
  CAPABILITIES,
  CANONICAL_ROLES,
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  CanonicalStateLens,
  CanonicalTrustLedger,
  canonicalPublicLocale,
} from './PublicCanonicalPrimitives';
import { CanonicalMarketPreview } from './PublicCanonicalMarket';

const HERO_MEDIA_SRC = 'data:image/webp;base64,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';

const COPY = {
  ru: {
    heroKicker: 'Единый контур агросделки',
    heroTitle: 'Агросделка. От товара и цены — до результата.',
    heroLead: 'Лот, торги, обязательства, доставка, качество, документы, расчёт и закрытие связаны в одной Сделке — с понятными полномочиями, основаниями и следующим шагом.',
    sell: 'Продать',
    buy: 'Купить',
    proof: ['Реальные публичные лоты', '9 ролей', '7 этапов', 'Факты и основания'],
    lens: 'Deal Lens',
    lensState: 'Структура Сделки',
    lensCells: [
      ['Объект', 'Одна сквозная Сделка'],
      ['Полномочия', 'Только подтверждённой роли'],
      ['Состояние', 'Норма · Отклонение · Спор'],
      ['Источник', 'Связанные факты и документы'],
    ],
    lensNext: 'Следующий шаг определяется состоянием Сделки и полномочиями участника.',
    marketEyebrow: 'Рынок',
    marketTitle: 'Рынок',
    marketLead: 'Опубликованные обезличенные лоты. Актуальность и доступность — только по подтверждённой серверной проекции.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: 'Сквозная Сделка',
    dealLead: 'Семь этапов — от лота и торгов до исполнения, расчёта и закрытия.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Для кого',
    groups: [
      ['Продать', 'Продавец размещает товар и ведёт исполнение до закрытия Сделки.'],
      ['Купить', 'Покупатель видит рынок, условия, исполнение, качество и документы.'],
      ['Исполнить Сделку', 'Логистика, водитель, элеватор, лаборатория и сюрвейер работают в своём контексте.'],
      ['Финансы', 'Банк работает только с подтверждённым основанием и доступным ему контекстом.'],
    ],
    rolesLabel: '9 канонических ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Сделка в работе',
    liveLead: 'Критическое состояние отвечает на пять вопросов: что произошло, кто действует, на каком основании, что с расчётом и какой следующий шаг допустим.',
    state: {
      happened: 'Рабочий экран показывает фактическое состояние без подмены серверных данных.',
      actor: 'Только участник с подтверждённой ролью и доступом к Сделке.',
      basis: 'Условия, событие, документ или иное подтверждённое основание.',
      settlement: 'Финансовый статус не выбирается клиентом и зависит от подтверждённых оснований.',
      next: 'Доступное действие определяется серверным контекстом и полномочиями.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие. На основе фактов',
    trustLead: 'Этот порядок одинаков для рынка, исполнения Сделки, документов, финансового шага и разбора исключений.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта. Контекстный ИИ в каждой Сделке',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Возможности',
    capability: {
      market: ['Рынок', 'Публичные обезличенные лоты и безопасный вход в торговый контур.'],
      trading: ['Торги', 'Выбор контрагента и фиксация результата торгов в контексте Сделки.'],
      commitments: ['Обязательства', 'Условия и ответственность сторон остаются связаны с исполнением.'],
      delivery: ['Доставка', 'Роль логистики и водителя встроена в путь Сделки.'],
      acceptance: ['Приёмка и качество', 'Факты приёмки и качества влияют на разрешённый следующий шаг.'],
      documents: ['Документы', 'Документы и события не оторваны от конкретной Сделки.'],
      settlement: ['Расчёт', 'Платформа показывает основание; финансовое событие остаётся внешне подтверждаемым.'],
      dispute: ['Спор', 'Исключение разбирается по связанным фактам, основаниям и журналу действий.'],
      trust: ['Доверие', 'Полномочия, основание, источник и решение видимы в рабочем контексте.'],
      gekta: ['Гекта', 'Объясняет контекст, риск и допустимый следующий шаг без самостоятельной критической власти.'],
      roles: ['Роли', 'Каждый участник видит только разрешённый ему рабочий контекст.'],
      history: ['История', 'События Сделки сохраняют связь с фактом, участником и основанием.'],
    },
    finalTitle: 'Прозрачные сделки создают устойчивое будущее АПК',
    finalText: 'Регистрация создаёт заявку на подключение. Реальные права появляются только после серверной проверки организации и полномочий.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'One agricultural Deal flow',
    heroTitle: 'The agricultural Deal. From product and price to outcome.',
    heroLead: 'Lot, trading, commitments, delivery, quality, documents, settlement and closure stay connected in one Deal with clear authority, evidence and the next permitted step.',
    sell: 'Sell',
    buy: 'Buy',
    proof: ['Real public lots', '9 roles', '7 stages', 'Facts and evidence'],
    lens: 'Deal Lens',
    lensState: 'Deal structure',
    lensCells: [
      ['Object', 'One end-to-end Deal'],
      ['Authority', 'Confirmed role only'],
      ['State', 'Normal · Deviation · Dispute'],
      ['Source', 'Connected facts and documents'],
    ],
    lensNext: 'The next step follows Deal state and participant authority.',
    marketEyebrow: 'Market',
    marketTitle: 'Public lots without fabricated data',
    marketLead: 'Only anonymised lots admitted by the server for public publication are shown. If current data is unavailable, the interface says so.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'Seven stages in one context',
    dealLead: 'Stages are not isolated screens: each next step is tied to the responsible participant, basis, fact source and settlement impact.',
    whoEyebrow: 'For whom',
    whoTitle: 'One design language for every participant',
    groups: [
      ['Sell', 'The seller lists product and manages execution through Deal closure.'],
      ['Buy', 'The buyer sees market, terms, execution, quality and documents.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor work in their own authorised context.'],
      ['Finance', 'The bank works only with confirmed basis and the context available to it.'],
    ],
    rolesLabel: '9 canonical roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'Normal, deviation and dispute in one working context',
    liveLead: 'A critical state answers five questions: what happened, who acts, on what basis, what happens to settlement and what the next permitted step is.',
    state: {
      happened: 'The workspace shows actual state without replacing server data.',
      actor: 'Only a participant with a confirmed role and Deal access.',
      basis: 'Terms, event, document or another confirmed basis.',
      settlement: 'Financial state is not client-selected and depends on confirmed basis.',
      next: 'Available action follows server context and authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Authority → Basis → Source → Decision',
    trustLead: 'The same order applies to market, Deal execution, documents, the financial step and exception handling.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Intelligence inside context, never instead of authority',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'One system instead of disconnected circuits',
    capability: {
      market: ['Market', 'Public anonymised lots and a safe entry into trading.'],
      trading: ['Trading', 'Counterparty selection and trading outcome remain in Deal context.'],
      commitments: ['Commitments', 'Terms and responsibilities stay connected to execution.'],
      delivery: ['Delivery', 'Logistics and driver roles are part of the Deal path.'],
      acceptance: ['Acceptance and quality', 'Acceptance and quality facts affect the permitted next step.'],
      documents: ['Documents', 'Documents and events stay tied to the specific Deal.'],
      settlement: ['Settlement', 'The platform shows basis; the financial event remains externally confirmed.'],
      dispute: ['Dispute', 'Exceptions are reviewed using connected facts, evidence and the action log.'],
      trust: ['Trust', 'Authority, basis, source and decision remain visible in context.'],
      gekta: ['Gekta', 'Explains context, risk and the permitted next step without independent critical authority.'],
      roles: ['Roles', 'Each participant sees only its authorised working context.'],
      history: ['History', 'Deal events remain linked to fact, participant and basis.'],
    },
    finalTitle: 'Start with the market or your role in the Deal',
    finalText: 'Registration creates a connection request. Actual rights appear only after server-side organisation and authority checks.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '统一农业交易流程',
    heroTitle: '农业交易。从商品与价格，到最终结果。',
    heroLead: '批次、交易、义务、交付、质量、文件、结算和关闭保持在同一笔交易中，并明确权限、依据和允许的下一步。',
    sell: '出售',
    buy: '购买',
    proof: ['真实公开批次', '9 个角色', '7 个阶段', '事实与依据'],
    lens: 'Deal Lens',
    lensState: '交易结构',
    lensCells: [
      ['对象', '一笔端到端交易'],
      ['权限', '仅限已确认角色'],
      ['状态', '正常 · 偏差 · 争议'],
      ['来源', '关联事实和文件'],
    ],
    lensNext: '下一步由交易状态和参与方权限决定。',
    marketEyebrow: '市场',
    marketTitle: '公开批次，不使用虚构数据',
    marketLead: '仅展示服务器允许公开发布的匿名批次。如果当前数据不可用，界面会明确说明。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '七个阶段，一个上下文',
    dealLead: '各阶段不是彼此孤立的页面：每一步都与责任参与方、依据、事实来源和结算影响关联。',
    whoEyebrow: '面向谁',
    whoTitle: '所有参与方使用同一套设计语言',
    groups: [
      ['出售', '卖方发布商品并管理履约直至交易关闭。'],
      ['购买', '买方查看市场、条件、履约、质量和文件。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构在各自授权上下文中工作。'],
      ['金融', '银行仅处理已确认依据及其获准查看的上下文。'],
    ],
    rolesLabel: '9 个规范角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '正常、偏差和争议在同一工作上下文中',
    liveLead: '关键状态回答五个问题：发生了什么、谁处理、依据是什么、结算如何受影响、下一步允许做什么。',
    state: {
      happened: '工作空间展示真实状态，不替换服务器数据。',
      actor: '仅限具有已确认角色和交易访问权限的参与方。',
      basis: '条件、事件、文件或其他已确认依据。',
      settlement: '金融状态不能由客户端选择，只取决于已确认依据。',
      next: '可执行操作由服务器上下文和权限决定。',
    },
    trustEyebrow: '信任',
    trustTitle: '权限 → 依据 → 来源 → 决定',
    trustLead: '这一顺序统一适用于市场、交易履约、文件、金融步骤和异常处理。',
    gektaEyebrow: 'Gekta',
    gektaTitle: '智能服务于上下文，而不是取代权限',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '一个系统，替代分散的工作链路',
    capability: {
      market: ['市场', '公开匿名批次和安全进入交易流程。'],
      trading: ['交易', '交易方选择和交易结果保持在交易上下文中。'],
      commitments: ['义务', '条件和责任始终与履约关联。'],
      delivery: ['交付', '物流和司机角色嵌入交易路径。'],
      acceptance: ['验收与质量', '验收和质量事实影响允许的下一步。'],
      documents: ['文件', '文件和事件始终与具体交易关联。'],
      settlement: ['结算', '平台展示依据；金融事件仍需外部确认。'],
      dispute: ['争议', '异常根据关联事实、依据和操作日志处理。'],
      trust: ['信任', '权限、依据、来源和决定在工作上下文中可见。'],
      gekta: ['Gekta', '解释上下文、风险和允许的下一步，但不拥有独立关键决策权。'],
      roles: ['角色', '每个参与方只看到其获授权的工作上下文。'],
      history: ['历史', '交易事件与事实、参与方和依据保持关联。'],
    },
    finalTitle: '从市场或你在交易中的角色开始',
    finalText: '注册会创建接入申请。真实权限只有在服务器完成机构和权限审核后才会出现。',
    register: '注册',
    contact: '联系',
  },
} as const;

const GROUP_ICONS = [Wheat, Handshake, Truck, Banknote] as const;
const ROLE_GROUP_INDEXES = [[0],[1],[2,3,4,5,6],[7,8]] as const;

export async function PlatformV7StrategicHome() {
  const locale = canonicalPublicLocale(await getLocale());
  const copy = COPY[locale];
  const registerBase = `/platform-v7/register?lang=${locale}`;

  return (
    <main className='pc-canonical-public pc-cp-page-home' data-testid='platform-v7-root-execution-cockpit'>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7' />

      <section className='pc-cp-hero' aria-labelledby='pc-cp-home-title'>
        <img className='pc-cp-hero-media' src={HERO_MEDIA_SRC} alt='' width='400' height='320' loading='eager' decoding='sync' fetchPriority='high' aria-hidden='true' />
        <div className='pc-cp-container pc-cp-hero-grid'>
          <div className='pc-cp-hero-copy'>
            <span className='pc-cp-eyebrow'>{copy.heroKicker}</span>
            <h1 id='pc-cp-home-title'>{copy.heroTitle}</h1>
            <p>{copy.heroLead}</p>
            <div className='pc-cp-actions'>
              <Link prefetch={false} className='pc-cp-button' href={`${registerBase}&intent=sell`}>{copy.sell}<ArrowRight size={17} aria-hidden='true' /></Link>
              <Link prefetch={false} className='pc-cp-button pc-cp-button--secondary' href={`${registerBase}&intent=buy`}>{copy.buy}</Link>
            </div>
            <div className='pc-cp-hero-proof'>{copy.proof.map((item) => <span key={item}>{item}</span>)}</div>
          </div>

          <aside className='pc-cp-deal-lens' aria-label={copy.lens}>
            <div className='pc-cp-deal-lens-head'><span className='pc-cp-eyebrow'>{copy.lens}</span><strong>{copy.lensState}</strong></div>
            <div className='pc-cp-deal-lens-grid'>
              {copy.lensCells.map(([label, value]) => <div className='pc-cp-deal-lens-cell' key={label}><small>{label}</small><strong>{value}</strong></div>)}
            </div>
            <div className='pc-cp-deal-lens-next'><small>{locale === 'ru' ? 'Следующий шаг' : locale === 'en' ? 'Next step' : '下一步'}</small><strong>{copy.lensNext}</strong></div>
          </aside>
        </div>
      </section>

      <section className='pc-cp-section' id='market' aria-labelledby='pc-home-market-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.marketEyebrow}</span>
            <h2 id='pc-home-market-title'>{copy.marketTitle}</h2>
            <p>{copy.marketLead}</p>
          </div>
          <CanonicalMarketPreview locale={locale} limit={4} />
          <div className='pc-cp-actions' style={{ marginTop: 18 }}><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market?lang=${locale}`}>{copy.openMarket}<ArrowRight size={16} aria-hidden='true' /></Link></div>
        </div>
      </section>

      <section className='pc-cp-section pc-cp-section--soft' id='deal-path' aria-labelledby='pc-home-deal-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.dealEyebrow}</span>
            <h2 id='pc-home-deal-title'>{copy.dealTitle}</h2>
            <p>{copy.dealLead}</p>
          </div>
          <CanonicalDealSpine locale={locale} currentIndex={0} />
        </div>
      </section>

      <section className='pc-cp-section' id='participants' aria-labelledby='pc-home-groups-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.whoEyebrow}</span>
            <h2 id='pc-home-groups-title'>{copy.whoTitle}</h2>
          </div>
          <div className='pc-cp-role-grid'>
            {copy.groups.map(([title, text], index) => {
              const Icon = GROUP_ICONS[index]!;
              return <article className='pc-cp-card pc-cp-role-card' key={title}><Icon size={22} aria-hidden='true' /><strong>{title}</strong><p>{text}</p><div className='pc-cp-role-tags'>{ROLE_GROUP_INDEXES[index]!.map((roleIndex)=><span key={CANONICAL_ROLES[locale][roleIndex]}>{CANONICAL_ROLES[locale][roleIndex]}</span>)}</div></article>;
            })}
          </div>
        </div>
      </section>

      <section className='pc-cp-section pc-cp-section--soft' id='live' aria-labelledby='pc-home-live-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.liveEyebrow}</span>
            <h2 id='pc-home-live-title'>{copy.liveTitle}</h2>
            <p>{copy.liveLead}</p>
          </div>
          <CanonicalStateLens
            locale={locale}
            state='normal'
            happened={copy.state.happened}
            actor={copy.state.actor}
            basis={copy.state.basis}
            settlement={copy.state.settlement}
            next={copy.state.next}
          />
        </div>
      </section>

      <section className='pc-cp-section' id='trust' aria-labelledby='pc-home-trust-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.trustEyebrow}</span>
            <h2 id='pc-home-trust-title'>{copy.trustTitle}</h2>
            <p>{copy.trustLead}</p>
          </div>
          <CanonicalTrustLedger locale={locale} />
        </div>
      </section>

      <section className='pc-cp-section pc-cp-section--tight' id='gekta' aria-labelledby='pc-home-gekta-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.gektaEyebrow}</span>
            <h2 id='pc-home-gekta-title'>{copy.gektaTitle}</h2>
          </div>
          <CanonicalGektaStrip locale={locale} />
        </div>
      </section>

      <section className='pc-cp-section pc-cp-section--soft' id='capabilities' aria-labelledby='pc-home-cap-title'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{copy.opportunitiesEyebrow}</span>
            <h2 id='pc-home-cap-title'>{copy.opportunitiesTitle}</h2>
          </div>
          <div className='pc-cp-capabilities' tabIndex={0} aria-label={locale === 'ru' ? 'Карусель возможностей платформы' : locale === 'en' ? 'Platform capabilities carousel' : '平台功能轮播'}>
            {CAPABILITIES.map(([Icon, key]) => {
              const [title, text] = copy.capability[key];
              return <article className='pc-cp-card pc-cp-capability' key={key}><Icon size={21} aria-hidden='true' /><strong>{title}</strong><p>{text}</p></article>;
            })}
          </div>
        </div>
      </section>

      <section className='pc-cp-final'>
        <div className='pc-cp-container'><div className='pc-cp-final-inner'>
          <h2>{copy.finalTitle}</h2>
          <p>{copy.finalText}</p>
          <div className='pc-cp-actions'>
            <Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{copy.register}<ArrowRight size={17} aria-hidden='true' /></Link>
            <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/contact?lang=${locale}`}>{copy.contact}</Link>
          </div>
        </div></div>
      </section>

      <CanonicalFooter locale={locale} />
      <CanonicalBottomNav locale={locale} active='/platform-v7' />
    </main>
  );
}
