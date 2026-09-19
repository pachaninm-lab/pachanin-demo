import { redirect } from 'next/navigation';

type SupportSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformV7SupportDetailPage(
  props: { searchParams?: Promise<SupportSearchParams> },
) {
  const params = (await props.searchParams) ?? {};
  const legacyCaseId = one(params.id);
  redirect(legacyCaseId
    ? `/platform-v7/contact?source=support-detail&legacyCaseId=${encodeURIComponent(legacyCaseId)}`
    : '/platform-v7/contact?source=support-detail');
}
