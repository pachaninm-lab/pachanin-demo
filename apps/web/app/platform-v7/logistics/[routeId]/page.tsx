import { redirect } from 'next/navigation';

export default function LogisticsRouteAliasPage({ params }: { params: { routeId: string } }) {
  redirect(`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(params.routeId)}`);
}
