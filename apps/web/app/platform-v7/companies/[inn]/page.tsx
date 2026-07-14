import { redirect } from 'next/navigation';

export default function CompanyPage({ params }: { params: { inn: string } }) {
  redirect(`/platform-v7/compliance?inn=${encodeURIComponent(params.inn)}`);
}
