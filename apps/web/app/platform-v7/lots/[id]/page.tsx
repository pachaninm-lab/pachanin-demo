'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { selectLotBiddingSimulation, selectWinningLotBid } from '@/lib/platform-v7/domain/lot-bidding-simulation';

export default function LotPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const simulation = selectLotBiddingSimulation(id);

  if (!simulation) {
    return <div>Лот не найден</div>;
  }

  const { lot, bids, resultingDealId } = simulation;
  const winner = selectWinningLotBid(simulation);

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <h1>{lot.id} · {lot.title}</h1>

      <div>
        {simulation.chain.join(' → ')}
      </div>

      <div>
        <strong>Статус:</strong> {lot.readiness.state}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {bids.map((b) => (
          <div key={b.id} style={{ border: '1px solid #ccc', padding: 12 }}>
            <div>{b.buyer}</div>
            <div>{b.pricePerTon} ₽/т</div>
            <div>{b.status}</div>
          </div>
        ))}
      </div>

      {winner && resultingDealId && (
        <div>
          <div>Победитель: {winner.buyer}</div>
          <button onClick={() => router.push(`/platform-v7/deals/${resultingDealId}`)}>
            Перейти к сделке
          </button>
        </div>
      )}

      {!winner && (
        <div>
          Торг заблокирован: {lot.readiness.nextStep}
        </div>
      )}

      <Link href="/platform-v7/lots">Назад</Link>

    </div>
  );
}
