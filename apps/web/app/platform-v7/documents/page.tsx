import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { DocumentsTree } from '@/components/platform-v7/DocumentsTree';
import { buildDemoDocumentTree } from '@/components/platform-v7/DocumentsTree.data';
import { DocumentsMatrix } from '@/components/platform-v7/DocumentsMatrix';
import { DocumentsMatrixActions } from '@/components/platform-v7/DocumentsMatrixActions';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

export const metadata: Metadata = {
  title: 'Документы',
  description: 'Документный слой сделки: источники, подписи, готовность, спор и влияние на банковскую проверку.',
};

type Locale = 'ru' | 'en' | 'zh';

type DocumentItem = {
  title: string;
  source: string;
  owner: string;
  status: string;
  impact: string;
};

const scenario = getDeal360Scenario('DL-9106');

const COPY: Record<Locale, {
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
  openDeal: string;
  bankReview: string;
  facts: Array<{ label: string; value: string; hint: string }>;
  boundary: string;
  queueTitle: string;
  archiveTitle: string;
  archiveSummary: string;
  matrixTitle: string;
  matrixSummary: string;
  documents: DocumentItem[];
}> = {
  ru: {
    eyebrow: 'Документы · источник → подпись → основание',
    title: 'Документ — это условие исполнения Сделки',
    description: 'Экран показывает источник, ответственного, статус и влияние каждого документа на приёмку, спор и банковскую проверку.',
    status: 'пакет не готов',
    priorityTitle: 'Закрыть СДИЗ и транспортный пакет DL-9106',
    priorityDescription: 'СДИЗ, ЭТрН, акт приёмки и протокол качества должны иметь подтверждённый источник и ответственного. Внутренняя отметка не заменяет внешний факт.',
    blocker: 'СДИЗ + ЭТрН + акт + качество',
    owner: 'продавец → логист → элеватор → лаборатория',
    impact: 'к банковской проверке сейчас 0 ₽',
    result: 'полный подписанный пакет в журнале Сделки',
    openDeal: 'Открыть DL-9106',
    bankReview: 'Банковская проверка',
    facts: [
      { label: 'Обязательных документов', value: '8', hint: 'включая государственные и коммерческие источники' },
      { label: 'Блокируют следующий этап', value: '5', hint: 'пока подтверждение не получено извне' },
      { label: 'Ответственных ролей', value: '5', hint: 'каждый документ имеет владельца шага' },
      { label: 'К проверке банком', value: '0 ₽', hint: 'документы ещё не сформировали основание' },
    ],
    boundary: 'Платформа хранит статусы, доказательства и связи со Сделкой. Она не подменяет ФГИС, ЭДО, ГИС ЭПД, КЭП, лабораторию или банковское подтверждение.',
    queueTitle: 'Документы и влияние на Сделку',
    archiveTitle: 'Архив документов',
    archiveSummary: 'Год → месяц → Сделка · вспомогательный просмотр',
    matrixTitle: 'Матрица готовности и действия',
    matrixSummary: 'статус · источник · подпись · влияние на деньги',
    documents: [
      { title: 'СДИЗ', source: 'ФГИС «Зерно»', owner: 'продавец + оператор', status: 'не оформлен', impact: 'останавливает банковскую проверку' },
      { title: 'ЭТрН', source: 'оператор ЭДО ЭТрН', owner: 'логист + перевозчик', status: 'ждёт подписи', impact: 'останавливает закрытие рейса' },
      { title: 'ГИС ЭПД', source: 'государственный контур ЭПД', owner: 'логист + перевозчик', status: 'ожидает ЭТрН', impact: 'останавливает транспортное основание' },
      { title: 'УПД', source: 'оператор ЭДО', owner: 'продавец + покупатель', status: 'не запущен', impact: 'останавливает расчётное закрытие' },
      { title: 'КЭП / МЧД', source: 'аккредитованный удостоверяющий контур', owner: 'уполномоченный подписант', status: 'не подписано', impact: 'останавливает юридически значимое действие' },
      { title: 'Акт приёмки', source: 'элеватор', owner: 'элеватор', status: 'готовится', impact: 'подтверждает исполнение и вес' },
      { title: 'Акт расхождения', source: 'элеватор + стороны', owner: 'элеватор + оператор', status: 'требуется', impact: 'создаёт удержание до решения' },
      { title: 'Протокол качества', source: 'лабораторный контур', owner: 'лаборатория', status: 'ожидается', impact: 'может изменить расчёт и открыть спор' },
    ],
  },
  en: {
    eyebrow: 'Documents · source → signature → basis',
    title: 'A document is an execution condition',
    description: 'The screen shows the source, owner, status and impact of each document on acceptance, disputes and bank review.',
    status: 'package incomplete',
    priorityTitle: 'Close the grain certificate and transport package for DL-9106',
    priorityDescription: 'The grain certificate, electronic waybill, acceptance act and quality protocol require a verified source and accountable owner. An internal mark cannot replace an external fact.',
    blocker: 'grain certificate + waybill + act + quality',
    owner: 'seller → logistics → elevator → laboratory',
    impact: '0 RUB currently eligible for bank review',
    result: 'complete signed package in the Deal journal',
    openDeal: 'Open DL-9106',
    bankReview: 'Bank review',
    facts: [
      { label: 'Required documents', value: '8', hint: 'including public and commercial sources' },
      { label: 'Blocking the next stage', value: '5', hint: 'until external confirmation is received' },
      { label: 'Responsible roles', value: '5', hint: 'every document has a step owner' },
      { label: 'Eligible for bank review', value: '0 RUB', hint: 'the basis is not complete yet' },
    ],
    boundary: 'The platform stores statuses, evidence and Deal links. It does not replace public registries, EDI, e-transport records, qualified signatures, the laboratory or bank confirmation.',
    queueTitle: 'Documents and Deal impact',
    archiveTitle: 'Document archive',
    archiveSummary: 'Year → month → Deal · supporting view',
    matrixTitle: 'Readiness matrix and actions',
    matrixSummary: 'status · source · signature · money impact',
    documents: [
      { title: 'Grain certificate', source: 'Federal grain registry', owner: 'seller + operator', status: 'not issued', impact: 'blocks bank review' },
      { title: 'Electronic waybill', source: 'transport EDI provider', owner: 'logistics + carrier', status: 'awaiting signature', impact: 'blocks trip closure' },
      { title: 'Public e-transport record', source: 'state transport system', owner: 'logistics + carrier', status: 'awaiting waybill', impact: 'blocks transport basis' },
      { title: 'Universal transfer document', source: 'EDI provider', owner: 'seller + buyer', status: 'not started', impact: 'blocks settlement closure' },
      { title: 'Qualified signature / authority', source: 'accredited trust service', owner: 'authorised signatory', status: 'not signed', impact: 'blocks legally significant action' },
      { title: 'Acceptance act', source: 'elevator', owner: 'elevator', status: 'in preparation', impact: 'confirms delivery and weight' },
      { title: 'Discrepancy act', source: 'elevator + parties', owner: 'elevator + operator', status: 'required', impact: 'creates a hold until decision' },
      { title: 'Quality protocol', source: 'laboratory circuit', owner: 'laboratory', status: 'pending', impact: 'may change settlement and open a dispute' },
    ],
  },
  zh: {
    eyebrow: '文件 · 来源 → 签署 → 依据',
    title: '文件是交易履约条件',
    description: '该页面显示每份文件的来源、责任人、状态，以及对验收、争议和银行审核的影响。',
    status: '文件包未完成',
    priorityTitle: '完成 DL-9106 的粮食凭证和运输文件包',
    priorityDescription: '粮食凭证、电子运单、验收单和质量报告必须具有已验证来源和责任人。平台内部标记不能替代外部事实。',
    blocker: '粮食凭证 + 运单 + 验收单 + 质量',
    owner: '卖方 → 物流 → 粮库 → 实验室',
    impact: '当前可进入银行审核的金额为 0 卢布',
    result: '交易日志中的完整已签署文件包',
    openDeal: '打开 DL-9106',
    bankReview: '银行审核',
    facts: [
      { label: '必需文件', value: '8', hint: '包括政府和商业来源' },
      { label: '阻止下一阶段', value: '5', hint: '等待外部确认' },
      { label: '责任角色', value: '5', hint: '每份文件都有步骤负责人' },
      { label: '可进入银行审核', value: '0 卢布', hint: '依据尚未完整' },
    ],
    boundary: '平台保存状态、证据和交易关联，但不替代政府登记、电子数据交换、电子运输记录、合格电子签名、实验室或银行确认。',
    queueTitle: '文件及其对交易的影响',
    archiveTitle: '文件档案',
    archiveSummary: '年份 → 月份 → 交易 · 辅助视图',
    matrixTitle: '就绪矩阵和操作',
    matrixSummary: '状态 · 来源 · 签署 · 资金影响',
    documents: [
      { title: '粮食凭证', source: '联邦粮食登记系统', owner: '卖方 + 运营人员', status: '未签发', impact: '阻止银行审核' },
      { title: '电子运单', source: '运输 EDI 服务商', owner: '物流 + 承运人', status: '等待签署', impact: '阻止运输任务关闭' },
      { title: '国家电子运输记录', source: '国家运输系统', owner: '物流 + 承运人', status: '等待电子运单', impact: '阻止运输依据形成' },
      { title: '通用转让文件', source: 'EDI 服务商', owner: '卖方 + 买方', status: '未启动', impact: '阻止结算关闭' },
      { title: '合格电子签名 / 授权', source: '认可的信任服务', owner: '授权签署人', status: '未签署', impact: '阻止具有法律效力的操作' },
      { title: '验收单', source: '粮库', owner: '粮库', status: '准备中', impact: '确认交付和重量' },
      { title: '差异单', source: '粮库 + 交易双方', owner: '粮库 + 运营人员', status: '必需', impact: '在裁决前产生冻结金额' },
      { title: '质量报告', source: '实验室系统', owner: '实验室', status: '等待中', impact: '可能改变结算并触发争议' },
    ],
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
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
      statusTone='critical'
      priority={{
        state: 'critical',
        title: copy.priorityTitle,
        description: copy.priorityDescription,
        blocker: copy.blocker,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${scenario.dealId}/clean`}>{copy.openDeal}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/bank/release-safety'>{copy.bankReview}</Link>,
      }}
      facts={copy.facts}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='document-queue'>
        <CollapsibleSection title={copy.queueTitle} summary={`${copy.documents.length}`} defaultOpen>
          <OperationalQueue>
            {copy.documents.map((document) => (
              <OperationalQueueLink
                key={`${document.title}-${document.source}`}
                href={`/platform-v7/deals/${scenario.dealId}/clean`}
                title={`${document.title} · ${document.status}`}
                detail={`${document.source} · ${document.owner} · ${document.impact}`}
              />
            ))}
          </OperationalQueue>
        </CollapsibleSection>
      </OperationalCockpitSection>

      <CollapsibleSection title={copy.matrixTitle} summary={copy.matrixSummary} defaultOpen={false}>
        <div className={operationalCockpitClasses.toolGrid}>
          <DocumentsMatrix />
          <div>
            <DocumentReadinessMiniMatrix role='seller' />
            <DocumentsMatrixActions />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={copy.archiveTitle} summary={copy.archiveSummary} defaultOpen={false}>
        <DocumentsTree data={buildDemoDocumentTree()} />
      </CollapsibleSection>
    </OperationalDecisionCockpit>
  );
}
