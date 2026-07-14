import { redirect } from 'next/navigation';

export default async function PlatformV7SupportCasePage(
  props: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await props.params;
  redirect(`/platform-v7/contact?source=support-case&legacyCaseId=${encodeURIComponent(caseId)}`);
}
