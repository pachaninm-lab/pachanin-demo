import type { Metadata } from 'next';
import { SupportCaseRouteClient } from '@/components/platform-v7/SupportCaseRouteClient';

export const metadata: Metadata = {
  title: 'Карточка обращения',
  description: 'Карточка обращения поддержки исполнения сделки.',
};

export default async function SupportCasePage({ params }: { params: Promise<{ caseId: string }> | { caseId: string } }) {
  const { caseId } = await Promise.resolve(params);
  return <SupportCaseRouteClient caseId={caseId} />;
}
