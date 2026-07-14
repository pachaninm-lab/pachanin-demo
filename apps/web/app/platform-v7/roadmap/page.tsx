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
  stagesTitle: string;
  boundaryTitle: string;
  boundary: string;
  openStatus: string;
  openDeals: string;
  stages: ReadonlyArray<Readonly<{ title: string; state: string; detail: string; criteria: readonly string[] }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Карта зрелости · Прозрачная Цена', metadataDescription: 'Этапы развития платформы, разделённые по доказательствам готовности без дат и неподтверждённых production-утверждений.',
    eyebrow: 'Roadmap по доказательствам', title: 'Следующий этап начинается только после приёмки предыдущего',
    description: 'Карта не обещает даты и не выдаёт архитектурную готовность за эксплуатационную. Каждый переход требует проверяемого кода, данных, безопасности, операций и внешних подтверждений.',
    status: 'готовность оценивается по gate', stagesTitle: 'Уровни зрелости',
    boundaryTitle: 'Граница roadmap',
    boundary: 'Слияние кода подтверждает только конкретный технический срез. Production, промышленная нагрузка, HA/DR, реальные интеграции, банковское движение денег и юридическая исполнимость подтверждаются отдельными эксплуатационными и внешними доказательствами.',
    openStatus: 'Проверить состояние системы', openDeals: 'Открыть каноническую Сделку',
    stages: [
      { title: 'Целевая архитектура', state: 'Проектируется и внедряется', detail: 'Одна Сделка, серверная роль, PostgreSQL-authority, идемпотентность, аудит, деньги, документы и доказательства.', criteria: ['Нет client-owned authority', 'Нет фиктивных live-статусов', 'Каждый модуль связан со Сделкой'] },
      { title: 'Готовность к контролируемому запуску', state: 'Требует полной приёмки', detail: 'Одна сквозная Сделка должна проходить всеми ролями с реальными серверными состояниями и операционным runbook.', criteria: ['12 ролей и RBAC', 'RU/EN/ZH и mobile', 'Ошибки, спор и восстановление'] },
      { title: 'Production', state: 'Не подтверждено', detail: 'Нужны отдельный production profile, SLO, мониторинг, безопасность, поддержка, миграции и эксплуатационные владельцы.', criteria: ['Наблюдаемость и on-call', 'Backup/PITR и DR rehearsal', 'Нагрузочная и security-приёмка'] },
      { title: 'Внешние интеграции', state: 'Не подтверждено', detail: 'Банк, ФГИС, ЭДО, ЭПД, КЭП, ERP и CRM принимаются только после договора, credentials и успешного end-to-end обмена.', criteria: ['Подпись и replay protection', 'Durable inbox/outbox', 'Callback, reconciliation и audit'] },
      { title: 'Масштабирование', state: 'После production evidence', detail: 'Рост допускается после подтверждения конкурентного доступа, очередей, деградации, восстановления и экономики.', criteria: ['Тысячи одновременных пользователей', 'Десятки тысяч активных Сделок', 'Unit economics и операционная устойчивость'] },
    ],
  },
  en: {
    metadataTitle: 'Maturity map · Transparent Price', metadataDescription: 'Evidence-gated platform stages without dates or unsupported production claims.',
    eyebrow: 'Evidence-gated roadmap', title: 'The next stage starts only after the previous one is accepted',
    description: 'The roadmap promises no dates and never treats architecture as operating evidence. Every transition requires verifiable code, data, security, operations and external confirmation.',
    status: 'readiness is gate-based', stagesTitle: 'Maturity levels',
    boundaryTitle: 'Roadmap boundary',
    boundary: 'A merged code slice proves only that technical slice. Production, industrial load, HA/DR, live integrations, bank money movement and legal enforceability require separate operating and external evidence.',
    openStatus: 'Check system status', openDeals: 'Open the canonical Deal',
    stages: [
      { title: 'Target architecture', state: 'Designed and implemented', detail: 'One Deal, server-owned role, PostgreSQL authority, idempotency, audit, money, documents and evidence.', criteria: ['No client-owned authority', 'No fabricated live states', 'Every module remains Deal-linked'] },
      { title: 'Controlled-launch readiness', state: 'Requires full acceptance', detail: 'One end-to-end Deal must pass through every role using real server states and an operating runbook.', criteria: ['12 roles and RBAC', 'RU/EN/ZH and mobile', 'Errors, dispute and recovery'] },
      { title: 'Production', state: 'Not confirmed', detail: 'Requires a production profile, SLO, monitoring, security, support, migrations and operating owners.', criteria: ['Observability and on-call', 'Backup/PITR and DR rehearsal', 'Load and security acceptance'] },
      { title: 'External integrations', state: 'Not confirmed', detail: 'Bank, grain registry, EDI, e-transport, qualified signature, ERP and CRM require a contract, credentials and successful end-to-end exchange.', criteria: ['Signature and replay protection', 'Durable inbox/outbox', 'Callback, reconciliation and audit'] },
      { title: 'Scaling', state: 'After production evidence', detail: 'Growth follows proof of concurrency, queues, degradation, recovery and economics.', criteria: ['Thousands of concurrent users', 'Tens of thousands of active Deals', 'Unit economics and operating resilience'] },
    ],
  },
  zh: {
    metadataTitle: '成熟度地图 · 透明价格', metadataDescription: '以证据 gate 划分的平台阶段，不承诺日期或未经证实的生产状态。',
    eyebrow: '证据 gate 路线图', title: '只有上一阶段验收后才进入下一阶段',
    description: '路线图不承诺日期，也不会把架构当作运营证据。每次过渡都需要可验证的代码、数据、安全、运营和外部确认。',
    status: '按 gate 评估准备度', stagesTitle: '成熟度级别',
    boundaryTitle: '路线图边界',
    boundary: '代码合并只证明具体技术切片。Production、工业负载、HA/DR、真实集成、银行资金流动和法律可执行性需要单独的运营与外部证据。',
    openStatus: '检查系统状态', openDeals: '打开规范交易',
    stages: [
      { title: '目标架构', state: '设计并实施中', detail: '一笔交易、服务器角色、PostgreSQL authority、幂等、审计、资金、单证和证据。', criteria: ['无客户端 authority', '无虚构 live 状态', '所有模块关联交易'] },
      { title: '受控启动准备度', state: '需要完整验收', detail: '一笔端到端交易必须使用真实服务器状态通过所有角色，并具备运营 runbook。', criteria: ['12 个角色与 RBAC', 'RU/EN/ZH 与移动端', '错误、争议和恢复'] },
      { title: 'Production', state: '未确认', detail: '需要 production profile、SLO、监控、安全、支持、迁移和运营负责人。', criteria: ['可观测性与 on-call', 'Backup/PITR 与 DR 演练', '负载与安全验收'] },
      { title: '外部集成', state: '未确认', detail: '银行、粮食登记、电子单证、电子运输、合格签名、ERP 和 CRM 需要合同、凭据和成功端到端交换。', criteria: ['签名与防重放', 'Durable inbox/outbox', 'Callback、对账与审计'] },
      { title: '规模化', state: '在 production evidence 之后', detail: '只有并发、队列、降级、恢复和经济性得到证明后才增长。', criteria: ['数千并发用户', '数万活跃交易', 'Unit economics 与运营韧性'] },
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

export default async function RoadmapPage() {
  const copy = COPY[localeOf(await getLocale())];
  return (
    <main className={styles.root} data-testid='platform-v7-roadmap-v8'>
      <header className={styles.hero}>
        <StatusChip tone='information'>{copy.status}</StatusChip>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.description}</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>
          <Link className={styles.link} href='/platform-v7/deals'>{copy.openDeals}</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby='maturity-stages'>
        <h2 className={styles.sectionTitle} id='maturity-stages'>{copy.stagesTitle}</h2>
        <div className={styles.stack}>
          {copy.stages.map((stage, index) => (
            <article className={styles.card} key={stage.title}>
              <StatusChip tone={index < 2 ? 'information' : 'neutral'}>{stage.state}</StatusChip>
              <h3 className={styles.cardTitle}>{stage.title}</h3>
              <p className={styles.cardText}>{stage.detail}</p>
              <ul className={styles.list}>
                {stage.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </main>
  );
}
