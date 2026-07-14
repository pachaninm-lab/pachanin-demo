import { redirect } from 'next/navigation';

export default async function PlatformV7SupportCasePage({
  params,
}: {
  params: Promise<{ caseId: string }> | { caseId: string };
}) {
  const { caseId } = await Promise.resolve(params);
  redirect(`/platform-v7/contact?source=support-case&legacyCaseId=${encodeURIComponent(caseId)}`);
}
