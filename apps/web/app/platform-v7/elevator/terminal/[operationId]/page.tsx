import { redirect } from 'next/navigation';

export default function PlatformV7ElevatorOperationPage({ params }: { params: { operationId: string } }) {
  redirect(`/platform-v7/elevator?operationId=${encodeURIComponent(params.operationId)}`);
}
