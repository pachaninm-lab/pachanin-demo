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
  startTitle: string;
  boundaryTitle: string;
  boundary: string;
  open: string;
  topics: ReadonlyArray<Readonly<{ title: string; detail: string; status: string }>>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Справочный центр · Прозрачная Цена', metadataDescription: 'Проверяемые маршруты помощи по Сделке, доступу, документам, деньгам и спору без вымышленных операций.',
    eyebrow: 'Помощь по намерению', title: 'Найти следующий шаг, а не изучать устройство платформы',
    description: 'Выбери задачу, которую нужно решить. Справочный центр направляет в канонический контур Сделки и не обещает автоматическую выплату, подключённую интеграцию или действие без серверного подтверждения.',
    startTitle: 'Основные задачи', boundaryTitle: 'Граница справочного центра',
    boundary: 'Справочный текст не меняет статус Сделки, роль, документы или деньги. Критическое действие считается выполненным только после серверной команды, проверки прав, идемпотентности, аудита и подтверждения соответствующего участника или внешнего контура.',
    open: 'Открыть',
    topics: [
      { title: 'Продолжить Сделку', detail: 'Открой participant-scoped реестр и выбери одну каноническую Сделку.', status: 'Сделка' },
      { title: 'Проверить доступ', detail: 'Профиль показывает роль, организацию, membership и MFA из серверной сессии.', status: 'Доступ' },
      { title: 'Проверить деньги', detail: 'Резерв, удержание и release подтверждаются банковым основанием и callback, а не кнопкой интерфейса.', status: 'Деньги' },
      { title: 'Решить проблему', detail: 'Документы, спор и доказательства остаются связанными с конкретной Сделкой.', status: 'Риск' },
    ],
    routes: [
      { href: '/platform-v7/deals', title: 'Реестр Сделок', detail: 'Найти доступную Сделку и её следующее действие.' },
      { href: '/platform-v7/profile', title: 'Профиль доступа', detail: 'Проверить текущую роль, организацию, membership и MFA.' },
      { href: '/platform-v7/onboarding', title: 'Готовность к работе', detail: 'Проверить доступ и перейти к первой Сделке.' },
      { href: '/platform-v7/status', title: 'Состояние системы', detail: 'Отделить подтверждённые внутренние сигналы от внешних интеграций.' },
      { href: '/platform-v7/connectors', title: 'Интеграционные контуры', detail: 'Проверить диагностическое состояние без production-утверждений.' },
      { href: '/platform-v7/request', title: 'Направить обращение', detail: 'Передать вопрос оператору без изменения данных в браузере.' },
    ],
  },
  en: {
    metadataTitle: 'Help centre · Transparent Price', metadataDescription: 'Verifiable routes for Deal, access, documents, money and dispute help without fabricated operations.',
    eyebrow: 'Intent-based help', title: 'Find the next step instead of learning the platform structure',
    description: 'Choose the task to resolve. The help centre routes work into the canonical Deal circuit and never promises an automatic payout, connected integration or action without server confirmation.',
    startTitle: 'Primary tasks', boundaryTitle: 'Help-centre boundary',
    boundary: 'Help content does not change a Deal, role, document or money state. A critical action is complete only after a server command, authorization check, idempotency, audit and confirmation by the relevant participant or external circuit.',
    open: 'Open',
    topics: [
      { title: 'Continue a Deal', detail: 'Open the participant-scoped registry and select one canonical Deal.', status: 'Deal' },
      { title: 'Check access', detail: 'The profile shows role, organization, membership and MFA from the server session.', status: 'Access' },
      { title: 'Check money', detail: 'Reserve, hold and release require a bank basis and callback, not a UI button.', status: 'Money' },
      { title: 'Resolve a problem', detail: 'Documents, dispute and evidence remain linked to a specific Deal.', status: 'Risk' },
    ],
    routes: [
      { href: '/platform-v7/deals', title: 'Deal registry', detail: 'Find an accessible Deal and its next action.' },
      { href: '/platform-v7/profile', title: 'Access profile', detail: 'Check the current role, organization, membership and MFA.' },
      { href: '/platform-v7/onboarding', title: 'Work readiness', detail: 'Confirm access and move to the first Deal.' },
      { href: '/platform-v7/status', title: 'System status', detail: 'Separate confirmed internal signals from external integrations.' },
      { href: '/platform-v7/connectors', title: 'Integration circuits', detail: 'Review diagnostic state without production claims.' },
      { href: '/platform-v7/request', title: 'Send a request', detail: 'Escalate to an operator without changing browser state.' },
    ],
  },
  zh: {
    metadataTitle: '帮助中心 · 透明价格', metadataDescription: '针对交易、访问、单证、资金和争议的可验证帮助路径，不展示虚构操作。',
    eyebrow: '按意图提供帮助', title: '找到下一步，而不是学习平台结构',
    description: '选择要解决的任务。帮助中心将工作引导到规范交易闭环，不承诺自动付款、已连接集成或未经服务器确认的操作。',
    startTitle: '主要任务', boundaryTitle: '帮助中心边界',
    boundary: '帮助内容不会改变交易、角色、单证或资金状态。关键操作只有在服务器命令、权限检查、幂等、审计以及相关参与方或外部闭环确认后才算完成。',
    open: '打开',
    topics: [
      { title: '继续交易', detail: '打开参与方范围登记册并选择一笔规范交易。', status: '交易' },
      { title: '检查访问', detail: '档案显示服务器会话中的角色、组织、membership 和 MFA。', status: '访问' },
      { title: '检查资金', detail: '预留、冻结和释放需要银行依据与 callback，而不是界面按钮。', status: '资金' },
      { title: '解决问题', detail: '单证、争议和证据始终关联到具体交易。', status: '风险' },
    ],
    routes: [
      { href: '/platform-v7/deals', title: '交易登记册', detail: '查找可访问交易及其下一步。' },
      { href: '/platform-v7/profile', title: '访问档案', detail: '检查当前角色、组织、membership 和 MFA。' },
      { href: '/platform-v7/onboarding', title: '工作准备度', detail: '确认访问后进入首笔交易。' },
      { href: '/platform-v7/status', title: '系统状态', detail: '区分已确认内部信号与外部集成。' },
      { href: '/platform-v7/connectors', title: '集成闭环', detail: '查看诊断状态，不作生产连接声明。' },
      { href: '/platform-v7/request', title: '提交请求', detail: '向操作员升级，不改变浏览器状态。' },
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

export default async function HelpPage() {
  const copy = COPY[localeOf(await getLocale())];
  return (
    <main className={styles.root} data-testid='platform-v7-help-v8'>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.description}</p>
      </header>

      <section className={styles.section} aria-labelledby='help-primary-tasks'>
        <h2 className={styles.sectionTitle} id='help-primary-tasks'>{copy.startTitle}</h2>
        <div className={styles.grid}>
          {copy.topics.map((topic) => (
            <article className={styles.card} key={topic.title}>
              <StatusChip tone='neutral'>{topic.status}</StatusChip>
              <h3 className={styles.cardTitle}>{topic.title}</h3>
              <p className={styles.cardText}>{topic.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-label={copy.startTitle}>
        <div className={styles.gridThree}>
          {copy.routes.map((route) => (
            <Link className={styles.link} href={route.href} key={route.href}>
              <span>
                <strong>{route.title}</strong><br />
                <span className={styles.muted}>{route.detail}</span>
              </span>
              <span aria-hidden='true'>→</span>
            </Link>
          ))}
        </div>
      </section>

      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </main>
  );
}
