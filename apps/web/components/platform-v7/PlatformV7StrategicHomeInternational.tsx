import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { getLocale } from 'next-intl/server';
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';
import { PlatformV7StrategicHome as BasePlatformV7StrategicHome } from './PlatformV7StrategicHome';
import { OrganizationConnectForm } from './OrganizationConnectForm';
import { PublicSiteHeader } from './PublicSiteHeader';
import '@/styles/platform-v7-international-home-fix.css';

type Locale = 'ru' | 'en' | 'zh';
type ElementProps = Record<string, unknown> & {
  children?: ReactNode;
  className?: string;
  htmlFor?: string;
  id?: string;
  nav?: ReactNode;
};

type LocalizedCopy = Readonly<{
  navTrust: string;
  support: string;
  call: string;
  stepsMore: string;
  trust: Readonly<{
    eyebrow: string;
    title: string;
    lead: string;
    cards: ReadonlyArray<Readonly<{ title: string; text: string }>>;
    details: string;
    deal: string;
    connect: string;
  }>;
  connection: Readonly<{
    eyebrow: string;
    title: string;
    lead: string;
    steps: ReadonlyArray<Readonly<{ index: string; title: string; text: string }>>;
  }>;
}>;

const SUPPORT_PHONE_HREF = 'tel:+79162778989';

const COPY: Record<Locale, LocalizedCopy> = {
  ru: {
    navTrust: 'Контроль',
    support: 'Поддержка',
    call: 'Позвонить',
    stepsMore: 'Показать шаги 5–7',
    trust: {
      eyebrow: 'Единый контроль',
      title: 'Сделка управляется по одной версии фактов',
      lead: 'Платформа связывает участников, события, документы, решения и денежные последствия. Для каждой роли видны ответственность, основание и следующий шаг.',
      cards: [
        {
          title: 'Ролевой рабочий контур',
          text: 'Каждый участник видит свою часть Сделки, доступные действия и ожидаемый результат.',
        },
        {
          title: 'Единая история',
          text: 'Условия, события, документы, отклонения и решения сохраняются в хронологии одной Сделки.',
        },
        {
          title: 'TAI в процессе',
          text: 'ИИ сопоставляет факты, объясняет влияние на риск и расчёт и готовит допустимый следующий шаг.',
        },
        {
          title: 'Контроль результата',
          text: 'Отклонение связано с ответственным, сроком, основанием и денежным последствием.',
        },
      ],
      details: 'Посмотреть правила контроля',
      deal: 'Посмотреть Сделку',
      connect: 'Начать работу',
    },
    connection: {
      eyebrow: 'Следующий шаг',
      title: 'Начните работу с платформой',
      lead: 'Укажите организацию, роль и рабочую задачу. Платформа зарегистрирует заявку и вернёт номер обращения с конкретным следующим действием.',
      steps: [
        {
          index: '01',
          title: 'Выберите рабочий сценарий',
          text: 'Определите, с чего начать: полный цикл Сделки, логистика, качество, документы, расчёты или обмен данными.',
        },
        {
          index: '02',
          title: 'Укажите организацию и ответственного',
          text: 'Передайте только данные, необходимые для регистрации заявки и связи с вашей командой.',
        },
        {
          index: '03',
          title: 'Получите зафиксированный следующий шаг',
          text: 'Система выдаёт номер заявки, а команда платформы продолжает работу по выбранному сценарию.',
        },
      ],
    },
  },
  en: {
    navTrust: 'Control',
    support: 'Support',
    call: 'Call',
    stepsMore: 'Show steps 5–7',
    trust: {
      eyebrow: 'Unified control',
      title: 'The Deal is managed from one version of facts',
      lead: 'The platform connects participants, events, documents, decisions and monetary consequences. Every role sees its responsibility, evidence and next step.',
      cards: [
        {
          title: 'Role-based workspace',
          text: 'Each participant sees their part of the Deal, permitted actions and expected outcome.',
        },
        {
          title: 'One Deal history',
          text: 'Terms, events, documents, deviations and decisions remain in one Deal timeline.',
        },
        {
          title: 'TAI in the workflow',
          text: 'AI matches facts, explains the impact on risk and settlement and prepares a permitted next step.',
        },
        {
          title: 'Outcome control',
          text: 'Every deviation is linked to an owner, deadline, evidence and monetary consequence.',
        },
      ],
      details: 'See control rules',
      deal: 'See the Deal',
      connect: 'Get started',
    },
    connection: {
      eyebrow: 'Next step',
      title: 'Start working with the platform',
      lead: 'Provide the organisation, role and operating task. The platform registers the request and returns a reference number with a concrete next action.',
      steps: [
        {
          index: '01',
          title: 'Choose an operating scenario',
          text: 'Start with the complete Deal lifecycle, logistics, quality, documents, settlement or data exchange.',
        },
        {
          index: '02',
          title: 'Provide the organisation and owner',
          text: 'Submit only the information required to register the request and contact your team.',
        },
        {
          index: '03',
          title: 'Receive a recorded next step',
          text: 'The system returns a request number and the platform team continues with the selected scenario.',
        },
      ],
    },
  },
  zh: {
    navTrust: '控制',
    support: '支持',
    call: '致电',
    stepsMore: '显示第 5–7 步',
    trust: {
      eyebrow: '统一控制',
      title: '交易基于同一版本事实进行管理',
      lead: '平台连接参与方、事件、文件、决定与资金后果。每个角色都能看到自己的责任、依据和下一步。',
      cards: [
        {
          title: '按角色工作',
          text: '每个参与方只看到自己的交易范围、允许的操作和预期结果。',
        },
        {
          title: '统一交易历史',
          text: '条件、事件、文件、偏差和决定保存在同一笔交易时间线中。',
        },
        {
          title: '流程内的 TAI',
          text: 'AI 对照事实，说明对风险和结算的影响，并准备允许的下一步。',
        },
        {
          title: '结果控制',
          text: '每项偏差都关联责任方、期限、依据和资金后果。',
        },
      ],
      details: '查看控制规则',
      deal: '查看交易',
      connect: '开始使用',
    },
    connection: {
      eyebrow: '下一步',
      title: '开始使用平台',
      lead: '填写机构、角色和工作任务。平台会登记申请，并返回申请编号和明确的下一步。',
      steps: [
        {
          index: '01',
          title: '选择工作场景',
          text: '可从完整交易周期、物流、质量、文件、结算或数据交换开始。',
        },
        {
          index: '02',
          title: '填写机构与负责人',
          text: '仅提交登记申请和联系团队所需的信息。',
        },
        {
          index: '03',
          title: '获得已记录的下一步',
          text: '系统生成申请编号，平台团队按所选场景继续推进。',
        },
      ],
    },
  },
};

const TRUST_ICONS = [ShieldCheck, FileCheck2, Bot, Activity] as const;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function TrustSection({ locale, copy }: { locale: Locale; copy: LocalizedCopy['trust'] }) {
  return (
    <section id='trust' className='pc-v6-section pc-home-trust' aria-labelledby='pc-home-trust-title'>
      <div className='pc-v6-section-head'>
        <span>{copy.eyebrow}</span>
        <h2 id='pc-home-trust-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>
      <div className='pc-home-trust-grid'>
        {copy.cards.map((card, index) => {
          const Icon = TRUST_ICONS[index] ?? ShieldCheck;
          return (
            <article key={card.title}>
              <Icon aria-hidden='true' />
              <div><strong>{card.title}</strong><p>{card.text}</p></div>
            </article>
          );
        })}
      </div>
      <div className='pc-home-trust-actions'>
        <a className='pc-home-trust-primary' href={`/platform-v7/trust?lang=${locale}`}>
          {copy.details}<ArrowRight aria-hidden='true' size={17} />
        </a>
        <a href='#live'>{copy.deal}</a>
        <a href='#connect-organization'>{copy.connect}</a>
      </div>
    </section>
  );
}

function ConnectionProcess({ copy }: { copy: LocalizedCopy['connection'] }) {
  return (
    <section id='connection-process' className='pc-v6-section pc-home-connection-process' aria-labelledby='pc-home-connection-title'>
      <div className='pc-v6-section-head'>
        <span>{copy.eyebrow}</span>
        <h2 id='pc-home-connection-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>
      <div className='pc-home-connection-grid'>
        {copy.steps.map((step) => (
          <article key={step.index}>
            <span>{step.index}</span>
            <Building2 aria-hidden='true' />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function normalizedKey(key: ReactElement['key']): string {
  return String(key ?? '').replace(/^\.\$/u, '');
}

function transformNode(node: ReactNode, locale: Locale, copy: LocalizedCopy): ReactNode {
  if (Array.isArray(node)) return Children.toArray(node).map((child) => transformNode(child, locale, copy));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<ElementProps>;
  const props = element.props;

  if (props.id === 'deal-path') return null;
  if (element.type === 'article' && normalizedKey(element.key) === '08') return null;

  if (props.htmlFor === 'functions-more-toggle') {
    const icons = Children.toArray(props.children).filter((child) => isValidElement(child));
    return cloneElement(element, undefined, copy.stepsMore, ...icons);
  }

  const transformedChildren = Children.toArray(props.children)
    .map((child) => transformNode(child, locale, copy));

  let transformed: ReactElement = cloneElement(element, undefined, ...transformedChildren);

  if (element.type === PublicSiteHeader) {
    transformed = cloneElement(element, {
      nav: (
        <>
          {props.nav}
          <a href='#trust'>{copy.navTrust}</a>
          <a className='pc-home-mobile-contact-link' href={`/platform-v7/contact?lang=${locale}`}>{copy.support}</a>
          <a className='pc-home-mobile-contact-link' href={SUPPORT_PHONE_HREF}>{copy.call}</a>
        </>
      ),
    });
  }

  if (props.id === 'faq') {
    return (
      <Fragment key='trust-before-faq'>
        <TrustSection locale={locale} copy={copy.trust} />
        {transformed}
      </Fragment>
    );
  }

  if (element.type === OrganizationConnectForm) {
    return (
      <Fragment key='connection-process-and-form'>
        <ConnectionProcess copy={copy.connection} />
        {transformed}
      </Fragment>
    );
  }

  return transformed;
}

export async function PlatformV7StrategicHome() {
  const locale = localeOf(await getLocale());
  const base = await BasePlatformV7StrategicHome();
  return transformNode(base, locale, COPY[locale]);
}
