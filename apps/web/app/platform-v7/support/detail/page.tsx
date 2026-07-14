import { redirect } from 'next/navigation';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformV7SupportDetailPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const legacyCaseId = one(params.id);
  redirect(legacyCaseId
    ? `/platform-v7/contact?source=support-detail&legacyCaseId=${encodeURIComponent(legacyCaseId)}`
    : '/platform-v7/contact?source=support-detail');
}
