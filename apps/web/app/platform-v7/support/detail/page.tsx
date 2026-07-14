import { redirect } from 'next/navigation';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformV7SupportDetailPage(
  props: {
    searchParams?: Promise<Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await Promise.resolve(searchParams ?? {});
  const legacyCaseId = one(params.id);
  redirect(legacyCaseId
    ? `/platform-v7/contact?source=support-detail&legacyCaseId=${encodeURIComponent(legacyCaseId)}`
    : '/platform-v7/contact?source=support-detail');
}
