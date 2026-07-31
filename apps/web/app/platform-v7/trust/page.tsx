import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import BaseTrustCenterPage from '../../trust/page';

type Locale = 'ru' | 'en' | 'zh';
type ElementProps = Record<string, unknown> & { children?: ReactNode };

const METADATA: Record<Locale, Readonly<{ title: string; description: string }>> = {
  ru: {
    title: 'Trust Center — безопасность, данные и ИИ',
    description: 'Публичные правила полномочий, доказательств, обработки данных, доступности и использования TAI в платформе Прозрачная Цена.',
  },
  en: {
    title: 'Trust Center — security, data and AI',
    description: 'Public authority, evidence, data-processing, availability and TAI boundaries for the Transparent Price platform.',
  },
  zh: {
    title: '信任中心 — 安全、数据与 AI',
    description: '透明价格平台公开的权限、证据、数据处理、可用性与 TAI 边界。',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function clarifyTaiAuthority(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return node.replace(
      'TAI не получает самостоятельного права',
      'У TAI нет самостоятельного права',
    );
  }
  if (Array.isArray(node)) return Children.toArray(node).map(clarifyTaiAuthority);
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<ElementProps>;
  const children = Children.toArray(element.props.children).map(clarifyTaiAuthority);
  return cloneElement(element, undefined, ...children);
}

export default async function PlatformV7TrustPage() {
  return clarifyTaiAuthority(await BaseTrustCenterPage());
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
