import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleContinuityPanel role='lab' compact />
      <FieldLabRuntime />
    </div>
  );
}
