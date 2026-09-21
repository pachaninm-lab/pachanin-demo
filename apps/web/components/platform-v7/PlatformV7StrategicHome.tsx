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
    heroLead: 'Размести или найди лот, зафиксируй условия и веди доставку, качество, документы и расчёт в одной Сделке. На каждом этапе видно, кто отвечает, на каком основании и что делать дальше.',
    sell: 'Продать',
    buy: 'Купить',
    proof: ['Публичные лоты', '9 ролей', '7 этапов', 'Проверяемые факты'],
    lens: 'Сделка сейчас',
    lensState: 'Как устроен контур',
    lensCells: [
      ['Объект', 'Одна Сделка от лота до закрытия'],
      ['Полномочия', 'Действует только подтверждённая роль'],
      ['Состояние', 'Норма · Отклонение · Спор'],
      ['Источник', 'Факты, документы и история'],
    ],
    lensNext: 'Платформа показывает, что можно сделать дальше и у кого есть право действовать.',
    marketEyebrow: 'Рынок',
    marketTitle: 'Публичный рынок лотов',
    marketLead: 'Показываем только обезличенные лоты, подтверждённые для публикации. Если актуальных данных нет — так и пишем.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: '7 этапов одной Сделки',
    dealLead: 'От лота и торгов до доставки, качества, расчёта и закрытия — без потери контекста между этапами.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Каждому участнику — свой рабочий контур',
    groups: [
      ['Продать', 'Продавец размещает товар, получает результат торгов и ведёт исполнение до закрытия.'],
      ['Купить', 'Покупатель видит условия, ход исполнения, качество, документы и статус расчёта.'],
      ['Исполнить Сделку', 'Логистика, водитель, элеватор, лаборатория и сюрвейер работают только со своими задачами и данными.'],
      ['Финансы', 'Банк видит подтверждённые основания и финансовый контекст, доступный его роли.'],
    ],
    rolesLabel: '9 ролей в одной Сделке',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Что происходит и что делать дальше',
    liveLead: 'В одном экране видно: что случилось, кто отвечает, какое основание влияет на статус, что с расчётом и какой шаг доступен дальше.',
    state: {
      happened: 'Фактическое состояние Сделки без примерных или подставных данных.',
      actor: 'Ответственный участник с подтверждённой ролью и доступом.',
      basis: 'Условие, событие или документ, на котором основано действие.',
      settlement: 'Статус расчёта меняется только по подтверждённым основаниям.',
      next: 'Следующий шаг зависит от состояния Сделки и полномочий участника.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие начинается с проверяемых фактов',
    trustLead: 'Для важного действия видно четыре вещи: кто вправе действовать, на каком основании, откуда взят факт и какое решение принято.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта помогает понять Сделку и следующий шаг',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Всё, что нужно для исполнения Сделки',
    capability: {
      market: ['Рынок', 'Публичные обезличенные лоты с понятным входом в Сделку.'],
      trading: ['Торги', 'Результат торгов сразу остаётся связан с выбранным контрагентом и Сделкой.'],
      commitments: ['Обязательства', 'Условия и ответственность сторон не теряются после торгов.'],
      delivery: ['Доставка', 'Логистика и водитель видят свои задачи в общем контуре Сделки.'],
      acceptance: ['Приёмка и качество', 'Вес, приёмка и качество становятся основанием для дальнейших действий.'],
      documents: ['Документы', 'Документы и события остаются привязаны к конкретной Сделке.'],
      settlement: ['Расчёт', 'Платформа показывает, на каком основании доступен финансовый шаг.'],
      dispute: ['Спор', 'Отклонение или спор разбираются по фактам, документам и истории действий.'],
      trust: ['Доверие', 'Понятно, кто действовал, на каком основании и к какому решению пришли.'],
      gekta: ['Гекта', 'Собирает контекст, подсвечивает риски и объясняет доступные варианты.'],
      roles: ['Роли', 'Каждый участник видит только то, что нужно для его роли и полномочий.'],
      history: ['История', 'Сохраняется связная история фактов, участников, документов и решений.'],
    },
    finalTitle: 'Начни с рынка — или со своей роли в Сделке',
    finalText: 'Регистрация создаёт заявку на подключение. Доступ открывается после проверки организации и полномочий.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'One agricultural Deal flow',
    heroTitle: 'The agricultural Deal. From product and price to outcome.',
    heroLead: 'List or find a lot, agree terms and carry delivery, quality, documents and settlement through one Deal. At every stage you can see who acts, why, and what comes next.',
    sell: 'Sell',
    buy: 'Buy',
    proof: ['Public lots', '9 roles', '7 stages', 'Verifiable facts'],
    lens: 'Deal Lens',
    lensState: 'How the Deal is structured',
    lensCells: [
      ['Object', 'One Deal from lot to closure'],
      ['Authority', 'Only a confirmed role can act'],
      ['State', 'Normal · Deviation · Dispute'],
      ['Source', 'Facts, documents and history'],
    ],
    lensNext: 'The platform shows what can happen next and who has authority to act.',
    marketEyebrow: 'Market',
    marketTitle: 'Public lots you can actually act on',
    marketLead: 'We show only anonymised lots confirmed for public listing. If current data is unavailable, the page says so plainly.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'Seven stages of one Deal',
    dealLead: 'From lot and trading through delivery, quality, settlement and closure, the context stays connected between stages.',
    whoEyebrow: 'For whom',
    whoTitle: 'A focused workspace for every participant',
    groups: [
      ['Sell', 'The seller lists product, receives the trading result and manages execution through closure.'],
      ['Buy', 'The buyer sees terms, execution progress, quality, documents and settlement status.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor see only the tasks and data relevant to their role.'],
      ['Finance', 'The bank sees confirmed basis and the financial context available to its role.'],
    ],
    rolesLabel: '9 roles in one Deal',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'See what is happening and what to do next',
    liveLead: 'One screen answers five questions: what happened, who owns the next action, what supports the status, what it means for settlement, and what can happen next.',
    state: {
      happened: 'The actual Deal state, without sample data presented as fact.',
      actor: 'The responsible participant with confirmed role and access.',
      basis: 'The condition, event or document that supports the action.',
      settlement: 'Settlement status changes only on confirmed basis.',
      next: 'The next step follows Deal state and participant authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Trust starts with facts you can verify',
    trustLead: 'For every important action you can see who may act, what permits it, where the fact came from and what decision was recorded.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta helps you understand the Deal and the next step',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'Everything needed to execute the Deal',
    capability: {
      market: ['Market', 'Public anonymised lots with a clear path into a Deal.'],
      trading: ['Trading', 'The trading result stays tied to the selected counterparty and Deal.'],
      commitments: ['Commitments', 'Terms and responsibilities do not disappear after trading.'],
      delivery: ['Delivery', 'Logistics and drivers see their tasks inside the shared Deal flow.'],
      acceptance: ['Acceptance and quality', 'Weight, acceptance and quality become evidence for the next action.'],
      documents: ['Documents', 'Documents and events remain attached to the specific Deal.'],
      settlement: ['Settlement', 'The platform shows the basis for the next financial step.'],
      dispute: ['Dispute', 'Deviation and disputes are reviewed through facts, documents and action history.'],
      trust: ['Trust', 'You can see who acted, why, and what decision followed.'],
      gekta: ['Gekta', 'Pulls context together, highlights risks and explains available options.'],
      roles: ['Roles', 'Each participant sees only what their role and authority require.'],
      history: ['History', 'Facts, participants, documents and decisions stay connected over time.'],
    },
    finalTitle: 'Start with the market or your role in the Deal',
    finalText: 'Registration creates a connection request. Access opens after the organisation and authority are verified.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '统一农业交易流程',
    heroTitle: '农业交易。从商品与价格，到最终结果。',
    heroLead: '发布或查找批次、确认条件，并在同一笔交易中完成交付、质量、文件和结算。每个阶段都能看到谁负责、依据是什么、下一步做什么。',
    sell: '出售',
    buy: '购买',
    proof: ['公开批次', '9 个角色', '7 个阶段', '可核验事实'],
    lens: 'Deal Lens',
    lensState: '交易如何组织',
    lensCells: [
      ['对象', '从批次到关闭的一笔交易'],
      ['权限', '只有已确认角色可以操作'],
      ['状态', '正常 · 偏差 · 争议'],
      ['来源', '事实、文件与历史记录'],
    ],
    lensNext: '平台显示下一步可以做什么，以及谁有权操作。',
    marketEyebrow: '市场',
    marketTitle: '可直接了解的公开批次',
    marketLead: '只展示已确认可公开的匿名批次；如果当前没有可用数据，页面会直接说明。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '一笔交易的七个阶段',
    dealLead: '从批次和交易，到交付、质量、结算和关闭，各阶段之间的上下文始终保持连接。',
    whoEyebrow: '面向谁',
    whoTitle: '每个参与方都有清晰的工作区',
    groups: [
      ['出售', '卖方发布商品、接收交易结果并管理履约直至关闭。'],
      ['购买', '买方查看条件、履约进度、质量、文件和结算状态。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构只看到与其角色相关的任务和数据。'],
      ['金融', '银行查看已确认依据，以及其角色可访问的金融上下文。'],
    ],
    rolesLabel: '一笔交易中的 9 个角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '看清正在发生什么，以及下一步做什么',
    liveLead: '一个页面回答五个问题：发生了什么、谁负责下一步、状态依据是什么、对结算有什么影响、接下来可以做什么。',
    state: {
      happened: '展示真实交易状态，不把示例数据当成事实。',
      actor: '由具有已确认角色和访问权限的参与方负责。',
      basis: '支持该操作的条件、事件或文件。',
      settlement: '结算状态只根据已确认依据变化。',
      next: '下一步由交易状态和参与方权限决定。',
    },
    trustEyebrow: '信任',
    trustTitle: '信任来自可核验的事实',
    trustLead: '每个重要操作都能看到：谁有权操作、依据是什么、事实来自哪里、最终记录了什么决定。',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta 帮你理解交易和下一步',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '执行一笔交易所需的核心能力',
    capability: {
      market: ['市场', '公开匿名批次，并清楚进入具体交易。'],
      trading: ['交易', '交易结果始终与所选交易方和具体交易关联。'],
      commitments: ['义务', '交易结束后，条件和责任仍继续跟随履约。'],
      delivery: ['交付', '物流和司机在统一交易流程中看到自己的任务。'],
      acceptance: ['验收与质量', '重量、验收和质量成为下一步操作的依据。'],
      documents: ['文件', '文件和事件始终与具体交易保持关联。'],
      settlement: ['结算', '平台清楚展示下一金融步骤的依据。'],
      dispute: ['争议', '偏差和争议按照事实、文件和操作历史处理。'],
      trust: ['信任', '可以看到谁做了什么、依据是什么，以及最后记录了什么决定。'],
      gekta: ['Gekta', '汇总上下文、提示风险并解释可用选项。'],
      roles: ['角色', '每个参与方只看到其角色和权限所需的内容。'],
      history: ['历史', '事实、参与方、文件和决定会持续保持关联。'],
    },
    finalTitle: '从市场或你在交易中的角色开始',
    finalText: '注册会创建接入申请；机构和权限通过审核后才会开放访问。',
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
