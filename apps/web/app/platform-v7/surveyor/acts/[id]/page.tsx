import { redirect } from 'next/navigation';

export default function PlatformV7SurveyorActPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/surveyor?actId=${encodeURIComponent(params.id)}`);
}
