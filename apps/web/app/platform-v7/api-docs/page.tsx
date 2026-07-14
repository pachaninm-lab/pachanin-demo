import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  priorityTitle: string;
  priorityDescription: string;
  priorityBlocker: string;
  priorityImpact: string;
  priorityResult: string;
  ownerValue: string;
  openConnectors: string;
  openDeals: string;
  contractSection: string;
  controlsSection: string;
  boundaryTitle: string;
  boundary: string;
  values: Readonly<{
    sourceControlled: string;
    notConfirmed: string;
    serverOnly: string;
    required: string;
    documented: string;
  }>;
  facts: Readonly<{
    contract: string;
    contractHint: string;
    publication: string;
    publicationHint: string;
    credentials: string;
    credentialsHint: string;
    dealBoundary: string;
    dealBoundaryHint: string;
  }>;
  contractItems: ReadonlyArray<Readonly<{ title: string; detail: string }>>;
  controlItems: ReadonlyArray<Readonly<{ title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Партнёрский API · Прозрачная Цена',
    metadataDescription: 'Документированный контракт партнёрского API без фиктивных ключей, подключений и production-утверждений.',
    eyebrow: 'Партнёрский API',
    title: 'Контракт API не равен подключённому партнёру',
    description: 'Экран фиксирует границу интеграции: что описано в исходном OpenAPI-контракте и какие доказательства нужны до доступа к данным и действиям конкретной Сделки.',
    statusLabel: 'контракт задокументирован',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная интеграционная задача', factsSection: 'Подтверждённые факты',
    priorityTitle: 'Подтвердить внешний контур до выдачи доступа',
    priorityDescription: 'Наличие OpenAPI-файла не доказывает опубликованный endpoint, действующий ключ, разрешённый scope, доставку webhook или production-SLA.',
    priorityBlocker: 'нет подтверждённого end-to-end обмена с конкретным партнёром',
    priorityImpact: 'несанкционированный доступ, повтор события или действие вне границ Сделки',
    priorityResult: 'проверенный партнёрский контур с минимальными правами и полным аудитом',
    ownerValue: 'Владелец интеграции / безопасность',
    openConnectors: 'Проверить интеграционные контуры', openDeals: 'Открыть реестр Сделок',
    contractSection: 'Что зафиксировано в контракте', controlsSection: 'Что обязательно до подключения',
    boundaryTitle: 'Граница доказательства',
    boundary: 'Этот экран не создаёт API-ключи, не показывает секреты, не активирует webhook и не подтверждает production-доступность. Доступ партнёра считается действующим только после серверной выдачи и отзыва credentials, Deal-scoped авторизации, проверки подписи и replay-защиты, durable inbox/outbox, rate limits, audit trail, мониторинга и успешного внешнего обмена.',
    values: { sourceControlled: 'В кодовой базе', notConfirmed: 'Не подтверждено', serverOnly: 'Только сервер', required: 'Обязательно', documented: 'Задокументировано' },
    facts: {
      contract: 'Спецификация', contractHint: 'OpenAPI 3.0.3; версия контракта 3.0.0 в apps/api/openapi.yaml',
      publication: 'Публичный endpoint', publicationHint: 'не подтверждён этим экраном или репозиторным файлом',
      credentials: 'Партнёрские credentials', credentialsHint: 'не создаются и не хранятся в браузере',
      dealBoundary: 'Граница доступа', dealBoundaryHint: 'конкретная Сделка, tenant, роль и минимальный scope',
    },
    contractItems: [
      { title: 'Формат контракта', detail: 'Исходная спецификация использует OpenAPI 3.0.3 и версию контракта 3.0.0.' },
      { title: 'Схемы авторизации', detail: 'В контракте объявлены Bearer JWT и X-Api-Key. Объявление схемы не доказывает выдачу или работоспособность credentials.' },
      { title: 'Денежные значения', detail: 'Для денежных операций канонической единицей остаются целые minor units. Float не может быть источником истины.' },
      { title: 'Системные методы', detail: 'Health, readiness, metrics и version описаны как технические методы. Они не подтверждают доступность внешнего партнёрского контура.' },
    ],
    controlItems: [
      { title: 'Deal-scoped авторизация', detail: 'Каждый запрос проверяет tenant, участника, роль, ресурс и разрешённое действие по конкретной Сделке.' },
      { title: 'Жизненный цикл credentials', detail: 'Выдача, хранение хэша, ротация, отзыв, срок действия и последний факт использования находятся только на сервере.' },
      { title: 'Webhook и callback', detail: 'Подпись, timestamp, nonce, replay-защита, durable inbox, идемпотентность и ручная проверка обязательны.' },
      { title: 'Ограничения и наблюдаемость', detail: 'Rate limits, correlation ID, журнал аудита, метрики, алерты и reconciliation должны быть проверяемыми.' },
      { title: 'Production-допуск', detail: 'Нужны договор, доступы, внешний обмен, эксплуатационные evidence, SLO и процедура отзыва без остановки Сделки.' },
    ],
  },
  en: {
    metadataTitle: 'Partner API · Transparent Price',
    metadataDescription: 'A documented partner API contract without fake keys, connections or production claims.',
    eyebrow: 'Partner API', title: 'An API contract is not a connected partner',
    description: 'This workspace defines the integration boundary: what is documented in the source-controlled OpenAPI contract and what evidence is required before access to a specific Deal.',
    statusLabel: 'contract documented',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary integration task', factsSection: 'Confirmed facts',
    priorityTitle: 'Verify the external circuit before granting access',
    priorityDescription: 'An OpenAPI file does not prove a published endpoint, active key, permitted scope, webhook delivery or a production SLA.',
    priorityBlocker: 'no confirmed end-to-end exchange with a specific partner',
    priorityImpact: 'unauthorized access, replayed events or an action outside the Deal boundary',
    priorityResult: 'a verified partner circuit with least privilege and complete auditability',
    ownerValue: 'Integration owner / security',
    openConnectors: 'Review integration circuits', openDeals: 'Open Deal registry',
    contractSection: 'What the contract documents', controlsSection: 'Required before connection',
    boundaryTitle: 'Evidence boundary',
    boundary: 'This screen does not create API keys, display secrets, activate webhooks or confirm production availability. Partner access is active only after server-side credential issuance and revocation, Deal-scoped authorization, signature and replay verification, durable inbox/outbox, rate limits, audit trail, monitoring and a successful external exchange.',
    values: { sourceControlled: 'Source-controlled', notConfirmed: 'Not confirmed', serverOnly: 'Server only', required: 'Required', documented: 'Documented' },
    facts: {
      contract: 'Specification', contractHint: 'OpenAPI 3.0.3; contract version 3.0.0 in apps/api/openapi.yaml',
      publication: 'Public endpoint', publicationHint: 'not proven by this screen or the repository file',
      credentials: 'Partner credentials', credentialsHint: 'never created or stored in the browser',
      dealBoundary: 'Access boundary', dealBoundaryHint: 'specific Deal, tenant, role and least-privilege scope',
    },
    contractItems: [
      { title: 'Contract format', detail: 'The source specification uses OpenAPI 3.0.3 and contract version 3.0.0.' },
      { title: 'Authorization schemes', detail: 'Bearer JWT and X-Api-Key are declared. A declared scheme does not prove credential issuance or operation.' },
      { title: 'Money values', detail: 'Integer minor units remain canonical for money operations. Float cannot be an authority.' },
      { title: 'System methods', detail: 'Health, readiness, metrics and version are documented as technical methods. They do not prove an external partner circuit.' },
    ],
    controlItems: [
      { title: 'Deal-scoped authorization', detail: 'Every request verifies tenant, participant, role, resource and permitted action for a specific Deal.' },
      { title: 'Credential lifecycle', detail: 'Issuance, hash storage, rotation, revocation, expiry and last-use evidence remain server-side.' },
      { title: 'Webhook and callback', detail: 'Signature, timestamp, nonce, replay protection, durable inbox, idempotency and manual review are mandatory.' },
      { title: 'Limits and observability', detail: 'Rate limits, correlation ID, audit log, metrics, alerts and reconciliation must be verifiable.' },
      { title: 'Production admission', detail: 'Contract, access, external exchange, operational evidence, SLO and a non-disruptive revocation procedure are required.' },
    ],
  },
  zh: {
    metadataTitle: '合作伙伴 API · 透明价格',
    metadataDescription: '已记录的合作伙伴 API 合同，不伪造密钥、连接或生产声明。',
    eyebrow: '合作伙伴 API', title: 'API 合同不等于合作伙伴已连接',
    description: '此工作区明确集成边界：源代码管理的 OpenAPI 合同记录了什么，以及在访问具体交易前需要哪些证据。',
    statusLabel: '合同已记录',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要集成任务', factsSection: '已确认事实',
    priorityTitle: '授权前验证外部闭环',
    priorityDescription: 'OpenAPI 文件不能证明 endpoint 已发布、密钥有效、scope 已授权、webhook 已送达或存在生产 SLA。',
    priorityBlocker: '尚无与具体合作伙伴完成的端到端交换证明',
    priorityImpact: '未授权访问、事件重放或在交易边界之外执行操作',
    priorityResult: '具有最小权限和完整审计的已验证合作伙伴闭环',
    ownerValue: '集成负责人 / 安全',
    openConnectors: '检查集成闭环', openDeals: '打开交易登记册',
    contractSection: '合同记录的内容', controlsSection: '连接前的必要条件',
    boundaryTitle: '证据边界',
    boundary: '此页面不会创建 API 密钥、显示秘密、激活 webhook 或确认生产可用性。只有完成服务器端凭证签发和撤销、交易范围授权、签名与重放验证、持久化 inbox/outbox、限流、审计轨迹、监控以及成功的外部交换后，合作伙伴访问才可视为有效。',
    values: { sourceControlled: '源代码管理', notConfirmed: '未确认', serverOnly: '仅服务器', required: '必须', documented: '已记录' },
    facts: {
      contract: '规范', contractHint: 'apps/api/openapi.yaml 中的 OpenAPI 3.0.3；合同版本 3.0.0',
      publication: '公共 endpoint', publicationHint: '此页面或仓库文件均不能证明其已发布',
      credentials: '合作伙伴凭证', credentialsHint: '不会在浏览器中创建或保存',
      dealBoundary: '访问边界', dealBoundaryHint: '具体交易、tenant、角色和最小权限 scope',
    },
    contractItems: [
      { title: '合同格式', detail: '源规范使用 OpenAPI 3.0.3 和合同版本 3.0.0。' },
      { title: '授权方案', detail: '合同声明了 Bearer JWT 和 X-Api-Key。声明方案不能证明凭证已签发或可用。' },
      { title: '资金数值', detail: '资金操作以整数 minor units 为规范单位。Float 不能成为权威来源。' },
      { title: '系统方法', detail: 'Health、readiness、metrics 和 version 被记录为技术方法，但不能证明外部合作伙伴闭环。' },
    ],
    controlItems: [
      { title: '交易范围授权', detail: '每个请求都必须核验具体交易的 tenant、参与方、角色、资源和允许的操作。' },
      { title: '凭证生命周期', detail: '签发、哈希存储、轮换、撤销、有效期和最后使用证据仅存在于服务器。' },
      { title: 'Webhook 和 callback', detail: '签名、timestamp、nonce、重放保护、持久化 inbox、幂等性和人工复核为必需项。' },
      { title: '限制与可观测性', detail: '限流、correlation ID、审计日志、指标、告警和对账必须可验证。' },
      { title: '生产准入', detail: '需要合同、访问权限、外部交换、运行证据、SLO 和不中断交易的撤销流程。' },
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

export default async function ApiDocsPage() {
  const copy = COPY[localeOf(await getLocale())];
  const priority: OperationalPriority = {
    state: 'active',
    title: copy.priorityTitle,
    description: copy.priorityDescription,
    blocker: copy.priorityBlocker,
    owner: copy.ownerValue,
    impact: copy.priorityImpact,
    result: copy.priorityResult,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/connectors'>{copy.openConnectors}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-api-docs-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.statusLabel}
      statusTone='warning'
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.facts.contract, value: copy.values.sourceControlled, hint: copy.facts.contractHint },
        { label: copy.facts.publication, value: copy.values.notConfirmed, hint: copy.facts.publicationHint },
        { label: copy.facts.credentials, value: copy.values.serverOnly, hint: copy.facts.credentialsHint },
        { label: copy.facts.dealBoundary, value: copy.values.required, hint: copy.facts.dealBoundaryHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='api-contract'>
        <OperationalQueue>
          {copy.contractItems.map((item) => (
            <OperationalQueueLink
              key={item.title}
              href='/platform-v7/connectors'
              title={item.title}
              detail={item.detail}
              status={<StatusChip tone='information'>{copy.values.documented}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='api-controls'>
        <OperationalQueue>
          {copy.controlItems.map((item) => (
            <OperationalQueueLink
              key={item.title}
              href='/platform-v7/connectors'
              title={item.title}
              detail={item.detail}
              status={<StatusChip tone='warning'>{copy.values.required}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
