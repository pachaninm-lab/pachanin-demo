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
import { PublicHeroMedia } from './PublicHeroMedia';

const COPY = {
  ru: {
    heroKicker: 'Платформа для агросделок',
    heroTitle: 'Продавайте и покупайте урожай. Держите сделку под контролем.',
    heroLead: 'Предложения, условия, доставка, качество, документы и расчёт — в одном рабочем пространстве.',
    sell: 'Продать урожай',
    buy: 'Купить продукцию',
    proof: ['Публичные лоты', '9 ролей', '7 этапов', 'Факты и основания'],
    lens: 'Рабочий экран сделки',
    lensState: 'Условия и следующий шаг',
    lensCells: [
      ['Условия', 'Что согласовано'],
      ['Ответственный', 'Кто выполняет задачу'],
      ['Документы', 'Основание для действия'],
      ['Дальше', 'Что нужно сделать'],
    ],
    lensNext: 'На рабочем экране участник видит свои задачи и доступные документы.',
    marketEyebrow: 'Предложения',
    marketTitle: 'Рынок продукции растениеводства',
    marketLead: 'Показываются только разрешённые к публикации обезличенные лоты. Перейдите к рынку, чтобы выбрать продукцию для продажи или закупки.',
    openMarket: 'Открыть рынок',
    dealEyebrow: 'Этапы Сделки',
    dealTitle: 'Согласовать цену — только начало',
    dealLead: 'Важно знать, что согласовано, кто отвечает за доставку, как подтверждается качество и что нужно для расчёта.',
    how: 'Как проходит сделка',
    whoEyebrow: 'Участники',
    whoTitle: 'Для кого',
    groups: [
      ['Продать', 'Разместите продукцию и согласуйте условия. Следите за исполнением сделки до расчёта и закрытия.'],
      ['Купить', 'Сравните предложения, согласуйте качество и доставку. Держите условия и документы под рукой.'],
      ['Исполнить сделку', 'Получайте задачи по доставке, хранению, приёмке или проверке качества: с ответственным, сроком и результатом.'],
      ['Финансы', 'Рассматривайте данные и документы сделки, которые участники предоставили для финансового сопровождения.'],
    ],
    groupActions: ['Предложить урожай', 'Найти продукцию', 'Подключиться к исполнению', 'Обсудить участие'],
    rolesLabel: '9 ролей',
    liveEyebrow: 'Сделка в работе',
    liveTitle: 'Условия, ответственные и следующий шаг — перед вами',
    liveLead: 'Экран сразу показывает, что произошло, кто действует, на каком основании, что с расчётом и что делать дальше.',
    state: {
      happened: 'События и изменения условий сделки',
      actor: 'Участник, ответственный за задачу',
      basis: 'Документ или согласованное условие',
      settlement: 'Условия и документы, необходимые для расчёта',
      next: 'Задача, которую нужно выполнить дальше',
    },
    trustEyebrow: 'Доверие',
    trustTitle: 'Понятно, что согласовано и кто отвечает',
    trustLead: 'Кто действует, на каком основании, откуда данные и какое решение принято — четыре вопроса к каждому важному действию.',
    gektaEyebrow: 'Помощь в сделке',
    gektaTitle: 'Разберитесь в сделке с Гектой',
    opportunitiesEyebrow: 'Возможности',
    opportunitiesTitle: 'Задачи, которые решает платформа',
    capability: {
      market: ['Рынок', 'Найдите продукцию для продажи или закупки.'],
      trading: ['Торги', 'Сравните условия и зафиксируйте результат торгов.'],
      commitments: ['Обязательства', 'Согласуйте, что и когда должна выполнить каждая сторона.'],
      delivery: ['Доставка', 'Следите за задачами логиста и водителя.'],
      acceptance: ['Приёмка и качество', 'Сопоставьте результаты приёмки с условиями сделки.'],
      documents: ['Документы', 'Работайте с документами, относящимися к вашей сделке.'],
      settlement: ['Расчёт', 'Проверьте условия и документы, необходимые для расчёта.'],
      dispute: ['Спор', 'Соберите факты и документы для разбора расхождений.'],
      trust: ['Доверие', 'Проверьте полномочия, основания и историю решений.'],
      gekta: ['Гекта', 'Обсудите вопросы по документам, качеству и следующему шагу.'],
      roles: ['Роли', 'Откройте задачи, доступные вам от имени организации.'],
      history: ['История', 'Посмотрите, что изменилось и кто принял решение.'],
    },
    finalTitle: 'Подключите организацию',
    finalText: 'Подайте заявку на доступ к платформе.',
    register: 'Подать заявку',
    contact: 'Связаться с нами',
  },
  en: {
    heroKicker: 'A platform for agricultural Deals',
    heroTitle: 'Sell and buy crops. Keep your Deal under control.',
    heroLead: 'Offers, terms, delivery, quality, documents and settlement — in one workspace.',
    sell: 'Sell crops',
    buy: 'Buy produce',
    proof: ['Public lots', '9 roles', '7 stages', 'Facts and evidence'],
    lens: 'Deal workspace',
    lensState: 'Terms and the next step',
    lensCells: [
      ['Terms', 'What is agreed'],
      ['Responsibility', 'Who owns the task'],
      ['Documents', 'The basis for an action'],
      ['Next', 'What needs to be done'],
    ],
    lensNext: 'The workspace shows each participant their tasks and accessible documents.',
    marketEyebrow: 'Offers',
    marketTitle: 'Crop market',
    marketLead: 'Only anonymised lots permitted for public publication are shown. Open the market to choose produce to sell or buy.',
    openMarket: 'Open market',
    dealEyebrow: 'Deal stages',
    dealTitle: 'Agreeing a price is only the beginning',
    dealLead: 'Know what is agreed, who handles delivery, how quality is confirmed and what is needed for settlement.',
    how: 'How the Deal works',
    whoEyebrow: 'Participants',
    whoTitle: 'Who the platform is for',
    groups: [
      ['Sell', 'List your produce and agree terms. Follow the Deal through execution, settlement and closure.'],
      ['Buy', 'Compare offers and agree quality and delivery. Keep terms and documents at hand.'],
      ['Execute the Deal', 'Work on delivery, storage, acceptance or quality tasks with clear responsibility, timing and results.'],
      ['Finance', 'Review the Deal data and documents that participants have made available for financial services.'],
    ],
    groupActions: ['Offer your crops', 'Find produce', 'Apply to provide services', 'Discuss participation'],
    rolesLabel: '9 roles',
    liveEyebrow: 'The Deal workspace',
    liveTitle: 'Terms, responsibilities and the next step in one view',
    liveLead: 'The screen shows what happened, who is responsible, the settlement status and what can happen next.',
    state: {
      happened: 'Events and changes to Deal terms',
      actor: 'The participant responsible for the task',
      basis: 'A document or agreed condition',
      settlement: 'Terms and documents needed for settlement',
      next: 'The task to complete next',
    },
    trustEyebrow: 'Trust',
    trustTitle: 'Know what is agreed and who is responsible',
    trustLead: 'Who acts, on what basis, where the data came from and which decision was made: four questions for every important action.',
    gektaEyebrow: 'Help with your Deal',
    gektaTitle: 'Work through Deal questions with Gekta',
    opportunitiesEyebrow: 'Capabilities',
    opportunitiesTitle: 'Tasks the platform helps you handle',
    capability: {
      market: ['Market', 'Find produce to sell or buy.'],
      trading: ['Trading', 'Compare terms and record the trading result.'],
      commitments: ['Commitments', 'Agree what each party must do and when.'],
      delivery: ['Delivery', 'Follow tasks assigned to logistics and the driver.'],
      acceptance: ['Acceptance and quality', 'Compare acceptance results with the agreed terms.'],
      documents: ['Documents', 'Work with documents connected to your Deal.'],
      settlement: ['Settlement', 'Check the terms and documents needed for settlement.'],
      dispute: ['Dispute', 'Gather facts and documents to review a disagreement.'],
      trust: ['Trust', 'Check permissions, supporting evidence and decision history.'],
      gekta: ['Gekta', 'Discuss questions about documents, quality and the next step.'],
      roles: ['Roles', 'Open the tasks available to you on behalf of your organisation.'],
      history: ['History', 'See what changed and who made the decision.'],
    },
    finalTitle: 'Connect your organisation',
    finalText: 'Apply for access to the platform.',
    register: 'Apply for access',
    contact: 'Contact us',
  },
  zh: {
    heroKicker: '农业交易平台',
    heroTitle: '销售与采购农产品，掌握交易进展。',
    heroLead: '报价、条款、交付、质量、文件与结算，汇集于同一工作区。',
    sell: '销售农产品',
    buy: '采购农产品',
    proof: ['公开批次', '9 个角色', '7 个阶段', '事实与依据'],
    lens: '交易工作区',
    lensState: '条款与下一步',
    lensCells: [
      ['条款', '已约定的事项'],
      ['责任分工', '谁负责该任务'],
      ['文件', '操作所依据的材料'],
      ['下一步', '接下来需要做什么'],
    ],
    lensNext: '参与方在工作区查看自己的任务及有权访问的文件。',
    marketEyebrow: '供求信息',
    marketTitle: '农产品市场',
    marketLead: '仅展示获准公开发布的匿名批次。进入市场，选择要销售或采购的产品。',
    openMarket: '打开市场',
    dealEyebrow: '交易阶段',
    dealTitle: '约定价格只是开始',
    dealLead: '了解已约定的事项、交付责任、质量确认方式，以及结算所需的条件。',
    how: '交易如何进行',
    whoEyebrow: '参与方',
    whoTitle: '适合哪些参与方',
    groups: [
      ['出售', '发布产品并约定条款，跟进履约、结算及交易关闭。'],
      ['购买', '比较报价，约定质量和交付条件，随时查看条款及文件。'],
      ['执行交易', '处理运输、仓储、验收或质量检查任务，明确负责人、期限和结果。'],
      ['金融', '查看参与方为金融服务提供的交易数据及文件。'],
    ],
    groupActions: ['提供农产品', '查找产品', '申请参与履约', '洽谈合作'],
    rolesLabel: '9 个角色',
    liveEyebrow: '交易工作区',
    liveTitle: '条款、责任分工和下一步，一目了然',
    liveLead: '页面直接显示发生了什么、谁负责、结算状态以及接下来可以做什么。',
    state: {
      happened: '交易事件和条款变更',
      actor: '负责该任务的参与方',
      basis: '文件或已约定的条件',
      settlement: '结算所需的条件及文件',
      next: '接下来需要完成的任务',
    },
    trustEyebrow: '信任',
    trustTitle: '了解已约定的事项及责任分工',
    trustLead: '谁来操作、依据是什么、数据来自哪里、作出了什么决定：每个重要操作都应回答这四个问题。',
    gektaEyebrow: '交易协助',
    gektaTitle: '与 Gekta 一起梳理交易问题',
    opportunitiesEyebrow: '功能',
    opportunitiesTitle: '平台帮助处理的任务',
    capability: {
      market: ['市场', '查找要销售或采购的农产品。'],
      trading: ['交易', '比较条款并记录交易结果。'],
      commitments: ['义务', '约定各方需要完成的事项和时间。'],
      delivery: ['交付', '跟进物流和司机的任务。'],
      acceptance: ['验收与质量', '将验收结果与约定条款进行比较。'],
      documents: ['文件', '处理与自己交易相关的文件。'],
      settlement: ['结算', '检查结算所需的条件和文件。'],
      dispute: ['争议', '收集事实和文件，以便处理分歧。'],
      trust: ['信任', '核查权限、依据和决定历史。'],
      gekta: ['Gekta', '讨论文件、质量和下一步的问题。'],
      roles: ['角色', '查看您代表机构有权处理的任务。'],
      history: ['历史', '了解发生了哪些变化，以及由谁作出决定。'],
    },
    finalTitle: '接入您的机构',
    finalText: '提交平台访问申请。',
    register: '申请接入',
    contact: '联系我们',
  },
} as const;

const GROUP_ICONS = [Wheat, Handshake, Truck, Banknote] as const;
const GROUP_INTENTS = ['sell', 'buy', 'execution', 'finance'] as const;
const ROLE_GROUP_INDEXES = [[0],[1],[2,3,4,5,6],[7,8]] as const;

export async function PlatformV7StrategicHome() {
  const locale = canonicalPublicLocale(await getLocale());
  const copy = COPY[locale];
  const registerBase = `/platform-v7/register?lang=${locale}`;

  return (
    <main className='pc-canonical-public pc-cp-page-home' data-testid='platform-v7-root-execution-cockpit'>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7' />

      <section className='pc-cp-hero' aria-labelledby='pc-cp-home-title'>
        <PublicHeroMedia />
        <div className='pc-cp-container pc-cp-hero-grid'>
          <div className='pc-cp-hero-copy'>
            <span className='pc-cp-eyebrow'>{copy.heroKicker}</span>
            <h1 id='pc-cp-home-title'>{copy.heroTitle}</h1>
            <p>{copy.heroLead}</p>
            <div className='pc-cp-actions'>
              <a className='pc-cp-button' href={`${registerBase}&intent=sell`}>{copy.sell}<ArrowRight size={17} aria-hidden='true' /></a>
              <a className='pc-cp-button pc-cp-button--secondary' href={`${registerBase}&intent=buy`}>{copy.buy}<ArrowRight size={17} aria-hidden='true' /></a>
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
          <CanonicalDealSpine locale={locale} currentIndex={null} />
          <div className='pc-cp-actions'><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{copy.how}<ArrowRight size={16} aria-hidden='true' /></a></div>
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
              return <article className='pc-cp-card pc-cp-role-card' key={title}><Icon size={22} aria-hidden='true' /><strong>{title}</strong><p>{text}</p><div className='pc-cp-role-tags'>{ROLE_GROUP_INDEXES[index]!.map((roleIndex)=><span key={CANONICAL_ROLES[locale][roleIndex]}>{CANONICAL_ROLES[locale][roleIndex]}</span>)}</div><a className='pc-cp-button pc-cp-button--secondary' href={`${registerBase}&intent=${GROUP_INTENTS[index]!}`}>{copy.groupActions[index]}<ArrowRight size={16} aria-hidden='true' /></a></article>;
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
            state={null}
            presentation='explanation'
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
