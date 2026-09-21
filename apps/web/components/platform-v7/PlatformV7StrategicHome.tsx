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
    heroLead: 'Веди Сделку от лота и торгов до доставки, качества, документов и расчёта в одном контуре — чтобы видеть, кто отвечает, на каком основании и что делать дальше.',
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
    marketTitle: 'Рынок с подтверждёнными данными',
    marketLead: 'Смотри только опубликованные обезличенные лоты из подтверждённой серверной проекции — без подмены примерными данными.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: 'Семь этапов. Один рабочий контур.',
    dealLead: 'От лота до закрытия каждый этап связан с ответственным участником, основанием, фактом и следующим допустимым действием.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Каждому участнику — свой рабочий контекст',
    groups: [
      ['Продать', 'Размещай товар, отслеживай исполнение и веди Сделку до закрытия в одном рабочем контуре.'],
      ['Купить', 'Смотри рынок и контролируй условия, исполнение, качество и документы по одной Сделке.'],
      ['Исполнить Сделку', 'Логистика, водитель, элеватор, лаборатория и сюрвейер видят свой этап, ответственность и допустимые действия.'],
      ['Финансы', 'Банк получает подтверждённый контекст и основание для финансового шага.'],
    ],
    rolesLabel: '9 канонических ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Понимай, что происходит и кто должен действовать дальше',
    liveLead: 'Норма, отклонение или спор — рабочий контекст показывает, что произошло, кто отвечает, на каком основании и какой следующий шаг допустим.',
    state: {
      happened: 'Рабочий экран показывает фактическое состояние без подмены серверных данных.',
      actor: 'Только участник с подтверждённой ролью и доступом к Сделке.',
      basis: 'Условия, событие, документ или иное подтверждённое основание.',
      settlement: 'Финансовый статус не выбирается клиентом и зависит от подтверждённых оснований.',
      next: 'Доступное действие определяется серверным контекстом и полномочиями.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие, которое можно проверить',
    trustLead: 'Полномочия, основание, источник и решение помогают понять, почему действие допустимо и на чём оно основано.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта. Быстрее понять контекст и следующий шаг',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Ключевые этапы исполнения — в одном контуре',
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
    finalTitle: 'Начни с рынка или своей роли в Сделке',
    finalText: 'Подай заявку на подключение. После проверки организации и полномочий откроется рабочий контекст, доступный твоей роли.',
    register: 'Подать заявку',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'One agricultural Deal flow',
    heroTitle: 'The agricultural Deal. From product and price to outcome.',
    heroLead: 'Run the Deal from lot and trading through delivery, quality, documents and settlement in one flow — with clear responsibility, evidence and the next permitted action.',
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
    marketTitle: 'Market with confirmed data',
    marketLead: 'See only published anonymised lots from the confirmed server projection — never sample data presented as current.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'Seven stages. One working flow.',
    dealLead: 'From lot to closure, each stage stays tied to the responsible participant, basis, fact and next permitted action.',
    whoEyebrow: 'For whom',
    whoTitle: 'A focused working context for every participant',
    groups: [
      ['Sell', 'List product, track execution and carry the Deal through closure in one working flow.'],
      ['Buy', 'See the market and keep terms, execution, quality and documents connected to one Deal.'],
      ['Execute the Deal', 'Logistics, driver, elevator, laboratory and surveyor see their stage, responsibility and permitted actions.'],
      ['Finance', 'The bank receives confirmed context and basis for the financial step.'],
    ],
    rolesLabel: '9 canonical roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'Know what is happening and who acts next',
    liveLead: 'Normal, deviation or dispute — the working context shows what happened, who is responsible, the basis and the next permitted step.',
    state: {
      happened: 'The workspace shows actual state without replacing server data.',
      actor: 'Only a participant with a confirmed role and Deal access.',
      basis: 'Terms, event, document or another confirmed basis.',
      settlement: 'Financial state is not client-selected and depends on confirmed basis.',
      next: 'Available action follows server context and authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Trust you can verify',
    trustLead: 'Authority, basis, source and decision make it clear why an action is permitted and what supports it.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta. Understand context and next steps faster',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'Key execution stages in one flow',
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
    finalText: 'Submit a connection request. After organisation and authority checks, your authorised working context becomes available.',
    register: 'Request access',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '统一农业交易流程',
    heroTitle: '农业交易。从商品与价格，到最终结果。',
    heroLead: '从批次和交易到交付、质量、文件与结算，在同一流程中推进交易——清楚看到谁负责、依据是什么、下一步允许做什么。',
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
    marketTitle: '基于已确认数据的市场',
    marketLead: '只查看来自服务器已确认公开投影的匿名批次，不用示例数据冒充当前状态。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '七个阶段，一个工作流程',
    dealLead: '从批次到关闭，每个阶段都与责任参与方、依据、事实和允许的下一步保持关联。',
    whoEyebrow: '面向谁',
    whoTitle: '每个参与方都有自己的工作上下文',
    groups: [
      ['出售', '发布商品、跟踪履约，并在同一工作流程中推进交易直至关闭。'],
      ['购买', '查看市场，并让条件、履约、质量和文件始终关联在同一笔交易中。'],
      ['执行交易', '物流、司机、粮库、实验室和检验机构清楚看到自己的阶段、责任和允许的操作。'],
      ['金融', '银行获得已确认的上下文和金融步骤依据。'],
    ],
    rolesLabel: '9 个规范角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '随时知道发生了什么，以及下一步由谁处理',
    liveLead: '无论正常、偏差还是争议，工作上下文都会说明发生了什么、谁负责、依据是什么以及下一步允许做什么。',
    state: {
      happened: '工作空间展示真实状态，不替换服务器数据。',
      actor: '仅限具有已确认角色和交易访问权限的参与方。',
      basis: '条件、事件、文件或其他已确认依据。',
      settlement: '金融状态不能由客户端选择，只取决于已确认依据。',
      next: '可执行操作由服务器上下文和权限决定。',
    },
    trustEyebrow: '信任',
    trustTitle: '可验证的信任',
    trustLead: '权限、依据、来源和决定让你清楚知道某个操作为什么被允许、依据来自哪里。',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta：更快理解上下文和下一步',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '关键履约阶段集中在一个流程中',
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
    finalText: '提交接入申请。机构与权限审核通过后，即可进入与你角色对应的工作上下文。',
    register: '申请接入',
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
