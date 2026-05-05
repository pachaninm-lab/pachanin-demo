import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SupportCaseView } from '@/components/platform-v7/SupportCaseView';
import { SUPPORT_AUDIT_EVENTS, SUPPORT_CASES, SUPPORT_INTERNAL_NOTES, SUPPORT_MESSAGES } from '@/lib/platform-v7/support-data';

export const metadata: Metadata = {
  title: 'Карточка обращения',
  description: 'Карточка обращения поддержки исполнения сделки.',
};

export default async function SupportCasePage({ params }: { params: Promise<{ caseId: string }> | { caseId: string } }) {
  const { caseId } = await Promise.resolve(params);
  const item = SUPPORT_CASES.find((supportCase) => supportCase.id === caseId);
  if (!item) notFound();
  const messages = SUPPORT_MESSAGES.filter((message) => message.caseId === item.id && message.public);
  const notes = SUPPORT_INTERNAL_NOTES.filter((note) => note.caseId === item.id);
  const audit = SUPPORT_AUDIT_EVENTS.filter((event) => event.caseId === item.id);

  return <SupportCaseView item={item} messages={messages} notes={notes} audit={audit} />;
}
