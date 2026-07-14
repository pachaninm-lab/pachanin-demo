import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice } from '@pc/design-system-v8';
import {
  AuctionPostgresAuthorityWorkspace,
  getAuctionAuthorityMetadata,
} from '@/components/transaction-ux/AuctionPostgresAuthorityWorkspace';
import { operationalCockpitClasses } from '@/components/transaction-ux/OperationalDecisionCockpit';

export const generateMetadata = () => getAuctionAuthorityMetadata('import');

type Locale = 'ru' | 'en' | 'zh';

const COPY: Record<Locale, Readonly<{
  title: string;
  description: string;
  action: string;
}>> = {
  ru: {
    title: 'Подтверди организацию до подключения внешнего источника',
    description: 'Бизнес-вход подтверждает организацию и полномочия. Он не заменяет доступ к ФГИС «Зерно» и не создаёт локальный лот.',
    action: 'Подтвердить организацию',
  },
  en: {
    title: 'Confirm the organization before connecting an external source',
    description: 'Business identity confirms the organization and authority. It does not replace grain-registry access or create a local lot.',
    action: 'Confirm organization',
  },
  zh: {
    title: '连接外部来源前确认组织',
    description: '企业身份用于确认组织和权限。它不能替代粮食登记系统访问，也不会创建本地批次。',
    action: '确认组织',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default async function FarmerFgisAccessPage(
  props: {
    searchParams?: Promise<{ lotId?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  const copy = COPY[localeOf(await getLocale())];

  return (
    <>
      <InlineNotice tone='information' title={copy.title}>
        {copy.description}{' '}
        <Link
          className={operationalCockpitClasses.secondaryLink}
          href='/api/platform-v7/gov-id/start?flow=fgis'
        >
          {copy.action}
        </Link>
      </InlineNotice>
      <AuctionPostgresAuthorityWorkspace
        stage='import'
        lotId={firstParam(searchParams?.lotId)}
      />
    </>
  );
}
