import type { Metadata } from 'next';
import { SupportCaseDetailPage } from '@/components/platform-v7/SupportCaseDetailPage';

export const metadata: Metadata = {
  title: 'Обращение поддержки',
  description: 'Детали обращения по сделке, рейсу, документу, деньгам или блокеру.',
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupportDetailRoute({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const params = await Promise.resolve(searchParams ?? {});
  const id = one(params.id) ?? '';
  return <SupportCaseDetailPage caseId={id} />;
}
