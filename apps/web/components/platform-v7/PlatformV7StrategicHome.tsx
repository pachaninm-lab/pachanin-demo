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

const COPY = {
  ru: {
    heroKicker: 'Платформа для агросделок',
    heroTitle: 'Агросделка — от цены до закрытия.',
    heroLead: 'В одной Сделке собраны торги, доставка, качество, документы и расчёт. Участник видит свои задачи и доступные действия.',
    sell: 'Продать',
    buy: 'Купить',
    proof: ['Публичные лоты', '9 ролей', '7 этапов', 'Факты и основания'],
    lens: 'Deal Lens',
    lensState: 'Структура Сделки',
    lensCells: [
      ['Объект', 'Одна Сделка'],
      ['Полномочия', 'Права после проверки'],
      ['Состояние', 'Норма · Отклонение · Спор'],
      ['Источник', 'Факты и документы'],
    ],
    lensNext: 'Следующий шаг зависит от состояния Сделки и полномочий участника.',
    marketEyebrow: 'Рынок',
    marketTitle: 'Рынок',
    marketLead: 'Опубликованные обезличенные лоты. Актуальность и доступность — только по подтверждённой серверной проекции.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: 'Сквозная Сделка',
    dealLead: 'Семь этапов: от публикации лота и торгов до расчёта, закрытия или спора.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Для кого',
    groups: [
      ['Продать', 'Продавец размещает товар, принимает решение по торгам и ведёт Сделку до закрытия.'],
      ['Купить', 'Покупатель сравнивает предложения и контролирует условия, исполнение, качество и документы.'],
      ['Исполнить Сделку', 'Логист, водитель, элеватор, лаборатория и сюрвейер работают каждый в своей зоне ответственности.'],
      ['Финансы', 'Банк видит только те документы и данные Сделки, которые доступны его роли.'],
    ],
    rolesLabel: '9 ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Сделка в работе',
    liveLead: 'Экран сразу показывает, что произошло, кто действует, на каком основании, что с расчётом и что делать дальше.',
    state: {
      happened: 'Показываем только подтверждённое состояние Сделки.',
      actor: 'Действует участник с подтверждённой ролью и доступом к Сделке.',
      basis: 'Основание — условие, событие или документ.',
      settlement: 'Статус расчёта формируется по подтверждённым событиям, а не выбирается в интерфейсе.',
      next: 'Доступные действия зависят от состояния Сделки и полномочий.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие. На основе фактов',
    trustLead: 'Для каждого важного действия видно четыре вещи: полномочия, основание, источник и принятое решение.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта. Контекстный ИИ в каждой Сделке',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Возможности',
    capability: {
      market: ['Рынок', 'Обезличенные публичные лоты и переход к торгам.'],
      trading: ['Торги', 'Выбор контрагента и результат торгов остаются внутри Сделки.'],
      commitments: ['Обязательства', 'Условия и ответственность сторон связаны с дальнейшим исполнением.'],
      delivery: ['Доставка', 'Логист и водитель работают в том же контуре Сделки.'],
      acceptance: ['Приёмка и качество', 'Результаты приёмки и качества влияют на дальнейшие действия.'],
      documents: ['Документы', 'Документы и события привязаны к конкретной Сделке.'],
      settlement: ['Расчёт', 'Платформа показывает, на чём основан расчёт. Внешнее финансовое событие должно быть подтверждено.'],
      dispute: ['Спор', 'Спор разбирается по фактам, документам и журналу действий.'],
      trust: ['Доверие', 'На экране видны полномочия, основания, источники и принятые решения.'],
      gekta: ['Гекта', 'Помогает разобраться в состоянии Сделки и рисках, но не принимает критические решения за человека.'],
      roles: ['Роли', 'Каждый участник видит только то, что разрешено его ролью и организацией.'],
      history: ['История', 'История Сделки связывает событие, участника, факт и основание.'],
    },
    finalTitle: 'Начните с рынка или своей роли в Сделке',
    finalText: 'Регистрация создаёт заявку на подключение. Доступ появляется после проверки организации и полномочий.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'A platform for agricultural Deals',
    heroTitle: 'From price to closure — one Deal.',
    heroLead: 'Lot, trading, delivery, quality, documents and settlement stay in one Deal. Each participant sees their tasks, evidence and next action.',
    sell: 'Sell',
    buy: 'Buy',
    proof: ['Public lots', '9 roles', '7 stages', 'Facts and evidence'],
    lens: 'Deal Lens',
    lensState: 'Deal structure',
    lensCells: [
      ['Object', 'One Deal'],
      ['Authority', 'Rights after verification'],
      ['State', 'Normal · Deviation · Dispute'],
      ['Source', 'Facts and documents'],
    ],
    lensNext: 'The next action depends on Deal state and participant authority.',
    marketEyebrow: 'Market',
    marketTitle: 'Public lots without fabricated data',
    marketLead: 'Only anonymised lots admitted by the server for public publication are shown. If current data is unavailable, the interface says so.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'Seven stages in one context',
    dealLead: 'Seven stages: from listing and trading to settlement, closure or dispute.',
    whoEyebrow: 'For whom',
    whoTitle: 'One design language for every participant',
    groups: [
      ['Sell', 'The seller lists product, responds to trading and manages the Deal through closure.'],
      ['Buy', 'The buyer compares offers and tracks terms, execution, quality and documents.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor each work within their own responsibility.'],
      ['Finance', 'The bank sees only the documents and Deal data available to its role.'],
    ],
    rolesLabel: '9 roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'Normal, deviation and dispute in one working context',
    liveLead: 'The screen shows what happened, who is responsible, the settlement status and what can happen next.',
    state: {
      happened: 'Only confirmed Deal state is shown.',
      actor: 'A participant with a confirmed role and Deal access.',
      basis: 'The basis is a term, event or document.',
      settlement: 'Settlement status follows confirmed events; it is not selected in the interface.',
      next: 'Available actions depend on Deal state and authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Authority → Basis → Source → Decision',
    trustLead: 'For every important action, the user can see authority, basis, source and decision.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Intelligence inside context, never instead of authority',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'One system instead of disconnected circuits',
    capability: {
      market: ['Market', 'Anonymised public lots and a direct route into trading.'],
      trading: ['Trading', 'Counterparty selection and the trading result stay inside the Deal.'],
      commitments: ['Commitments', 'Terms and responsibilities remain tied to execution.'],
      delivery: ['Delivery', 'Logistics and the driver work in the same Deal flow.'],
      acceptance: ['Acceptance and quality', 'Acceptance and quality results affect what can happen next.'],
      documents: ['Documents', 'Documents and events are tied to the specific Deal.'],
      settlement: ['Settlement', 'The platform shows the basis for settlement; the external financial event still requires confirmation.'],
      dispute: ['Dispute', 'A dispute is reviewed against facts, documents and the action log.'],
      trust: ['Trust', 'Authority, basis, source and decision remain visible in the workspace.'],
      gekta: ['Gekta', 'Helps the user understand Deal state and risk, but does not make critical decisions.'],
      roles: ['Roles', 'Each participant sees only what their role and organisation allow.'],
      history: ['History', 'Deal history links each event to the participant, fact and basis.'],
    },
    finalTitle: 'Start with the market or your role in the Deal',
    finalText: 'Registration creates a connection request. Access appears after the organisation and authority are verified.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '农业交易平台',
    heroTitle: '从定价到结算，一笔交易贯穿全程。',
    heroLead: '交易、交付、质量、文件与结算都在同一笔交易中。每个参与方只看到自己的任务和可执行操作。',
    sell: '出售',
    buy: '购买',
    proof: ['公开批次', '9 个角色', '7 个阶段', '事实与依据'],
    lens: 'Deal Lens',
    lensState: '交易结构',
    lensCells: [
      ['对象', '一笔交易'],
      ['权限', '权限审核后生效'],
      ['状态', '正常 · 偏差 · 争议'],
      ['来源', '事实与文件'],
    ],
    lensNext: '下一步取决于交易状态和参与方权限。',
    marketEyebrow: '市场',
    marketTitle: '公开批次，不使用虚构数据',
    marketLead: '仅展示服务器允许公开发布的匿名批次。如果当前数据不可用，界面会明确说明。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '七个阶段，一个上下文',
    dealLead: '七个阶段：从发布批次和交易，到结算、关闭或争议。',
    whoEyebrow: '面向谁',
    whoTitle: '所有参与方使用同一套设计语言',
    groups: [
      ['出售', '卖方发布商品、参与交易，并跟进至交易关闭。'],
      ['购买', '买方比较报价，并跟踪条件、履约、质量和文件。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构各自负责对应环节。'],
      ['金融', '银行只查看已确认依据及其获授权的交易数据。'],
    ],
    rolesLabel: '9 个角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '正常、偏差和争议在同一工作上下文中',
    liveLead: '页面直接显示发生了什么、谁负责、结算状态以及接下来可以做什么。',
    state: {
      happened: '只展示已确认的交易状态。',
      actor: '由具备已确认角色和交易权限的参与方处理。',
      basis: '依据可以是条件、事件或文件。',
      settlement: '结算状态来自已确认事件，不能在界面中自行选择。',
      next: '可执行操作取决于交易状态和权限。',
    },
    trustEyebrow: '信任',
    trustTitle: '权限 → 依据 → 来源 → 决定',
    trustLead: '每个重要操作都能看到权限、依据、来源和决定。',
    gektaEyebrow: 'Gekta',
    gektaTitle: '智能服务于上下文，而不是取代权限',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '一个系统，替代分散的工作链路',
    capability: {
      market: ['市场', '公开匿名批次，并可直接进入交易流程。'],
      trading: ['交易', '交易方选择和交易结果保留在同一笔交易中。'],
      commitments: ['义务', '条件和责任始终与后续履约关联。'],
      delivery: ['交付', '物流和司机在同一交易流程中协作。'],
      acceptance: ['验收与质量', '验收和质量结果决定后续可执行操作。'],
      documents: ['文件', '文件和事件都关联到具体交易。'],
      settlement: ['结算', '平台展示结算依据；外部金融事件仍需确认。'],
      dispute: ['争议', '争议根据事实、文件和操作日志处理。'],
      trust: ['信任', '工作页面显示权限、依据、来源和决定。'],
      gekta: ['Gekta', '帮助理解交易状态和风险，但不替人做关键决定。'],
      roles: ['角色', '每个参与方只看到其角色和机构允许查看的内容。'],
      history: ['历史', '交易历史把事件、参与方、事实和依据关联起来。'],
    },
    finalTitle: '从市场或你的交易角色开始',
    finalText: '注册会创建接入申请。机构和权限审核完成后才会开放访问。',
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
        <img className='pc-cp-hero-media' src='/platform-v7/hero-agro-infrastructure.svg' alt='' width='400' height='320' loading='eager' decoding='sync' fetchPriority='high' aria-hidden='true' />
        <div className='pc-cp-container pc-cp-hero-grid'>
          <div className='pc-cp-hero-copy'>
            <span className='pc-cp-eyebrow'>{copy.heroKicker}</span>
            <h1 id='pc-cp-home-title'>{copy.heroTitle}</h1>
            <p>{copy.heroLead}</p>
            <div className='pc-cp-actions'>
              <a className='pc-cp-button' href={`${registerBase}&intent=sell`}>{copy.sell}<ArrowRight size={17} aria-hidden='true' /></a>
              <a className='pc-cp-button pc-cp-button--secondary' href={`${registerBase}&intent=buy`}>{copy.buy}</a>
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
          <div className='pc-cp-actions' style={{ marginTop: 18 }}><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market?lang=${locale}`}>{copy.openMarket}<ArrowRight size={16} aria-hidden='true' /></a></div>
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
            <a className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{copy.register}<ArrowRight size={17} aria-hidden='true' /></a>
            <a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/contact?lang=${locale}`}>{copy.contact}</a>
          </div>
        </div></div>
      </section>

      <CanonicalFooter locale={locale} />
      <CanonicalBottomNav locale={locale} active='/platform-v7' />
    </main>
  );
}
