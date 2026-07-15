import { redirect } from 'next/navigation';

export default async function CompanyPage(props: { params: Promise<{ inn: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/compliance?inn=${encodeURIComponent(params.inn)}`);
}
