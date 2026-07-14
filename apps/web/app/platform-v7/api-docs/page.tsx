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
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';
type Copy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  priorityTitle: string;
  priorityDescription: string;
  owner: string;
  impact: string;
  result: string;
  download: string;
  connectors: string;
  boundaryTitle: string;
  boundary: string;
  catalogueTitle: string;
  catalogueDescription: string;
  unpublishedTitle: string;
  unpublishedDescription: string;
  facts: Array<{ label: string; value: string; hint: string }>;
  groups: Array<{ id: string; title: string; detail: string }>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    metaTitle: 'API-контракт · Прозрачная Цена',
    metaDescription: 'Подтверждённый read-only OpenAPI-контракт без фиктивных интеграций и неподтверждённых команд.',
    eyebrow: 'Интеграционный контракт',
    title: 'Документируем только подтверждённую серверную поверхность',
    description: 'Каталог содержит маршруты, существование которых подтверждено фактическими NestJS-контроллерами. Доступ к данным ограничивается серверной ролью, организацией, tenant и участием в Сделке.',
    status: 'read-only контракт',
    priorityTitle: 'Проверить OpenAPI до проектирования интеграции',
    priorityDescription: 'Сначала согласуются GET-маршруты, авторизация и границы данных. Команды, webhooks и денежные операции публикуются только отдельным принятым контрактом.',
    owner: 'архитектор интеграции / безопасность',
    impact: 'совместимость, RBAC и отсутствие ложных обещаний',
    result: 'согласованный контракт и перечень необходимых write-сценариев',
    download: 'Скачать OpenAPI YAML',
    connectors: 'Проверить подключения',
    boundaryTitle: 'Граница доказательности',
    boundary: 'Спецификация подтверждает внутренний HTTP-маршрут, но не подтверждает договор, боевые credentials, внешний callback, reconciliation, SLA или промышленную эксплуатацию. Диагностика адаптера не равна live-интеграции.',
    catalogueTitle: 'Опубликованные области',
    catalogueDescription: '14 подтверждённых GET-маршрутов. Все изменяющие операции исключены.',
    unpublishedTitle: 'Write API пока не опубликован',
    unpublishedDescription: 'Для публикации нужны точные DTO, идемпотентность, rate limits, MFA или подпись, audit trail, callback/reconciliation и эксплуатационные доказательства.',
    facts: [
      { label: 'Маршрутов', value: '14 GET', hint: 'только подтверждённые контроллеры' },
      { label: 'Областей', value: '7', hint: 'runtime, identity, Deal, logistics, disputes, settlement, integrations' },
      { label: 'Write-команд', value: '0', hint: 'не публикуются до отдельной приёмки' },
      { label: 'Формат', value: 'OpenAPI 3.0.3', hint: 'same-origin server URL' },
    ],
    groups: [
      { id: 'runtime', title: 'Runtime', detail: 'Liveness, PostgreSQL/migration readiness и идентичность сборки.' },
      { id: 'identity', title: 'Identity', detail: 'Серверно подтверждённые пользователь, организация, tenant, роль и membership.' },
      { id: 'deals', title: 'Canonical Deal', detail: 'Participant-scoped реестр, workspace и execution workspace.' },
      { id: 'logistics', title: 'Logistics', detail: 'Ролевой реестр рейсов, checkpoints и GPS-факты.' },
      { id: 'disputes', title: 'Disputes', detail: 'Ролевой реестр споров и подтверждённых фактов.' },
      { id: 'settlement', title: 'Settlement', detail: 'Bank workspace и durable outbox без подтверждения денег из UI.' },
      { id: 'integrations', title: 'Integrations', detail: 'Внутренняя диагностика адаптеров, не доказательство live-подключения.' },
    ],
  },
  en: {
    metaTitle: 'API contract · Transparent Price',
    metaDescription: 'Verified read-only OpenAPI contract without simulated integrations or unconfirmed commands.',
    eyebrow: 'Integration contract',
    title: 'Document only the confirmed server surface',
    description: 'The catalogue contains routes confirmed by actual NestJS controllers. Data access remains constrained by server role, organization, tenant and Deal participation.',
    status: 'read-only contract',
    priorityTitle: 'Review OpenAPI before integration design',
    priorityDescription: 'GET routes, authentication and data boundaries are agreed first. Commands, webhooks and money operations require a separately accepted contract.',
    owner: 'integration architect / security',
    impact: 'compatibility, RBAC and no false claims',
    result: 'agreed contract and required write-scenario inventory',
    download: 'Download OpenAPI YAML',
    connectors: 'Review connections',
    boundaryTitle: 'Evidence boundary',
    boundary: 'The specification confirms an internal HTTP route. It does not confirm a contract, production credentials, external callback, reconciliation, SLA or production operation. Adapter diagnostics are not live-integration proof.',
    catalogueTitle: 'Published areas',
    catalogueDescription: '14 confirmed GET routes. All mutating operations are excluded.',
    unpublishedTitle: 'Write API is not published yet',
    unpublishedDescription: 'Publication requires exact DTOs, idempotency, rate limits, MFA or signatures, audit trail, callback/reconciliation and operating evidence.',
    facts: [
      { label: 'Routes', value: '14 GET', hint: 'confirmed controllers only' },
      { label: 'Areas', value: '7', hint: 'runtime, identity, Deal, logistics, disputes, settlement, integrations' },
      { label: 'Write commands', value: '0', hint: 'not published before separate acceptance' },
      { label: 'Format', value: 'OpenAPI 3.0.3', hint: 'same-origin server URL' },
    ],
    groups: [
      { id: 'runtime', title: 'Runtime', detail: 'Liveness, PostgreSQL/migration readiness and build identity.' },
      { id: 'identity', title: 'Identity', detail: 'Server-confirmed user, organization, tenant, role and membership.' },
      { id: 'deals', title: 'Canonical Deal', detail: 'Participant-scoped registry, workspace and execution workspace.' },
      { id: 'logistics', title: 'Logistics', detail: 'Role-scoped shipments, checkpoints and GPS facts.' },
      { id: 'disputes', title: 'Disputes', detail: 'Role-scoped disputes and confirmed facts.' },
      { id: 'settlement', title: 'Settlement', detail: 'Bank workspace and durable outbox without UI money confirmation.' },
      { id: 'integrations', title: 'Integrations', detail: 'Internal adapter diagnostics, not live-connection evidence.' },
    ],
  },
  zh: {
    metaTitle: 'API 合同 · 透明价格',
    metaDescription: '经过确认的只读 OpenAPI 合同，不包含模拟集成或未确认命令。',
    eyebrow: '集成合同',
    title: '仅记录已确认的服务器接口',
    description: '目录只包含已由实际 NestJS 控制器确认的路由。数据访问仍由服务器角色、组织、租户和交易参与关系限制。',
    status: '只读合同',
    priorityTitle: '在设计集成前审查 OpenAPI',
    priorityDescription: '先确认 GET 路由、认证方式和数据边界。命令、webhook 和资金操作必须经过单独合同验收。',
    owner: '集成架构师 / 安全',
    impact: '兼容性、RBAC 和避免虚假承诺',
    result: '已确认合同和所需写入场景清单',
    download: '下载 OpenAPI YAML',
    connectors: '检查连接',
    boundaryTitle: '证据边界',
    boundary: '规范只确认内部 HTTP 路由，不证明合同、生产凭据、外部回调、对账、SLA 或生产运行。适配器诊断不等于实时集成证明。',
    catalogueTitle: '已发布领域',
    catalogueDescription: '14 个已确认 GET 路由。不包含任何修改操作。',
    unpublishedTitle: '写入 API 尚未发布',
    unpublishedDescription: '发布需要精确 DTO、幂等性、限流、MFA 或签名、审计轨迹、回调/对账及运行证据。',
    facts: [
      { label: '路由', value: '14 GET', hint: '仅已确认控制器' },
      { label: '领域', value: '7', hint: '运行、身份、交易、物流、争议、结算、集成' },
      { label: '写入命令', value: '0', hint: '单独验收前不发布' },
      { label: '格式', value: 'OpenAPI 3.0.3', hint: '同源服务器 URL' },
    ],
    groups: [
      { id: 'runtime', title: '运行状态', detail: '存活、PostgreSQL/迁移就绪状态和构建标识。' },
      { id: 'identity', title: '身份', detail: '服务器确认的用户、组织、租户、角色和成员关系。' },
      { id: 'deals', title: '规范交易', detail: '参与方范围的登记册、工作区和执行工作区。' },
      { id: 'logistics', title: '物流', detail: '角色范围的运输、检查点和 GPS 事实。' },
      { id: 'disputes', title: '争议', detail: '角色范围的争议和已确认事实。' },
      { id: 'settlement', title: '结算', detail: '银行工作区和持久 outbox，界面不能确认资金。' },
      { id: 'integrations', title: '集成', detail: '内部适配器诊断，不是实时连接证明。' },
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
  return { title: copy.metaTitle, description: copy.metaDescription, robots: { index: false, follow: false } };
}

export default async function ApiDocsPage() {
  const copy = COPY[localeOf(await getLocale())];
  return (
    <OperationalDecisionCockpit
      testId='platform-v7-api-docs-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status}
      statusTone='information'
      priority={{
        state: 'active',
        title: copy.priorityTitle,
        description: copy.priorityDescription,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        primaryAction: <a className={operationalCockpitClasses.primaryLink} href='/platform-v7/openapi.yaml' download>{copy.download}</a>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/connectors'>{copy.connectors}</Link>,
      }}
      facts={copy.facts}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='contract-boundary'>
        <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
      </OperationalCockpitSection>
      <OperationalCockpitSection id='published-areas'>
        <StatusChip tone='information'>{copy.catalogueTitle}</StatusChip>
        <OperationalQueue>
          {copy.groups.map((group) => (
            <OperationalQueueLink
              key={group.id}
              href='/platform-v7/openapi.yaml'
              title={group.title}
              detail={group.detail}
              status={<StatusChip tone='success'>GET</StatusChip>}
            />
          ))}
        </OperationalQueue>
        <InlineNotice tone='neutral' title={copy.catalogueTitle}>{copy.catalogueDescription}</InlineNotice>
      </OperationalCockpitSection>
      <OperationalCockpitSection id='unpublished-commands'>
        <InlineNotice tone='warning' title={copy.unpublishedTitle}>{copy.unpublishedDescription}</InlineNotice>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
