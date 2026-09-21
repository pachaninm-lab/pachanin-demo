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
    heroKicker: 'Единый контур агросделки',
    heroTitle: 'Агросделка. От товара и цены — до результата.',
    heroLead: 'Лот и торги переходят в исполнение без разрыва: доставка, качество, документы, расчёт и закрытие остаются в одной Сделке. По каждому действию видно, кто отвечает и на чём оно основано.',
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
    lensNext: 'Следующее действие зависит от состояния Сделки и полномочий участника.',
    marketEyebrow: 'Рынок',
    marketTitle: 'Рынок',
    marketLead: 'Показываем только обезличенные лоты, разрешённые сервером к публикации. Если актуальных данных нет, интерфейс прямо об этом сообщает.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: 'Сквозная Сделка',
    dealLead: 'Сделка проходит семь этапов — от публикации лота до расчёта, закрытия или спора.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Для кого',
    groups: [
      ['Продать', 'Продавец размещает товар и ведёт исполнение до закрытия Сделки.'],
      ['Купить', 'Покупатель видит рынок, условия, исполнение, качество и документы.'],
      ['Исполнить Сделку', 'Логистика, водитель, элеватор, лаборатория и сюрвейер работают каждый в своей роли и только с доступными им данными.'],
      ['Финансы', 'Банк видит только те данные и основания, которые нужны для его шага в Сделке.'],
    ],
    rolesLabel: '9 канонических ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Сделка в работе',
    liveLead: 'В нормальной ситуации, отклонении или споре экран сразу показывает: что произошло, кто отвечает, на чём основано действие, что с расчётом и что можно делать дальше.',
    state: {
      happened: 'Показываем текущее состояние Сделки; недостающие данные не подменяем.',
      actor: 'Действовать может только участник с подтверждённой ролью и доступом.',
      basis: 'Для действия нужен подтверждённый договор, документ, событие или другое основание.',
      settlement: 'Статус расчёта приходит с сервера и меняется только по подтверждённым событиям.',
      next: 'Следующее доступное действие рассчитывает сервер с учётом роли и состояния Сделки.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие. На основе фактов',
    trustLead: 'Перед критическим действием проверяем четыре вещи: кто действует, на каком основании, откуда пришёл факт и что зафиксировано в результате.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта. Помощник по Сделке',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Возможности',
    capability: {
      market: ['Рынок', 'Обезличенные лоты, которые сервер разрешил показывать публично.'],
      trading: ['Торги', 'Ставки и выбранный контрагент остаются привязаны к конкретной Сделке.'],
      commitments: ['Обязательства', 'Условия и ответственность сторон остаются связаны с исполнением.'],
      delivery: ['Доставка', 'Роль логистики и водителя встроена в путь Сделки.'],
      acceptance: ['Приёмка и качество', 'Вес, приёмка и качество влияют на то, что можно делать дальше.'],
      documents: ['Документы', 'Документы и события не оторваны от конкретной Сделки.'],
      settlement: ['Расчёт', 'Платформа показывает подтверждённое основание, а банковское событие подтверждается отдельно.'],
      dispute: ['Спор', 'Разбираем расхождение по фактам, документам и журналу действий.'],
      trust: ['Доверие', 'Полномочия, основание, источник и решение видимы в рабочем контексте.'],
      gekta: ['Гекта', 'Помогает разобраться в фактах, рисках и следующем доступном действии.'],
      roles: ['Роли', 'Каждый участник видит только разрешённый ему рабочий контекст.'],
      history: ['История', 'События Сделки сохраняют связь с фактом, участником и основанием.'],
    },
    finalTitle: 'Начните с рынка или регистрации',
    finalText: 'Регистрация создаёт заявку на подключение. Реальные права появляются только после серверной проверки организации и полномочий.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'One agricultural Deal flow',
    heroTitle: 'The agricultural Deal. From product and price to outcome.',
    heroLead: 'From lot and trading through delivery, quality, documents, settlement and closure, the Deal stays in one workflow. Each action shows who is responsible and what permits it.',
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
    marketTitle: 'Public lots',
    marketLead: 'We show only anonymised lots approved by the server for public view. If current data is unavailable, the interface says so directly.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'Seven stages of one Deal',
    dealLead: 'The Deal moves through seven stages, from lot publication to settlement, closure or dispute.',
    whoEyebrow: 'For whom',
    whoTitle: 'One workflow for every participant',
    groups: [
      ['Sell', 'The seller lists product and manages execution through Deal closure.'],
      ['Buy', 'The buyer sees market, terms, execution, quality and documents.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor each work within their own role and permitted data.'],
      ['Finance', 'The bank sees only the data and evidence needed for its step in the Deal.'],
    ],
    rolesLabel: '9 canonical roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'Normal flow, deviation and dispute',
    liveLead: 'For a normal flow, deviation or dispute, the screen shows what happened, who is responsible, what supports the action, the settlement status and what can happen next.',
    state: {
      happened: 'The workspace shows the current Deal state and does not fill gaps with invented data.',
      actor: 'Only a participant with a confirmed role and Deal access.',
      basis: 'An action needs a confirmed contract term, document, event or other evidence.',
      settlement: 'Settlement status comes from the server and changes only on confirmed events.',
      next: 'The server determines the next available action from the Deal state and the participant role.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Authority → Basis → Source → Decision',
    trustLead: 'Before a critical action, check four things: who acts, what permits it, where the fact came from and what was recorded.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta. Your Deal assistant',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'What the platform connects',
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
      gekta: ['Gekta', 'Helps make sense of facts, risks and the next available action.'],
      roles: ['Roles', 'Each participant sees only its authorised working context.'],
      history: ['History', 'Deal events remain linked to fact, participant and basis.'],
    },
    finalTitle: 'Start with the market or registration',
    finalText: 'Registration creates a connection request. Actual rights appear only after server-side organisation and authority checks.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '统一农业交易流程',
    heroTitle: '农业交易。从商品与价格，到最终结果。',
    heroLead: '从批次和交易到交付、质量、文件、结算和关闭，整笔交易始终在同一流程中。每个操作都能看到负责人和执行依据。',
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
    marketTitle: '公开批次',
    marketLead: '只展示服务器允许公开的匿名批次。没有最新数据时，界面会直接说明。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '一笔交易的七个阶段',
    dealLead: '交易经过七个阶段：从发布批次，到结算、关闭或争议处理。',
    whoEyebrow: '面向谁',
    whoTitle: '所有参与方使用同一工作流程',
    groups: [
      ['出售', '卖方发布商品并管理履约直至交易关闭。'],
      ['购买', '买方查看市场、条件、履约、质量和文件。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构各自按角色工作，只看到获准的数据。'],
      ['金融', '银行只看到完成其交易步骤所需的数据和依据。'],
    ],
    rolesLabel: '9 个规范角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '正常流程、偏差与争议',
    liveLead: '无论正常、偏差还是争议，页面都会说明发生了什么、谁负责、操作依据、结算状态以及下一步能做什么。',
    state: {
      happened: '工作区展示当前交易状态，不用虚构数据填补空缺。',
      actor: '仅限具有已确认角色和交易访问权限的参与方。',
      basis: '操作需要已确认的合同条件、文件、事件或其他依据。',
      settlement: '结算状态由服务器提供，只随已确认事件变化。',
      next: '服务器根据交易状态和参与方角色给出可执行的下一步。',
    },
    trustEyebrow: '信任',
    trustTitle: '权限 → 依据 → 来源 → 决定',
    trustLead: '关键操作前检查四件事：谁在操作、依据是什么、事实来自哪里、结果记录了什么。',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta：交易助手',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '平台连接的工作环节',
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
      gekta: ['Gekta', '帮助理解事实、风险和下一步可执行操作。'],
      roles: ['角色', '每个参与方只看到其获授权的工作上下文。'],
      history: ['历史', '交易事件与事实、参与方和依据保持关联。'],
    },
    finalTitle: '从市场或注册开始',
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
