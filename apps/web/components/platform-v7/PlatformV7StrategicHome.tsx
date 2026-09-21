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
    heroKicker: 'Сделка под контролем — от цены до закрытия',
    heroTitle: 'Вся агросделка — в одном рабочем контуре.',
    heroLead: 'Рынок, обязательства, доставка, качество, документы и расчёт связаны в одной Сделке. Вы видите, что подтверждено, кто отвечает и какой следующий шаг допустим — меньше ручной сверки, меньше неопределённости, больше контроля.',
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
    marketTitle: 'Рынок с проверяемой актуальностью',
    marketLead: 'Смотрите опубликованные обезличенные лоты и сразу понимайте, какие данные подтверждены сейчас. Если актуальность не доказана сервером, платформа не выдаёт её за факт.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Сквозная Сделка',
    dealTitle: 'Одна Сделка вместо разрозненных процессов',
    dealLead: 'Семь этапов связаны с ответственными, основаниями и влиянием на расчёт — чтобы не собирать контекст сделки по отдельным чатам, таблицам и документам.',
    whoEyebrow: 'Для кого',
    whoTitle: 'Для кого',
    groups: [
      ['Продать', 'Разместить товар, зафиксировать условия и вести исполнение до закрытия Сделки в одном контексте.'],
      ['Купить', 'Быстро понять рынок, условия, качество, документы и фактический статус исполнения.'],
      ['Исполнить Сделку', 'Каждый исполнитель видит свой контекст, подтверждённое основание и допустимый следующий шаг.'],
      ['Финансы', 'Финансовый контекст открывается только по подтверждённым основаниям — без клиентского выбора итогового статуса.'],
    ],
    rolesLabel: '9 канонических ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Рабочий контекст без догадок',
    liveLead: 'За несколько секунд понятно пять вещей: что произошло, кто отвечает, на каком основании, что происходит с расчётом и какой следующий шаг допустим.',
    state: {
      happened: 'Рабочий экран показывает фактическое состояние без подмены серверных данных.',
      actor: 'Только участник с подтверждённой ролью и доступом к Сделке.',
      basis: 'Условия, событие, документ или иное подтверждённое основание.',
      settlement: 'Финансовый статус не выбирается клиентом и зависит от подтверждённых оснований.',
      next: 'Доступное действие определяется серверным контекстом и полномочиями.',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Доверие, которое можно проверить',
    trustLead: 'Полномочия, основание, источник и решение остаются видимыми в одном порядке — от рынка и исполнения до документов, финансового шага и спора.',
    gektaEyebrow: 'Гекта',
    gektaTitle: 'Гекта. Быстрее понять контекст и не пропустить риск',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Один контур вместо разрозненных сервисов',
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
    finalTitle: 'Начните с рынка — или сразу со своей роли в Сделке',
    finalText: 'Регистрация создаёт заявку на подключение. После серверной проверки организации и полномочий открывается рабочий контекст вашей роли — без ручного выбора доступа на клиенте.',
    register: 'Регистрация',
    contact: 'Контакты',
  },
  en: {
    heroKicker: 'Control the Deal from price to closure',
    heroTitle: 'The whole agricultural Deal in one working flow.',
    heroLead: 'Market, commitments, delivery, quality, documents and settlement stay connected in one Deal. You can see what is confirmed, who is responsible and which next step is permitted — less manual reconciliation, less uncertainty, more control.',
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
    marketTitle: 'A market with verifiable freshness',
    marketLead: 'Review published anonymised lots and immediately see what is confirmed now. If freshness is not established by the server, the platform does not present it as fact.',
    openMarket: 'Open market',
    dealEyebrow: 'End-to-end Deal',
    dealTitle: 'One Deal instead of disconnected processes',
    dealLead: 'Seven stages stay tied to owners, evidence and settlement impact, so Deal context does not have to be rebuilt across separate chats, spreadsheets and documents.',
    whoEyebrow: 'For whom',
    whoTitle: 'One design language for every participant',
    groups: [
      ['Sell', 'List product, fix the terms and manage execution through Deal closure in one context.'],
      ['Buy', 'Understand the market, terms, quality, documents and actual execution status faster.'],
      ['Execute the Deal', 'Each executor sees its authorised context, confirmed basis and the permitted next step.'],
      ['Finance', 'Financial context opens only on confirmed basis; final financial state is never client-selected.'],
    ],
    rolesLabel: '9 canonical roles',
    liveEyebrow: 'Deal in progress',
    liveTitle: 'Working context without guesswork',
    liveLead: 'In seconds, the workspace answers five questions: what happened, who owns the action, on what basis, what happens to settlement and which next step is permitted.',
    state: {
      happened: 'The workspace shows actual state without replacing server data.',
      actor: 'Only a participant with a confirmed role and Deal access.',
      basis: 'Terms, event, document or another confirmed basis.',
      settlement: 'Financial state is not client-selected and depends on confirmed basis.',
      next: 'Available action follows server context and authority.',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Trust you can verify',
    trustLead: 'Authority, basis, source and decision stay visible in the same order across market, execution, documents, the financial step and disputes.',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta. Understand context faster and catch risk earlier',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'One flow instead of disconnected services',
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
    finalText: 'Registration creates a connection request. After server-side organisation and authority checks, the working context for your role becomes available without client-side access selection.',
    register: 'Register',
    contact: 'Contact',
  },
  zh: {
    heroKicker: '从价格到关闭，全程掌控交易',
    heroTitle: '整笔农业交易，在一个工作流程中完成。',
    heroLead: '市场、义务、交付、质量、文件和结算都连接在同一笔交易中。您可以看到哪些事实已确认、谁负责，以及允许的下一步是什么——减少人工核对，降低不确定性，提升控制力。',
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
    marketTitle: '可验证时效性的市场',
    marketLead: '查看已发布的匿名批次，并立即判断哪些信息当前已被确认。若服务器无法证明时效性，平台不会把它当作事实展示。',
    openMarket: '打开市场',
    dealEyebrow: '端到端交易',
    dealTitle: '一笔交易，替代分散的流程',
    dealLead: '七个阶段始终与责任方、依据和结算影响关联，无需再从聊天、表格和文件中重新拼接交易上下文。',
    whoEyebrow: '面向谁',
    whoTitle: '所有参与方使用同一套设计语言',
    groups: [
      ['出售', '发布商品、固定条件，并在同一上下文中管理履约直至交易关闭。'],
      ['购买', '更快了解市场、条件、质量、文件以及实际履约状态。'],
      ['执行交易', '每个执行方只看到其授权上下文、已确认依据和允许的下一步。'],
      ['金融', '只有在依据已确认时才开放金融上下文；最终金融状态不能由客户端选择。'],
    ],
    rolesLabel: '9 个规范角色',
    liveEyebrow: '进行中的交易',
    liveTitle: '无需猜测的工作上下文',
    liveLead: '几秒钟内即可回答五个问题：发生了什么、谁负责、依据是什么、结算如何受影响，以及允许的下一步是什么。',
    state: {
      happened: '工作空间展示真实状态，不替换服务器数据。',
      actor: '仅限具有已确认角色和交易访问权限的参与方。',
      basis: '条件、事件、文件或其他已确认依据。',
      settlement: '金融状态不能由客户端选择，只取决于已确认依据。',
      next: '可执行操作由服务器上下文和权限决定。',
    },
    trustEyebrow: '信任',
    trustTitle: '可验证的信任',
    trustLead: '权限、依据、来源和决定始终按同一顺序可见，贯穿市场、履约、文件、金融步骤和争议处理。',
    gektaEyebrow: 'Gekta',
    gektaTitle: 'Gekta：更快理解上下文，更早发现风险',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '一个流程，替代分散的服务',
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
    finalText: '注册会创建接入申请。服务器完成机构与权限审核后，将开放与您角色对应的工作上下文，无需在客户端手动选择访问权限。',
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
