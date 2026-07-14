import { redirect } from 'next/navigation';

export default async function PlatformV7SurveyorActPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/surveyor?actId=${encodeURIComponent(params.id)}`);
}
