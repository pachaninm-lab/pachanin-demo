import { redirect } from 'next/navigation';

export default async function PlatformV7SupportCasePage(
  props: {
    params: Promise<Promise<{ caseId: string }> | { caseId: string }>;
  }
) {
  const params = await props.params;
  const { caseId } = await Promise.resolve(params);
  redirect(`/platform-v7/contact?source=support-case&legacyCaseId=${encodeURIComponent(caseId)}`);
}
