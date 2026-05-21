import { DemoDealAutoplay } from '@/components/v7r/DemoDealAutoplay';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>Демо автопрогон сделки {params.id}</div>
      <DemoDealAutoplay dealId={params.id} amount={10500000} />
    </div>
  );
}
