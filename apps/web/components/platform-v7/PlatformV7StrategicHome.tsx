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
    heroKicker: 'Агросделка в одном рабочем контуре',
    heroTitle: 'От лота и цены — до закрытия Сделки.',
    heroLead: 'Лот, торги, доставка, качество, документы и расчёт идут по одной Сделке. Видно, кто отвечает за действие, на каком основании оно доступно и что происходит дальше.',
    sell: 'Продать',
    buy: 'Купить',
    proof: ['Опубликованные лоты', '9 ролей', '7 этапов', 'Проверяемые основания'],
    lens: 'Карточка Сделки',
    lensState: 'Структура Сделки',
    lensCells: [
      ['Объект', 'Одна Сделка от начала до закрытия'],
      ['Полномочия', 'Только подтверждённые роли'],
      ['Состояние', 'Норма · Отклонение · Спор'],
      ['Данные', 'Факты и документы по Сделке'],
    ],
    lensNext: 'Следующее действие доступно только при подходящем статусе Сделки и полномочиях участника.',
    marketEyebrow: 'Рынок',
    marketTitle: 'Рынок',
    marketLead: 'Показываем только обезличенные лоты, которые сервер разрешил публиковать. Если свежих данных нет, прямо сообщаем об этом.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Как проходит Сделка',
    dealTitle: 'Семь этапов Сделки',
    dealLead: 'Лот, торги, обязательства, доставка, приёмка, расчёт и закрытие идут в одной последовательности.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Участники Сделки',
    groups: [
      ['Продать', 'Продавец публикует товар, принимает результат торгов и ведёт Сделку до закрытия.'],
      ['Купить', 'Покупатель видит условия, ход исполнения, качество и документы по выбранной Сделке.'],
      ['Исполнить Сделку', 'Логист, водитель, элеватор, лаборатория и сюрвейер получают только свои задачи и данные.'],
      ['Финансы', 'Банк видит только подтверждённые основания и данные, необходимые для финансового шага.'],
    ],
    rolesLabel: '9 канонических ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Что происходит со Сделкой сейчас',
    liveLead: 'На одном экране видно событие, ответственного, основание, статус расчёта и действие, которое доступно сейчас.',
    state: {
      happened: 'Показываем только подтверждённые данные Сделки.',
      actor: 'Действие доступно участнику, чья роль и доступ подтверждены сервером.',
      basis: 'Условия Сделки, документ или зафиксированное событие.',
      settlement: 'Статус расчёта приходит из подтверждённых данных и не задаётся в интерфейсе.',
      next: 'Система показывает только действие, разрешённое текущим статусом и полномочиями.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Почему данным можно доверять',
    trustLead: 'Для важного действия можно проверить четыре вещи: кто действовал, на каком основании, откуда пришёл факт и какое решение зафиксировано.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта помогает разобраться в Сделке',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Возможности',
    capability: {
      market: ['Рынок', 'Опубликованные обезличенные лоты с переходом к торгам.'],
      trading: ['Торги', 'Ставки и результат торгов остаются внутри выбранной Сделки.'],
      commitments: ['Обязательства', 'Условия сторон остаются связаны с дальнейшим исполнением.'],
      delivery: ['Доставка', 'Логист и водитель работают в рамках конкретной Сделки.'],
      acceptance: ['Приёмка и качество', 'Результаты приёмки и качества меняют доступные действия.'],
      documents: ['Документы', 'Каждый документ привязан к Сделке и её событию.'],
      settlement: ['Расчёт', 'Основание для расчёта видно в Сделке; само финансовое событие подтверждает внешний источник.'],
      dispute: ['Спор', 'Разбор идёт по документам, событиям и журналу действий.'],
      trust: ['Доверие', 'По ключевому действию видны полномочия, основание, источник и решение.'],
      gekta: ['Гекта', 'Объясняет данные и риски, но не принимает критические решения.'],
      roles: ['Роли', 'Каждый участник видит только разрешённые ему данные и действия.'],
      history: ['История', 'Событие остаётся связано с участником, документом и основанием.'],
    },
    finalTitle: 'Начни с рынка или своей роли в Сделке',
    finalText: 'Регистрация создаёт заявку на подключение. Доступ появляется после проверки организации и полномочий.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'One working flow for the agricultural Deal',
    heroTitle: 'From lot and price to Deal closure.',
    heroLead: 'Lot, trading, delivery, quality, documents and settlement stay in one Deal. You can see who is responsible, why an action is available and what happens next.',
    sell: 'Sell',
    buy: 'Buy',
    proof: ['Published lots', '9 roles', '7 stages', 'Verifiable basis'],
    lens: 'Карточка Сделки',
    lensState: 'Deal structure',
    lensCells: [
      ['Object', 'One end-to-end Deal'],
      ['Authority', 'Confirmed role only'],
      ['State', 'Normal · Deviation · Dispute'],
      ['Source', 'Connected facts and documents'],
    ],
    lensNext: 'The next action is available only when the Deal state and participant authority allow it.',
    marketEyebrow: 'Market',
    marketTitle: 'Published market lots',
    marketLead: 'We show only anonymised lots approved by the server for publication. If current data is unavailable, the page says so plainly.',
    openMarket: 'Open market',
    dealEyebrow: 'How the Deal works',
    dealTitle: 'Seven stages of the Deal',
    dealLead: 'Lot, trading, commitments, delivery, acceptance, settlement and closure follow one sequence.',
    whoEyebrow: 'For whom',
    whoTitle: 'Deal participants',
    groups: [
      ['Sell', 'The seller lists product and manages execution through Deal closure.'],
      ['Buy', 'The buyer sees market, terms, execution, quality and documents.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor work in their own authorised context.'],
      ['Finance', 'The bank works only with confirmed basis and the context available to it.'],
    ],
    rolesLabel: '9 canonical roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'What is happening in the Deal now',
    liveLead: 'One view shows the event, responsible party, basis, settlement status and the action available now.',
    state: {
      happened: 'The workspace shows actual state without replacing server data.',
      actor: 'Only a participant with a confirmed role and Deal access.',
      basis: 'Terms, event, document or another confirmed basis.',
      settlement: 'Financial state is not client-selected and depends on confirmed basis.',
      next: 'Available action follows server context and authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Why the data can be trusted',
    trustLead: 'For any important action you can check who acted, why it was allowed, where the fact came from and what decision was recorded.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta helps you understand the Deal',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'What the platform connects',
    capability: {
      market: ['Market', 'Public anonymised lots and a safe entry into trading.'],
      trading: ['Trading', 'Counterparty selection and trading outcome remain in Deal context.'],
      commitments: ['Commitments', 'Terms and responsibilities stay connected to execution.'],
      delivery: ['Delivery', 'Logistics and driver roles are part of the Deal path.'],
      acceptance: ['Acceptance and quality', 'Acceptance and quality results change which actions are available.'],
      documents: ['Documents', 'Documents and events stay tied to the specific Deal.'],
      settlement: ['Settlement', 'The platform shows basis; the financial event remains externally confirmed.'],
      dispute: ['Dispute', 'Exceptions are reviewed using connected facts, evidence and the action log.'],
      trust: ['Trust', 'Authority, basis, source and decision remain visible in context.'],
      gekta: ['Gekta', 'Explains the data and risks but does not make critical decisions.'],
      roles: ['Roles', 'Each participant sees only the data and actions allowed for the confirmed role.'],
      history: ['History', 'Deal events remain linked to fact, participant and basis.'],
    },
    finalTitle: 'Start with the market or your role in the Deal',
    finalText: 'Registration creates a connection request. Access appears after the organisation and authority checks are complete.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '一笔农业交易，一个工作流程',
    heroTitle: '从批次和价格，到交易关闭。',
    heroLead: '批次、交易、交付、质量、文件和结算都在同一笔交易中。参与方可以看到责任人、操作依据和当前下一步。',
    sell: '出售',
    buy: '购买',
    proof: ['真实公开批次', '9 个角色', '7 个阶段', '事实与依据'],
    lens: 'Карточка Сделки',
    lensState: '交易结构',
    lensCells: [
      ['对象', '一笔端到端交易'],
      ['权限', '仅限已确认角色'],
      ['状态', '正常 · 偏差 · 争议'],
      ['来源', '关联事实和文件'],
    ],
    lensNext: '下一步由交易状态和参与方权限决定。',
    marketEyebrow: '市场',
    marketTitle: '已发布的市场批次',
    marketLead: '只展示服务器批准公开的匿名批次。当前数据不可用时，页面会直接说明。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '交易的七个阶段',
    dealLead: '各阶段不是彼此孤立的页面：每一步都与责任参与方、依据、事实来源和结算影响关联。',
    whoEyebrow: '面向谁',
    whoTitle: '交易参与方',
    groups: [
      ['出售', '卖方发布商品并管理履约直至交易关闭。'],
      ['购买', '买方查看市场、条件、履约、质量和文件。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构在各自授权上下文中工作。'],
      ['金融', '银行仅处理已确认依据及其获准查看的上下文。'],
    ],
    rolesLabel: '9 个规范角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '交易现在处于什么状态',
    liveLead: '关键状态回答五个问题：发生了什么、谁处理、依据是什么、结算如何受影响、下一步允许做什么。',
    state: {
      happened: '工作空间展示真实状态，不替换服务器数据。',
      actor: '仅限具有已确认角色和交易访问权限的参与方。',
      basis: '条件、事件、文件或其他已确认依据。',
      settlement: '金融状态不能由客户端选择，只取决于已确认依据。',
      next: '可执行操作由服务器上下文和权限决定。',
    },
    trustEyebrow: '信任',
    trustTitle: '为什么这些数据可信',
    trustLead: '这一顺序统一适用于市场、交易履约、文件、金融步骤和异常处理。',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta 帮你看懂交易',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '平台连接的环节',
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
