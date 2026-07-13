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

type ReleaseCopy = {
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
  bankAction: string;
  reserveLabel: string;
  reserveValue: string;
  reserveHint: string;
  evidenceLabel: string;
  evidenceValue: string;
  evidenceHint: string;
  requestLabel: string;
  requestValue: string;
  requestHint: string;
  callbackLabel: string;
  callbackValue: string;
  callbackHint: string;
  boundary: string;
  noticeTitle: string;
  noticeBody: string;
  labels: MoneyCockpitLabels;
};

const COPY: Record<Locale, ReleaseCopy> = {
  ru: {
    metadataTitle: 'Проверка выплаты',
    metadataDescription: 'Серверно подтверждённый вход в проверку условий выплаты по конкретной Сделке без клиентского выпуска денег.',
    eyebrow: 'Выплата · основание · внешний банковский callback',
    title: 'Проверка выплаты не является кнопкой выпуска денег',
    description: 'Выбери серверно доступную Сделку. Backend проверяет резерв, сумму, удержания, спор, документы, ФГИС/СДИЗ, транспорт, приёмку, качество и ручные остановки до создания запроса банку.',
    status: 'release подтверждает только банк',
    priorityTitle: 'Открой Сделку и проверь её фактические блокеры',
    priorityDescription: 'Глобальный экран не имеет права вычислять готовность на fixture-данных. Решение принимается только по текущему серверному состоянию конкретной Сделки и полномочиям участника.',
    amount: 'определяется сервером внутри Сделки',
    blocker: 'готовность не подтверждена без выбранной Сделки',
    owner: 'участники закрывают условия; банк подтверждает операцию',
    result: 'release request → callback → reconciliation → audit',
    registryAction: 'Выбрать Сделку',
    bankAction: 'Вернуться в кабинет банка',
    reserveLabel: 'Резерв',
    reserveValue: 'должен быть подтверждён',
    reserveHint: 'запрос резерва сам по себе не открывает выплату',
    evidenceLabel: 'Основание',
    evidenceValue: 'полный evidence pack',
    evidenceHint: 'документы, приёмка, качество, транспорт и отсутствие открытого спора',
    requestLabel: 'Release request',
    requestValue: 'идемпотентная команда',
    requestHint: 'создаёт outbox-запись, но не меняет деньги на RELEASED',
    callbackLabel: 'Финальное подтверждение',
    callbackValue: 'verified bank callback',
    callbackHint: 'подпись, event ID, operation ID, replay protection и последующая сверка',
    boundary: 'Платформа не может вручную присвоить RESERVED или RELEASED. Даже при закрытых условиях она только создаёт запрос. Денежное состояние меняется после проверенного банковского callback; ошибка, конфликт или расхождение переводят операцию в manual review.',
    noticeTitle: 'Порядок безопасной проверки',
    noticeBody: 'Выбери Сделку ниже. В её рабочем месте сервер показывает реальный следующий шаг и блокеры. Закрой обязательные условия, затем уполномоченная денежная роль с актуальной MFA может отправить release request. До callback банка деньги считаются неподтверждёнными.',
    labels: {
      money: 'Сумма',
      blocker: 'Блокер',
      owner: 'Ответственный',
      result: 'Цепочка результата',
      nextAction: 'Следующее безопасное действие',
      prioritySection: 'Главная задача проверки выплаты',
      factsSection: 'Неизменяемые границы выплаты',
    },
  },
  en: {
    metadataTitle: 'Payout readiness',
    metadataDescription: 'Server-authorized access to payout-condition checks for a specific Deal without client-side fund release.',
    eyebrow: 'Payout · basis · external bank callback',
    title: 'Payout readiness is not a release button',
    description: 'Select a server-accessible Deal. The backend checks reserve, amount, holds, dispute, documents, regulatory status, transport, acceptance, quality and manual stops before creating a bank request.',
    status: 'release is confirmed by the bank only',
    priorityTitle: 'Open a Deal and inspect its actual blockers',
    priorityDescription: 'A global screen must not calculate readiness from fixtures. The decision uses only the current server state of a specific Deal and the participant’s authority.',
    amount: 'determined by the server inside the Deal',
    blocker: 'readiness is unconfirmed without a selected Deal',
    owner: 'participants close conditions; the bank confirms the operation',
    result: 'release request → callback → reconciliation → audit',
    registryAction: 'Select a Deal',
    bankAction: 'Return to bank workspace',
    reserveLabel: 'Reserve',
    reserveValue: 'must be confirmed',
    reserveHint: 'a reserve request does not by itself enable payout',
    evidenceLabel: 'Basis',
    evidenceValue: 'complete evidence pack',
    evidenceHint: 'documents, acceptance, quality, transport and no open dispute',
    requestLabel: 'Release request',
    requestValue: 'idempotent command',
    requestHint: 'creates an outbox record but does not set money to RELEASED',
    callbackLabel: 'Final confirmation',
    callbackValue: 'verified bank callback',
    callbackHint: 'signature, event ID, operation ID, replay protection and reconciliation',
    boundary: 'The platform cannot manually assign RESERVED or RELEASED. Even when all conditions are closed, it only creates a request. Money state changes after a verified bank callback; an error, conflict or mismatch routes the operation to manual review.',
    noticeTitle: 'Safe verification sequence',
    noticeBody: 'Select a Deal below. Its workspace shows the real next action and blockers from the server. Close the mandatory conditions, then an authorized money role with current MFA may send a release request. Until the bank callback arrives, the funds remain unconfirmed.',
    labels: {
      money: 'Amount',
      blocker: 'Blocker',
      owner: 'Owner',
      result: 'Result chain',
      nextAction: 'Next safe action',
      prioritySection: 'Primary payout-readiness task',
      factsSection: 'Non-negotiable payout boundaries',
    },
  },
  zh: {
    metadataTitle: '付款就绪检查',
    metadataDescription: '进入具体交易的付款条件检查，访问权限由服务器确认，客户端不能放款。',
    eyebrow: '付款 · 依据 · 外部银行回调',
    title: '付款就绪检查不是放款按钮',
    description: '请选择服务器确认可访问的交易。Backend 会在创建银行申请前检查预留、金额、冻结、争议、文件、监管状态、运输、验收、质量和人工停止项。',
    status: '只有银行可以确认付款',
    priorityTitle: '打开交易并检查实际阻塞项',
    priorityDescription: '全局页面不得根据 fixture 数据计算付款就绪状态。判断只能基于具体交易的当前服务器状态和参与方权限。',
    amount: '由服务器在具体交易中确定',
    blocker: '未选择交易时，付款就绪状态无法确认',
    owner: '参与方关闭条件，银行确认操作',
    result: '付款申请 → 回调 → 对账 → 审计',
    registryAction: '选择交易',
    bankAction: '返回银行工作区',
    reserveLabel: '资金预留',
    reserveValue: '必须已确认',
    reserveHint: '预留申请本身不能开启付款',
    evidenceLabel: '付款依据',
    evidenceValue: '完整证据包',
    evidenceHint: '文件、验收、质量、运输以及不存在未结争议',
    requestLabel: '付款申请',
    requestValue: '幂等命令',
    requestHint: '创建 outbox 记录，但不会把资金状态设为 RELEASED',
    callbackLabel: '最终确认',
    callbackValue: '经过验证的银行回调',
    callbackHint: '签名、事件 ID、操作 ID、防重放和后续对账',
    boundary: '平台不能手动设置 RESERVED 或 RELEASED。即使所有条件已关闭，平台也只能创建申请。只有经过验证的银行回调才能改变资金状态；错误、冲突或不一致会转入人工复核。',
    noticeTitle: '安全检查顺序',
    noticeBody: '请在下方选择交易。交易工作区会显示服务器返回的实际下一步和阻塞项。关闭必备条件后，具有当前 MFA 的授权资金角色可以发送付款申请。在银行回调到达之前，资金仍视为未确认。',
    labels: {
      money: '金额',
      blocker: '阻塞项',
      owner: '负责人',
      result: '结果链',
      nextAction: '下一项安全操作',
      prioritySection: '主要付款检查任务',
      factsSection: '不可绕过的付款边界',
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

export default async function BankReleaseSafetyPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];

  return (
    <MoneyObligationCockpit
      testId='platform-v7-bank-release-safety-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status}
      statusTone='warning'
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
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/bank'>{copy.bankAction}</Link>,
      }}
      facts={[
        { label: copy.reserveLabel, value: copy.reserveValue, hint: copy.reserveHint },
        { label: copy.evidenceLabel, value: copy.evidenceValue, hint: copy.evidenceHint },
        { label: copy.requestLabel, value: copy.requestValue, hint: copy.requestHint },
        { label: copy.callbackLabel, value: copy.callbackValue, hint: copy.callbackHint },
      ]}
    >
      <MoneyBoundary>{copy.boundary}</MoneyBoundary>
      <MoneyCockpitSection id='release-deals'>
        <InlineNotice tone='warning' title={copy.noticeTitle}>{copy.noticeBody}</InlineNotice>
        <CanonicalDealsList />
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}
