import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalCockpitLabels,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = {
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  priorityTitle: string;
  priorityDescription: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  start: string;
  auction: string;
  labels: OperationalCockpitLabels;
  facts: { organization: string; authority: string; lot: string; certificate: string; notConfirmed: string; notSelected: string };
  stepsTitle: string;
  stepsSummary: string;
  steps: Array<{ id: string; title: string; detail: string; status: string }>;
  boundaryTitle: string;
  boundary: string;
  nextTitle: string;
  nextSummary: string;
  openImport: string;
  openAuction: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Доступ к ФГИС Зерно',
    metadataDescription: 'Fail-closed подтверждение организации и полномочий до импорта партии в аукцион.',
    eyebrow: 'ФГИС Зерно · организация → полномочие → импорт',
    title: 'Сначала подтвердить право действовать от организации',
    description: 'Платформа не принимает пароль от ФГИС и не создаёт локальную организацию, лот или СДИЗ. Сервер должен подтвердить организацию, представителя и право на импорт партии.',
    status: 'полномочия не подтверждены',
    priorityTitle: 'Подтвердить организацию через государственный контур',
    priorityDescription: 'После возврата из gov-ID сервер обязан проверить claims, ИНН/ОГРН, представителя, membership и аудит. До этого импорт и торги остаются закрытыми.',
    blocker: 'нет подтверждённого server-side результата идентификации',
    owner: 'представитель организации · комплаенс · интеграция',
    impact: 'партия не может стать лотом аукциона',
    result: 'подтверждённая организация → право на импорт → серверный лот',
    start: 'Подтвердить организацию',
    auction: 'Открыть аукцион',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача доступа', factsSection: 'Подтверждённые факты' },
    facts: { organization: 'Организация', authority: 'Полномочие', lot: 'Лот', certificate: 'СДИЗ', notConfirmed: 'не подтверждено сервером', notSelected: 'не выбран' },
    stepsTitle: 'Обязательные проверки', stepsSummary: 'без локального статуса «готово»',
    steps: [
      { id: 'identity', title: 'Подтвердить организацию', detail: 'получить проверенные claims из gov-ID', status: 'действие' },
      { id: 'representative', title: 'Проверить представителя', detail: 'сверить право действовать от имени организации', status: 'заблокировано' },
      { id: 'membership', title: 'Создать серверное membership', detail: 'роль и tenant назначает backend, не URL и не клиент', status: 'заблокировано' },
      { id: 'fgis', title: 'Подтвердить внешний доступ', detail: 'боевой API или утверждённый ручной регламент без хранения пароля', status: 'заблокировано' },
      { id: 'import', title: 'Импортировать партию', detail: 'лот и СДИЗ принимаются только с authority proof', status: 'заблокировано' },
    ],
    boundaryTitle: 'Граница доказанности',
    boundary: 'Этот экран не доказывает live-подключение ФГИС, ЕСИА или промышленный импорт. Он намеренно не показывает вымышленные ИНН, лот, СДИЗ, массу, качество и API-версию. До подтверждённого серверного результата контур fail-closed.',
    nextTitle: 'После подтверждения', nextSummary: 'аукцион также проверит PostgreSQL authority proof', openImport: 'Перейти к импорту', openAuction: 'Открыть обзор аукциона',
  },
  en: {
    metadataTitle: 'Grain registry access', metadataDescription: 'Fail-closed organization and authority verification before importing a lot into auction.',
    eyebrow: 'Grain registry · organization → authority → import', title: 'Confirm the right to act for the organization first',
    description: 'The platform does not accept a registry password or manufacture a local organization, lot or certificate. The server must confirm the organization, representative and import authority.',
    status: 'authority not confirmed', priorityTitle: 'Confirm the organization through the government identity contour', priorityDescription: 'After the gov-ID callback, the server must verify claims, legal identifiers, representative, membership and audit. Import and trading remain closed until then.',
    blocker: 'no confirmed server-side identity result', owner: 'organization representative · compliance · integration', impact: 'the batch cannot become an auction lot', result: 'confirmed organization → import authority → server lot',
    start: 'Confirm organization', auction: 'Open auction', labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next safe action', prioritySection: 'Primary access task', factsSection: 'Confirmed facts' },
    facts: { organization: 'Organization', authority: 'Authority', lot: 'Lot', certificate: 'Certificate', notConfirmed: 'not confirmed by server', notSelected: 'not selected' },
    stepsTitle: 'Mandatory checks', stepsSummary: 'no local “ready” status',
    steps: [
      { id: 'identity', title: 'Confirm the organization', detail: 'receive verified claims from gov-ID', status: 'action' },
      { id: 'representative', title: 'Verify the representative', detail: 'confirm the right to act for the organization', status: 'blocked' },
      { id: 'membership', title: 'Create server membership', detail: 'backend assigns role and tenant, never URL or client state', status: 'blocked' },
      { id: 'fgis', title: 'Confirm external access', detail: 'production API or approved manual procedure without storing passwords', status: 'blocked' },
      { id: 'import', title: 'Import the batch', detail: 'lot and certificate are accepted only with authority proof', status: 'blocked' },
    ],
    boundaryTitle: 'Evidence boundary', boundary: 'This screen does not prove a live registry, identity or production import connection. It deliberately shows no invented legal ID, lot, certificate, mass, quality or API version. The contour fails closed until a confirmed server result exists.',
    nextTitle: 'After confirmation', nextSummary: 'the auction also requires PostgreSQL authority proof', openImport: 'Go to import', openAuction: 'Open auction overview',
  },
  zh: {
    metadataTitle: '粮食登记访问', metadataDescription: '在批次导入竞价前，以 fail-closed 方式验证组织和权限。',
    eyebrow: '粮食登记 · 组织 → 权限 → 导入', title: '首先确认代表组织行事的权利',
    description: '平台不接收登记系统密码，也不会在本地伪造组织、批次或凭证。服务器必须确认组织、代表和导入权限。',
    status: '权限尚未确认', priorityTitle: '通过政府身份流程确认组织', priorityDescription: 'gov-ID 回调后，服务器必须验证 claims、法人标识、代表、membership 和审计。在此之前，导入和竞价保持关闭。',
    blocker: '没有已确认的服务器端身份结果', owner: '组织代表 · 合规 · 集成', impact: '该批次不能成为竞价批次', result: '已确认组织 → 导入权限 → 服务器批次',
    start: '确认组织', auction: '打开竞价', labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一项安全操作', prioritySection: '主要访问任务', factsSection: '已确认事实' },
    facts: { organization: '组织', authority: '权限', lot: '批次', certificate: '凭证', notConfirmed: '服务器未确认', notSelected: '未选择' },
    stepsTitle: '强制检查', stepsSummary: '不使用本地“就绪”状态',
    steps: [
      { id: 'identity', title: '确认组织', detail: '从 gov-ID 获取已验证 claims', status: '操作' },
      { id: 'representative', title: '验证代表', detail: '确认代表组织行事的权利', status: '已阻塞' },
      { id: 'membership', title: '创建服务器 membership', detail: '角色和 tenant 只能由 backend 分配', status: '已阻塞' },
      { id: 'fgis', title: '确认外部访问', detail: '生产 API 或不保存密码的批准人工流程', status: '已阻塞' },
      { id: 'import', title: '导入批次', detail: '只有带 authority proof 的批次和凭证才被接受', status: '已阻塞' },
    ],
    boundaryTitle: '证据边界', boundary: '此页面不能证明登记、身份或生产导入已经实时连接。页面不会展示虚构的法人标识、批次、凭证、重量、质量或 API 版本。在服务器结果确认前，流程 fail-closed。',
    nextTitle: '确认之后', nextSummary: '竞价同样要求 PostgreSQL 权威证明', openImport: '进入导入', openAuction: '打开竞价概览',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function FarmerFgisAccessPage() {
  const copy = COPY[localeOf(await getLocale())];

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-fgis-access-authority-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status}
      statusTone='warning'
      labels={copy.labels}
      priority={{
        state: 'critical',
        title: copy.priorityTitle,
        description: copy.priorityDescription,
        blocker: copy.blocker,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/api/platform-v7/gov-id/start?flow=fgis'>{copy.start}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/auction'>{copy.auction}</Link>,
      }}
      facts={[
        { label: copy.facts.organization, value: copy.facts.notConfirmed },
        { label: copy.facts.authority, value: copy.facts.notConfirmed },
        { label: copy.facts.lot, value: copy.facts.notSelected },
        { label: copy.facts.certificate, value: copy.facts.notConfirmed },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='fgis-access-checks'>
        <CollapsibleSection title={copy.stepsTitle} summary={copy.stepsSummary} defaultOpen>
          <OperationalQueue>
            {copy.steps.map((step, index) => (
              <OperationalQueueLink
                key={step.id}
                href={index === 0 ? '/api/platform-v7/gov-id/start?flow=fgis' : '/platform-v7/fgis-access'}
                title={step.title}
                detail={step.detail}
                status={<StatusChip tone={index === 0 ? 'information' : 'critical'}>{step.status}</StatusChip>}
              />
            ))}
          </OperationalQueue>
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection>
        <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
      </OperationalCockpitSection>

      <OperationalCockpitSection>
        <CollapsibleSection title={copy.nextTitle} summary={copy.nextSummary}>
          <OperationalQueue>
            <OperationalQueueLink href='/platform-v7/auction/import' title={copy.openImport} detail={copy.nextSummary} status={<StatusChip tone='critical'>{copy.status}</StatusChip>} />
            <OperationalQueueLink href='/platform-v7/auction' title={copy.openAuction} detail={copy.nextSummary} status={<StatusChip tone='critical'>{copy.status}</StatusChip>} />
          </OperationalQueue>
        </CollapsibleSection>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
