import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import BaseTrustCenterPage from '../../trust/page';

type Locale = 'ru' | 'en' | 'zh';
type ElementProps = Record<string, unknown> & {
  children?: ReactNode;
  href?: unknown;
  actions?: ReactNode;
  brandHomeLabel?: unknown;
};

const METADATA: Record<Locale, Readonly<{ title: string; description: string }>> = {
  ru: {
    title: 'Trust Center — безопасность, данные и Гекта',
    description: 'Публичные правила полномочий, доказательств, обработки данных, внешних систем и использования Гекты в платформе «Прозрачная Цена».',
  },
  en: {
    title: 'Trust Center — security, data and Gekta',
    description: 'Public authority, evidence, data-processing, external-system and Gekta boundaries for the Transparent Price platform.',
  },
  zh: {
    title: '信任中心 — 安全、数据与 Gekta',
    description: '透明价格平台公开的权限、证据、数据处理、外部系统与 Gekta 边界。',
  },
};

const HEADER_COPY = {
  ru: { login: 'Войти', register: 'Зарегистрироваться', brandHome: 'Прозрачная Цена — на главную' },
  en: { login: 'Sign in', register: 'Register', brandHome: 'Transparent Price — home' },
  zh: { login: '登录', register: '注册', brandHome: '透明价格 — 返回首页' },
} as const;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function rebrandTrustCopy(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === 'string') {
    if (locale === 'ru') {
      return node
        .replaceAll('У TAI', 'У Гекты')
        .replaceAll('TAI', 'Гекта')
        .replaceAll('Сертификаты, внешняя доступность и подключение конкретного провайдера не заявляются без отдельного доказательства.', 'Сертификаты и действия конкретного внешнего провайдера не заявляются без отдельного доказательства.')
        .replaceAll('Доступность и внешние контуры', 'Границы внешних систем')
        .replaceAll('Внутреннее состояние платформы и внешние интеграции рассматриваются раздельно.', 'Собственная логика платформы и действия внешних систем рассматриваются раздельно.')
        .replaceAll('Работающий внутренний сервис не доказывает доступность банка, ФГИС, ЭДО или лабораторной системы.', 'Внутренняя функция платформы не доказывает, что внешний банк, ФГИС, ЭДО или лабораторная система выполнили соответствующее действие.')
        .replaceAll('Внешнее подключение считается подтверждённым только после реального обмена и эксплуатационного контроля.', 'Внешнему провайдеру приписывается только действие, для которого есть внешнее основание.')
        .replaceAll('Неподтверждённый статус не преобразуется в положительное состояние интерфейсом.', 'Интерфейс не подменяет отсутствующее внешнее основание внутренним предположением.')
        .replaceAll('Эти ограничения защищают клиента от формальной зрелости и ложной уверенности.', 'Эти границы защищают клиента от неподтверждённых обещаний и ложной уверенности.')
        .replaceAll('SLA и география доступности — без принятого договорного обязательства.', 'SLA и география обслуживания — без принятого договорного обязательства.')
        .replaceAll('Подключение конкретного банка, государственного сервиса, ЭДО или LIMS — без подтверждённого production-обмена.', 'Участие конкретного банка, государственного сервиса, ЭДО или LIMS — без внешнего основания и разрешённого обмена.');
    }
    if (locale === 'en') {
      return node
        .replaceAll('TAI', 'Gekta')
        .replaceAll('Certifications, external availability and named-provider connections are not claimed without separate evidence.', 'Certifications and actions by a named external provider are not claimed without separate evidence.')
        .replaceAll('Availability and external systems', 'External-system boundaries')
        .replaceAll('Internal platform state and external integrations are evaluated separately.', 'Platform logic and actions by external systems are treated separately.')
        .replaceAll('A healthy internal service does not prove availability of a bank, registry, EDI or laboratory system.', 'An internal platform function does not prove that a bank, registry, EDI or laboratory system performed the corresponding action.')
        .replaceAll('An external connection is confirmed only after real exchange and operational monitoring.', 'An external provider is attributed only actions supported by external evidence.')
        .replaceAll('An unconfirmed state is never converted into a positive UI status.', 'The interface never substitutes an internal assumption for missing external evidence.')
        .replaceAll('These boundaries protect the customer from formal maturity and false confidence.', 'These boundaries protect the customer from unsupported claims and false confidence.')
        .replaceAll('SLA or availability geography without an accepted contractual commitment.', 'SLA or service geography without an accepted contractual commitment.')
        .replaceAll('A live bank, government, EDI or LIMS connection without confirmed production exchange.', 'Participation by a named bank, government service, EDI or LIMS without external evidence and authorised exchange.');
    }
    return node
      .replaceAll('TAI', 'Gekta')
      .replaceAll('没有单独证据时，不声明认证、外部可用性或特定服务商已连接。', '没有单独证据时，不声明认证，也不把未经外部依据支持的动作归给特定服务商。')
      .replaceAll('可用性与外部系统', '外部系统边界')
      .replaceAll('平台内部状态与外部集成分别评估。', '平台自身逻辑与外部系统的动作分开处理。')
      .replaceAll('内部服务正常不代表银行、登记系统、电子文件或实验室系统可用。', '平台内部功能不能证明银行、登记系统、电子文件或实验室系统执行了相应动作。')
      .replaceAll('外部连接仅在真实交换和运行监控后确认。', '只有存在外部依据时，平台才把相应动作归给外部服务方。')
      .replaceAll('未确认状态不会被界面转换为正面状态。', '界面不会用内部假设替代缺失的外部依据。')
      .replaceAll('这些边界保护客户，避免形式化成熟度和错误信心。', '这些边界保护客户，避免未经支持的承诺和错误信心。')
      .replaceAll('没有已接受的合同承诺时，不声明 SLA 或可用地区。', '没有已接受的合同承诺时，不声明 SLA 或服务地区。')
      .replaceAll('没有确认的生产交换时，不声明银行、政府、电子文件或 LIMS 已上线连接。', '没有外部依据和获授权的数据交换时，不声明特定银行、政府服务、电子文件或 LIMS 参与其中。');
  }
  if (Array.isArray(node)) return Children.toArray(node).map((child) => rebrandTrustCopy(child, locale));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<ElementProps>;
  const nextProps: Partial<ElementProps> = {};
  if (element.props.href === '/platform-v7') {
    nextProps.href = `/platform-v7?lang=${locale}`;
  }
  if (element.props.brandHomeLabel !== undefined) {
    nextProps.brandHomeLabel = HEADER_COPY[locale].brandHome;
  }
  if (element.props.actions !== undefined) {
    nextProps.actions = (
      <div className='pc-v6-header-actions'>
        <a href={`/platform-v7/login?lang=${locale}`} className='entry-login'>{HEADER_COPY[locale].login}</a>
        <a href={`/platform-v7/register?lang=${locale}`} className='pc-v6-header-cta'>{HEADER_COPY[locale].register}</a>
      </div>
    );
  }
  const children = Children.toArray(element.props.children).map((child) => rebrandTrustCopy(child, locale));
  return cloneElement(element, nextProps, ...children);
}

export default async function PlatformV7TrustPage() {
  const locale = localeOf(await getLocale());
  const page = rebrandTrustCopy(await BaseTrustCenterPage(), locale);
  return (
    <Fragment>
      <style>{'.p7-ai-trigger,.p7-support-chat-button{display:none!important}.pc-trust-page .entry-login,.pc-trust-page .pc-v6-header-cta{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:760;white-space:nowrap}.pc-trust-page .entry-login{border:1px solid #c6d5cb;background:#fff;color:#173d2b}.pc-trust-page .pc-v6-header-cta{border:1px solid #087a3b;background:#087a3b;color:#fff}@media(max-width:560px){.pc-trust-page .entry-login{display:none}.pc-trust-page .pc-v6-header-cta{padding-inline:10px;font-size:12px}}'}</style>
      {page}
    </Fragment>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const copy = METADATA[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: '/platform-v7/trust',
      languages: {
        ru: '/platform-v7/trust?lang=ru',
        en: '/platform-v7/trust?lang=en',
        zh: '/platform-v7/trust?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}
