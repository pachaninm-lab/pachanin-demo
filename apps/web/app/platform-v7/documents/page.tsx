import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice } from '@pc/design-system-v8';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  operationalCockpitClasses,
  type OperationalCockpitLabels,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type DocumentsCopy = {
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
  openDeals: string;
  payoutReadiness: string;
  factScopeLabel: string;
  factScopeValue: string;
  factScopeHint: string;
  factAuthorityLabel: string;
  factAuthorityValue: string;
  factAuthorityHint: string;
  factMoneyLabel: string;
  factMoneyValue: string;
  factMoneyHint: string;
  factEvidenceLabel: string;
  factEvidenceValue: string;
  factEvidenceHint: string;
  boundary: string;
  noticeTitle: string;
  noticeBody: string;
  labels: OperationalCockpitLabels;
};

const COPY: Record<Locale, DocumentsCopy> = {
  ru: {
    metadataTitle: 'Документы сделки',
    metadataDescription: 'Серверно подтверждённый вход в документы, доказательства и готовность выплаты по конкретной Сделке.',
    eyebrow: 'Документы · доказательства · готовность денег',
    title: 'Документы существуют только внутри Сделки',
    description: 'Выбери серверно доступную Сделку. В её рабочем месте видны обязательный комплект, источник каждого документа, ответственный, подпись, доказательства и влияние на деньги.',
    status: 'доступ определяет сервер',
    priorityTitle: 'Открой Сделку, которая требует документного действия',
    priorityDescription: 'Глобальный архив не должен смешивать организации, роли и права. Документный статус читается и меняется только в контексте конкретной Сделки и подтверждённого участия.',
    blocker: 'нет выбранной серверно доступной Сделки',
    owner: 'назначенный участник документного шага',
    impact: 'неполный обязательный комплект блокирует готовность выплаты',
    result: 'проверяемый evidence pack в истории Сделки',
    openDeals: 'Открыть реестр Сделок',
    payoutReadiness: 'Проверка готовности выплаты',
    factScopeLabel: 'Контекст',
    factScopeValue: 'одна Сделка',
    factScopeHint: 'никаких документов вне tenant и participant scope',
    factAuthorityLabel: 'Источник статуса',
    factAuthorityValue: 'сервер + внешний контур',
    factAuthorityHint: 'клиентский экран не создаёт подтверждение ФГИС, ЭДО, ЭПД или КЭП',
    factMoneyLabel: 'Граница денег',
    factMoneyValue: 'подтверждает банк',
    factMoneyHint: 'документ создаёт основание, но интерфейс не выпускает средства',
    factEvidenceLabel: 'Доказательность',
    factEvidenceValue: 'источник + подпись + время',
    factEvidenceHint: 'факт должен быть воспроизводим в споре и аудите',
    boundary: 'Внешние ФГИС, ЭДО, ГИС ЭПД, КЭП и банковые статусы считаются подтверждёнными только после реального ответа соответствующего контура. Платформа не подменяет их локальной отметкой.',
    noticeTitle: 'Почему здесь нет общего файлового архива',
    noticeBody: 'Рабочий документ — это часть исполнения Сделки, а не независимое вложение. Ниже показаны только Сделки, доступ к которым подтвердил сервер. Открой нужную Сделку и продолжи её документный шаг.',
    labels: {
      blocker: 'Блокер',
      owner: 'Ответственный',
      impact: 'Влияние',
      result: 'Результат',
      nextAction: 'Следующее действие',
      prioritySection: 'Главная документная задача',
      factsSection: 'Правила документного контура',
    },
  },
  en: {
    metadataTitle: 'Deal documents',
    metadataDescription: 'Server-authorized access to documents, evidence and payout readiness for a specific Deal.',
    eyebrow: 'Documents · evidence · money readiness',
    title: 'Documents exist only inside a Deal',
    description: 'Select a server-accessible Deal. Its workspace shows the mandatory set, source, responsible party, signature, evidence and monetary impact of each document.',
    status: 'access is server-owned',
    priorityTitle: 'Open the Deal that requires document work',
    priorityDescription: 'A global archive must not mix organizations, roles or permissions. Document state is read and changed only within a specific Deal and confirmed participation.',
    blocker: 'no server-accessible Deal has been selected',
    owner: 'participant assigned to the document step',
    impact: 'an incomplete mandatory set blocks payout readiness',
    result: 'a verifiable evidence pack in Deal history',
    openDeals: 'Open Deal registry',
    payoutReadiness: 'Check payout readiness',
    factScopeLabel: 'Context',
    factScopeValue: 'one Deal',
    factScopeHint: 'no documents outside tenant and participant scope',
    factAuthorityLabel: 'Status authority',
    factAuthorityValue: 'server + external system',
    factAuthorityHint: 'the client cannot manufacture FGIS, EDI, e-transport or signature confirmation',
    factMoneyLabel: 'Money boundary',
    factMoneyValue: 'confirmed by the bank',
    factMoneyHint: 'a document creates a basis; the interface cannot release funds',
    factEvidenceLabel: 'Evidence',
    factEvidenceValue: 'source + signature + time',
    factEvidenceHint: 'every fact must be reproducible in a dispute and audit',
    boundary: 'FGIS, EDI, state e-transport, qualified-signature and bank states are confirmed only by a real response from the corresponding external system. The platform does not replace them with a local flag.',
    noticeTitle: 'Why there is no global file archive',
    noticeBody: 'An operational document is part of Deal execution, not an independent attachment. Only server-authorized Deals are listed below. Open the required Deal and continue its document step.',
    labels: {
      blocker: 'Blocker',
      owner: 'Owner',
      impact: 'Impact',
      result: 'Result',
      nextAction: 'Next action',
      prioritySection: 'Primary document task',
      factsSection: 'Document workflow rules',
    },
  },
  zh: {
    metadataTitle: '交易文件',
    metadataDescription: '进入特定交易的文件、证据和付款就绪状态，访问权限由服务器确认。',
    eyebrow: '文件 · 证据 · 资金就绪',
    title: '文件只能存在于具体交易中',
    description: '请选择服务器确认可访问的交易。交易工作区会显示必备文件、来源、负责人、签署、证据及其对资金的影响。',
    status: '访问权限由服务器决定',
    priorityTitle: '打开需要处理文件的交易',
    priorityDescription: '全局档案不能混合不同组织、角色和权限。文件状态只能在具体交易和已确认参与关系中读取或变更。',
    blocker: '尚未选择服务器确认可访问的交易',
    owner: '被分配到文件步骤的参与方',
    impact: '必备文件不完整会阻止付款就绪',
    result: '交易历史中的可验证证据包',
    openDeals: '打开交易登记',
    payoutReadiness: '检查付款就绪状态',
    factScopeLabel: '上下文',
    factScopeValue: '一笔交易',
    factScopeHint: '不得访问租户和参与范围之外的文件',
    factAuthorityLabel: '状态权威来源',
    factAuthorityValue: '服务器 + 外部系统',
    factAuthorityHint: '客户端不能伪造监管、电子单证、电子运输或签名确认',
    factMoneyLabel: '资金边界',
    factMoneyValue: '由银行确认',
    factMoneyHint: '文件形成依据，但界面不能自行放款',
    factEvidenceLabel: '证据要求',
    factEvidenceValue: '来源 + 签名 + 时间',
    factEvidenceHint: '每个事实都必须能在争议和审计中复现',
    boundary: '监管、电子单证、国家电子运输、合格电子签名和银行状态，只有在相应外部系统真实返回后才视为已确认。平台不会用本地标记替代外部确认。',
    noticeTitle: '为什么没有全局文件档案',
    noticeBody: '工作文件属于交易执行过程，不是独立附件。下方只列出服务器确认可访问的交易。打开目标交易并继续其文件步骤。',
    labels: {
      blocker: '阻塞项',
      owner: '负责人',
      impact: '影响',
      result: '结果',
      nextAction: '下一步',
      prioritySection: '主要文件任务',
      factsSection: '文件流程规则',
    },
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[normalizeLocale(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function PlatformV7DocumentsPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-documents-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status}
      statusTone='information'
      labels={copy.labels}
      priority={{
        state: 'active',
        title: copy.priorityTitle,
        description: copy.priorityDescription,
        blocker: copy.blocker,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/bank/release-safety'>{copy.payoutReadiness}</Link>,
      }}
      facts={[
        { label: copy.factScopeLabel, value: copy.factScopeValue, hint: copy.factScopeHint },
        { label: copy.factAuthorityLabel, value: copy.factAuthorityValue, hint: copy.factAuthorityHint },
        { label: copy.factMoneyLabel, value: copy.factMoneyValue, hint: copy.factMoneyHint },
        { label: copy.factEvidenceLabel, value: copy.factEvidenceValue, hint: copy.factEvidenceHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='document-deals'>
        <InlineNotice tone='information' title={copy.noticeTitle}>{copy.noticeBody}</InlineNotice>
        <CanonicalDealsList />
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
