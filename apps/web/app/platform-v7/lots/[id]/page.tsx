'use client';

import { useParams } from 'next/navigation';
import { selectLotBiddingSimulation } from '@/lib/platform-v7/domain/lot-bidding-simulation';
import { AuctionSimulationWorkspace } from '@/components/platform-v7/AuctionSimulationWorkspace';

export default function LotPage() {
  const params = useParams();
  const id = String(params.id);
  const simulation = selectLotBiddingSimulation(id);

  if (!simulation) {
    return <div>Лот не найден</div>;
  }

  return <AuctionSimulationWorkspace simulation={simulation} />;
}
