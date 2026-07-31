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
    status: string;
    privacy: string;
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
    navTrust: 'Доверие',
    support: 'Поддержка',
    call: 'Позвонить',
    stepsMore: 'Показать шаги 5–7',
    trust: {
      eyebrow: 'Доверие и контроль',
      title: 'Проверяемые правила работы платформы',
      lead: 'Крупная организация должна понимать не только возможности продукта, но и границы полномочий, происхождение фактов и порядок принятия решений.',
      cards: [
        {
          title: 'Роли и полномочия',
          text: 'Доступные данные и действия определяются организационным контуром и ролью участника. Критические операции требуют подтверждения уполномоченного лица.',
        },
        {
          title: 'История и доказательства',
          text: 'События, версии документов, основания и решения сохраняются в истории Сделки и связываются с ответственным участником.',
        },
        {
          title: 'Граница TAI',
          text: 'TAI сопоставляет факты, объясняет риск и предлагает допустимые действия, но не подменяет решение участника и не получает самостоятельных полномочий.',
        },
        {
          title: 'Честный статус контуров',
          text: 'Внутренняя доступность и внешние подключения показываются раздельно. Неподтверждённый обмен не обозначается как работающая интеграция.',
        },
      ],
      details: 'Открыть Trust Center',
      status: 'Состояние системы',
      privacy: 'Обработка данных',
    },
    connection: {
      eyebrow: 'Подключение организации',
      title: 'От заявки до первой управляемой Сделки',
      lead: 'До формы показан полный следующий путь: что определяет организация, что подтверждается при подключении и какой результат она получает.',
      steps: [
        {
          index: '01',
          title: 'Определяем контур работы',
          text: 'Фиксируем организацию, участников, роли, товары и бизнес-задачу, с которой начинается работа.',
        },
        {
          index: '02',
          title: 'Подтверждаем данные и полномочия',
          text: 'Согласуем ответственных, необходимые документы, источники данных и системы, участвующие в процессе.',
        },
        {
          index: '03',
          title: 'Запускаем Сделки',
          text: 'Организация получает номер заявки, подтверждённый следующий шаг и начинает работу в едином контуре исполнения.',
        },
      ],
    },
  },
  en: {
    navTrust: 'Trust',
    support: 'Support',
    call: 'Call',
    stepsMore: 'Show steps 5–7',
    trust: {
      eyebrow: 'Trust and control',
      title: 'Verifiable operating rules',
      lead: 'An enterprise buyer needs to understand not only product capability, but also authority boundaries, fact provenance and the decision process.',
      cards: [
        {
          title: 'Roles and authority',
          text: 'Available data and actions are determined by the organisation context and participant role. Critical operations require confirmation by an authorised person.',
        },
        {
          title: 'History and evidence',
          text: 'Events, document versions, evidence and decisions remain connected to the Deal and the responsible participant.',
        },
        {
          title: 'TAI boundary',
          text: 'TAI matches facts, explains risk and presents permitted actions, but does not replace participant judgement or gain independent authority.',
        },
        {
          title: 'Honest system status',
          text: 'Internal availability and external connections are reported separately. Unconfirmed exchange is never presented as a live integration.',
        },
      ],
      details: 'Open Trust Center',
      status: 'System status',
      privacy: 'Data processing',
    },
    connection: {
      eyebrow: 'Organisation connection',
      title: 'From request to the first controlled Deal',
      lead: 'The complete next path is visible before the form: what the organisation defines, what is confirmed during connection and what outcome it receives.',
      steps: [
        {
          index: '01',
          title: 'Define the operating scope',
          text: 'Identify the organisation, participants, roles, products and the first business task.',
        },
        {
          index: '02',
          title: 'Confirm data and authority',
          text: 'Confirm owners, required documents, data sources and systems involved in the process.',
        },
        {
          index: '03',
          title: 'Start operating Deals',
          text: 'The organisation receives a request number, a confirmed next step and starts work in one execution workflow.',
        },
      ],
    },
  },
  zh: {
    navTrust: '信任',
    support: '支持',
    call: '致电',
    stepsMore: '显示第 5–7 步',
    trust: {
      eyebrow: '信任与控制',
      title: '可验证的平台运行规则',
      lead: '企业客户不仅需要了解产品能力，还需要了解权限边界、事实来源和决策流程。',
      cards: [
        {
          title: '角色与权限',
          text: '可用数据和操作由机构范围与参与方角色决定，关键操作必须由获授权人员确认。',
        },
        {
          title: '历史与证据',
          text: '事件、文件版本、依据和决定都保存在交易历史中，并与责任参与方关联。',
        },
        {
          title: 'TAI 边界',
          text: 'TAI 对照事实、解释风险并提供允许的操作，但不会替代参与方决定，也不会获得独立权限。',
        },
        {
          title: '真实系统状态',
          text: '内部可用性与外部连接分别展示，未经确认的数据交换不会被标记为已上线集成。',
        },
      ],
      details: '打开信任中心',
      status: '系统状态',
      privacy: '数据处理',
    },
    connection: {
      eyebrow: '机构接入',
      title: '从申请到第一笔受控交易',
      lead: '表单前明确展示完整下一步：机构需要确定什么、接入时确认什么，以及最终获得什么。',
      steps: [
        {
          index: '01',
          title: '确定工作范围',
          text: '确定机构、参与方、角色、商品以及首先启动的业务任务。',
        },
        {
          index: '02',
          title: '确认数据与权限',
          text: '确认责任方、所需文件、数据来源以及参与流程的系统。',
        },
        {
          index: '03',
          title: '开始运行交易',
          text: '机构获得申请编号、明确的下一步，并在统一执行流程中开始工作。',
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
        <a href={`/platform-v7/status?lang=${locale}`}>{copy.status}</a>
        <a href={`/platform-v7/privacy?lang=${locale}`}>{copy.privacy}</a>
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
