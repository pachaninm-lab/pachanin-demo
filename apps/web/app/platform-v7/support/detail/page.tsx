import { redirect } from 'next/navigation';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupportDetailRoute({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const params = await Promise.resolve(searchParams ?? {});
  const id = String(one(params.id) || '').trim();
  redirect(id ? `/platform-v7/support/${encodeURIComponent(id)}` : '/platform-v7/support');
}
