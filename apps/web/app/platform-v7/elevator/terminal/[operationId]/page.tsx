import { redirect } from 'next/navigation';

export default async function PlatformV7ElevatorOperationPage(props: { params: Promise<{ operationId: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/elevator?operationId=${encodeURIComponent(params.operationId)}`);
}
