import { DemoDealAutoplay } from '@/components/v7r/DemoDealAutoplay';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>Автопрогон сценария сделки {params.id}</div>
      <DemoDealAutoplay dealId={params.id} amount={10500000} />
    </div>
  );
}
