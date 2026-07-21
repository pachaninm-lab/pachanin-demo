import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice } from '@pc/design-system-v8';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import {
  MoneyBoundary,
  MoneyCockpitSection,
  MoneyObligationCockpit,
  moneyCockpitClasses,
  type MoneyCockpitLabels,
} from '@/components/transaction-ux/MoneyObligationCockpit';

type Locale = 'ru' | 'en' | 'zh';

type MoneyCopy = {
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  priorityTitle: string;
  priorityDescription: string;
  amount: string;
  blocker: string;
  owner: string;
  result: string;
  registryAction: string;
  releaseAction: string;
  reserveLabel: string;
  reserveValue: string;
  reserveHint: string;
  holdLabel: string;
  holdValue: string;
  holdHint: string;
  requestLabel: string;
  requestValue: string;
  requestHint: string;
  confirmationLabel: string;
  confirmationValue: string;
  confirmationHint: string;
  boundary: string;
  noticeTitle: string;
  noticeBody: string;
  labels: MoneyCockpitLabels;
};

const COPY: Record<Locale, MoneyCopy> = {
  ru: {
    metadataTitle: 'Деньги сделки',
    metadataDescription: 'Серверно подтверждённый вход в резерв, удержание, запрос выплаты, банковское подтверждение и сверку по конкретной Сделке.',
    eyebrow: 'Деньги · обязательства · подтверждение банка',
    title: 'Деньги принадлежат Сделке, а не общему экрану',
    description: 'Выберите серверно доступную Сделку. Только в её контексте можно безопасно различить резерв, удержание, сумму к запросу, банковское подтверждение и сверку.',
    status: 'денежный статус подтверждает сервер',
    priorityTitle: 'Откройте Сделку с денежным обязательством',
    priorityDescription: 'Общий экран не рассчитывает фиктивный портфель и не создаёт денежные статусы из локальных данных. Фактическое состояние читается из серверного контура конкретной Сделки.',
    amount: 'не рассчитывается без выбранной Сделки',
    blocker: 'нет выбранного серверно доступного денежного объекта',
    owner: 'банк и назначенные участники Сделки',
    result: 'однозначный статус + банковский callback + сверка',
    registryAction: 'Открыть реестр Сделок',
    releaseAction: 'Проверка выплаты',
    reserveLabel: 'Резерв',
    reserveValue: 'запрос ≠ подтверждение',
    reserveHint: 'подтверждён только после проверенного callback банка',
    holdLabel: 'Удержание',
    holdValue: 'отдельное состояние',
    holdHint: 'спорная сумма не смешивается с доступной к запросу',
    requestLabel: 'Запрос выплаты',
    requestValue: 'команда в outbox',
    requestHint: 'ещё не движение денег и не финальный статус',
    confirmationLabel: 'Подтверждение',
    confirmationValue: 'только банк',
    confirmationHint: 'после callback выполняются reconciliation, audit и ledger checks',
    boundary: 'Интерфейс платформы может подготовить и отправить запрос, но не может подтвердить резерв, снять удержание или выпустить деньги. Подтверждение создаёт только проверенный банковский callback; расхождение переводит операцию в ручную сверку.',
    noticeTitle: 'Почему здесь нет общей суммы портфеля',
    noticeBody: 'Без серверно подтверждённого набора платежей агрегат вводит в заблуждение и может смешать организации. Ниже отображаются только Сделки, доступ к которым подтвердил сервер. Денежные действия выполняются внутри выбранной Сделки с её RBAC, MFA, идемпотентностью и аудитом.',
    labels: {
      money: 'Деньги',
      blocker: 'Блокер',
      owner: 'Ответственный',
      result: 'Результат',
      nextAction: 'Следующее безопасное действие',
      prioritySection: 'Главное денежное обязательство',
      factsSection: 'Разделение денежных состояний',
    },
  },
  en: {
    metadataTitle: 'Deal money',
    metadataDescription: 'Server-authorized access to reserve, hold, payout request, bank confirmation and reconciliation for a specific Deal.',
    eyebrow: 'Money · obligations · bank confirmation',
    title: 'Money belongs to a Deal, not to a global screen',
    description: 'Select a server-accessible Deal. Only its context can safely distinguish reserve, hold, requested amount, bank confirmation and reconciliation.',
    status: 'money state is server-confirmed',
    priorityTitle: 'Open the Deal with a monetary obligation',
    priorityDescription: 'The global screen does not calculate a fictional portfolio or manufacture money states from local data. Actual state is read from the server-side Deal contour.',
    amount: 'not calculated without a selected Deal',
    blocker: 'no server-accessible money object has been selected',
    owner: 'the bank and assigned Deal participants',
    result: 'unambiguous state + bank callback + reconciliation',
    registryAction: 'Open Deal registry',
    releaseAction: 'Payout readiness',
    reserveLabel: 'Reserve',
    reserveValue: 'request ≠ confirmation',
    reserveHint: 'confirmed only after a verified bank callback',
    holdLabel: 'Hold',
    holdValue: 'a separate state',
    holdHint: 'the disputed amount is not mixed with the requestable amount',
    requestLabel: 'Payout request',
    requestValue: 'an outbox command',
    requestHint: 'not money movement and not a final state',
    confirmationLabel: 'Confirmation',
    confirmationValue: 'bank only',
    confirmationHint: 'callback is followed by reconciliation, audit and ledger checks',
    boundary: 'The platform interface may prepare and send a request, but it cannot confirm a reserve, remove a hold or release funds. Only a verified bank callback creates confirmation; a mismatch routes the operation to manual reconciliation.',
    noticeTitle: 'Why there is no global portfolio amount',
    noticeBody: 'Without a server-confirmed payment set, an aggregate is misleading and may mix organizations. Only server-authorized Deals are shown below. Money actions happen inside the selected Deal with its RBAC, MFA, idempotency and audit controls.',
    labels: {
      money: 'Money',
      blocker: 'Blocker',
      owner: 'Owner',
      result: 'Result',
      nextAction: 'Next safe action',
      prioritySection: 'Primary money obligation',
      factsSection: 'Separation of money states',
    },
  },
  zh: {
    metadataTitle: '交易资金',
    metadataDescription: '进入具体交易的资金预留、冻结、付款申请、银行确认和对账，访问权限由服务器确认。',
    eyebrow: '资金 · 义务 · 银行确认',
    title: '资金属于具体交易，而不是全局页面',
    description: '请选择服务器确认可访问的交易。只有在具体交易中，才能安全地区分预留、冻结、申请金额、银行确认和对账。',
    status: '资金状态由服务器确认',
    priorityTitle: '打开存在资金义务的交易',
    priorityDescription: '全局页面不会用本地数据计算虚构的资金组合，也不会伪造资金状态。实际状态来自具体交易的服务器端流程。',
    amount: '未选择交易时不计算',
    blocker: '尚未选择服务器确认可访问的资金对象',
    owner: '银行和被分配的交易参与方',
    result: '明确状态 + 银行回调 + 对账',
    registryAction: '打开交易登记',
    releaseAction: '检查付款就绪状态',
    reserveLabel: '资金预留',
    reserveValue: '申请 ≠ 确认',
    reserveHint: '只有经过验证的银行回调才能确认',
    holdLabel: '资金冻结',
    holdValue: '独立状态',
    holdHint: '争议金额不得与可申请金额混合',
    requestLabel: '付款申请',
    requestValue: '进入 outbox 的命令',
    requestHint: '这不是资金移动，也不是最终状态',
    confirmationLabel: '确认',
    confirmationValue: '仅由银行完成',
    confirmationHint: '回调后还要执行对账、审计和账本检查',
    boundary: '平台界面可以准备并发送申请，但不能确认资金预留、解除冻结或放款。只有经过验证的银行回调才能形成确认；任何不一致都会转入人工对账。',
    noticeTitle: '为什么没有全局资金组合金额',
    noticeBody: '没有服务器确认的付款集合时，汇总金额会误导用户并可能混合不同组织。下方只显示服务器确认可访问的交易。资金操作在选定交易中执行，并受 RBAC、MFA、幂等和审计控制。',
    labels: {
      money: '资金',
      blocker: '阻塞项',
      owner: '负责人',
      result: '结果',
      nextAction: '下一项安全操作',
      prioritySection: '主要资金义务',
      factsSection: '资金状态区分',
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

export default async function PlatformV7MoneyPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];

  return (
    <MoneyObligationCockpit
      testId='platform-v7-money-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status}
      statusTone='information'
      labels={copy.labels}
      priority={{
        state: 'waiting',
        title: copy.priorityTitle,
        description: copy.priorityDescription,
        amount: copy.amount,
        blocker: copy.blocker,
        owner: copy.owner,
        result: copy.result,
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.registryAction}</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/bank/release-safety'>{copy.releaseAction}</Link>,
      }}
      facts={[
        { label: copy.reserveLabel, value: copy.reserveValue, hint: copy.reserveHint },
        { label: copy.holdLabel, value: copy.holdValue, hint: copy.holdHint },
        { label: copy.requestLabel, value: copy.requestValue, hint: copy.requestHint },
        { label: copy.confirmationLabel, value: copy.confirmationValue, hint: copy.confirmationHint },
      ]}
    >
      <MoneyBoundary>{copy.boundary}</MoneyBoundary>
      <MoneyCockpitSection id='money-deals'>
        <InlineNotice tone='information' title={copy.noticeTitle}>{copy.noticeBody}</InlineNotice>
        <CanonicalDealsList />
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}
