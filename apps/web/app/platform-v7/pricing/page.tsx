import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import styles from '../_styles/supporting-v8.module.css';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  modelsTitle: string;
  factorsTitle: string;
  boundaryTitle: string;
  boundary: string;
  request: string;
  openFlow: string;
  models: ReadonlyArray<Readonly<{ title: string; detail: string; state: string }>>;
  factors: ReadonlyArray<Readonly<{ term: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Коммерческие условия · Прозрачная Цена', metadataDescription: 'Граница коммерческой модели без вымышленных тарифов, take rate и неподтверждённых обещаний.',
    eyebrow: 'Коммерческая модель', title: 'Цена определяется объёмом исполняемого контура, а не декоративным тарифом',
    description: 'Публичные тарифы и take rate пока не утверждены. Коммерческое предложение формируется только после определения участников, GMV, глубины Сделки, интеграций, SLA и операционной ответственности.',
    status: 'условия не опубликованы', modelsTitle: 'Допустимые модели для переговоров', factorsTitle: 'Что влияет на цену',
    boundaryTitle: 'Граница коммерческого предложения',
    boundary: 'Ни одна сумма, процент или экономический эффект не считаются согласованными без подписанного предложения или договора. Экономика должна быть проверена через GMV, take rate, revenue, contribution margin, CAC, LTV и payback в Base, Conservative и Stress сценариях.',
    request: 'Запросить коммерческое предложение', openFlow: 'Посмотреть контур Сделки',
    models: [
      { title: 'Комиссия от исполненной Сделки', detail: 'Возможна, когда платформа контролирует измеримый контур исполнения и доказательства закрытия.', state: 'Не утверждено' },
      { title: 'Платформа как сервис', detail: 'Возможна для организаций с фиксированным набором ролей, объёмов и операционных функций.', state: 'Не утверждено' },
      { title: 'Корпоративное внедрение', detail: 'Отдельно оцениваются интеграции, безопасность, миграция, SLA, поддержка и изменения процессов.', state: 'Индивидуально' },
    ],
    factors: [
      { term: 'GMV и число Сделок', detail: 'Объём денежных и операционных событий, нагрузка и стоимость контроля.' },
      { term: 'Глубина исполнения', detail: 'Аукцион, логистика, приёмка, лаборатория, документы, деньги, спор и доказательства.' },
      { term: 'Роли и организации', detail: 'Число участников, tenant scope, разделение полномочий и администрирование.' },
      { term: 'Интеграции', detail: 'Банк, ФГИС, ЭДО, ЭПД, КЭП, ERP и CRM оцениваются только после подтверждения доступа.' },
      { term: 'Эксплуатация', detail: 'SLO, мониторинг, поддержка, резервирование, восстановление и требования безопасности.' },
    ],
  },
  en: {
    metadataTitle: 'Commercial terms · Transparent Price', metadataDescription: 'Commercial-model boundary without fabricated tariffs, take rates or unsupported promises.',
    eyebrow: 'Commercial model', title: 'Price follows the execution scope, not a decorative plan',
    description: 'Public tariffs and a take rate are not approved. A commercial proposal is prepared only after participants, GMV, Deal depth, integrations, SLA and operational responsibility are defined.',
    status: 'terms not published', modelsTitle: 'Models available for negotiation', factorsTitle: 'What drives price',
    boundaryTitle: 'Commercial-proposal boundary',
    boundary: 'No amount, percentage or economic effect is agreed without a signed proposal or contract. Economics must be tested through GMV, take rate, revenue, contribution margin, CAC, LTV and payback under Base, Conservative and Stress scenarios.',
    request: 'Request a commercial proposal', openFlow: 'View the Deal circuit',
    models: [
      { title: 'Fee per executed Deal', detail: 'Possible when the platform controls a measurable execution and closure-evidence circuit.', state: 'Not approved' },
      { title: 'Platform as a service', detail: 'Possible for organizations with a defined set of roles, volumes and operational functions.', state: 'Not approved' },
      { title: 'Enterprise deployment', detail: 'Integrations, security, migration, SLA, support and process changes are estimated separately.', state: 'Individual' },
    ],
    factors: [
      { term: 'GMV and Deal count', detail: 'Volume of money and operational events, load and control cost.' },
      { term: 'Execution depth', detail: 'Auction, logistics, acceptance, laboratory, documents, money, dispute and evidence.' },
      { term: 'Roles and organizations', detail: 'Participant count, tenant scope, separation of authority and administration.' },
      { term: 'Integrations', detail: 'Bank, grain registry, EDI, e-transport, qualified signature, ERP and CRM are estimated only after access is confirmed.' },
      { term: 'Operations', detail: 'SLO, monitoring, support, redundancy, recovery and security requirements.' },
    ],
  },
  zh: {
    metadataTitle: '商业条件 · 透明价格', metadataDescription: '不展示虚构套餐、take rate 或未经证实承诺的商业模型边界。',
    eyebrow: '商业模型', title: '价格取决于执行闭环范围，而不是装饰性套餐',
    description: '公开套餐和 take rate 尚未批准。只有在参与方、GMV、交易深度、集成、SLA 和运营责任明确后，才形成商业方案。',
    status: '条件未公布', modelsTitle: '可谈判的模型', factorsTitle: '价格影响因素',
    boundaryTitle: '商业方案边界',
    boundary: '未经签署的方案或合同，任何金额、比例或经济效果都不视为已同意。必须在 Base、Conservative 和 Stress 场景下通过 GMV、take rate、revenue、contribution margin、CAC、LTV 和 payback 验证经济性。',
    request: '申请商业方案', openFlow: '查看交易闭环',
    models: [
      { title: '按已执行交易收费', detail: '当平台控制可衡量的执行和关闭证据闭环时可以讨论。', state: '未批准' },
      { title: '平台服务费', detail: '适用于角色、业务量和运营功能范围明确的组织。', state: '未批准' },
      { title: '企业部署', detail: '集成、安全、迁移、SLA、支持和流程变更单独评估。', state: '单独评估' },
    ],
    factors: [
      { term: 'GMV 和交易数量', detail: '资金与运营事件量、负载和控制成本。' },
      { term: '执行深度', detail: '拍卖、物流、接收、实验室、单证、资金、争议和证据。' },
      { term: '角色和组织', detail: '参与方数量、tenant scope、权限分离和管理。' },
      { term: '集成', detail: '银行、粮食登记、电子单证、电子运输、合格签名、ERP 和 CRM 仅在访问确认后评估。' },
      { term: '运营', detail: 'SLO、监控、支持、冗余、恢复和安全要求。' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function PricingPage() {
  const copy = COPY[localeOf(await getLocale())];
  return (
    <main className={styles.root} data-testid='platform-v7-pricing-v8'>
      <header className={styles.hero}>
        <StatusChip tone='warning'>{copy.status}</StatusChip>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.description}</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href='/platform-v7/request'>{copy.request}</Link>
          <Link className={styles.link} href='/platform-v7/deal-flow'>{copy.openFlow}</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby='pricing-models'>
        <h2 className={styles.sectionTitle} id='pricing-models'>{copy.modelsTitle}</h2>
        <div className={styles.gridThree}>
          {copy.models.map((model) => (
            <article className={styles.card} key={model.title}>
              <StatusChip tone='neutral'>{model.state}</StatusChip>
              <h3 className={styles.cardTitle}>{model.title}</h3>
              <p className={styles.cardText}>{model.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby='pricing-factors'>
        <h2 className={styles.sectionTitle} id='pricing-factors'>{copy.factorsTitle}</h2>
        <dl className={styles.meta}>
          {copy.factors.map((factor) => (
            <div className={styles.metaItem} key={factor.term}>
              <dt>{factor.term}</dt>
              <dd>{factor.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </main>
  );
}
