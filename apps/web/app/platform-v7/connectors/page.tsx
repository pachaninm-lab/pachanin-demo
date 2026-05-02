import { TestModeSystemsPanel } from '@/components/platform-v7/TestModeSystemsPanel';
import { ConnectorsPage } from '@/components/v7r/EsiaFgisRuntime';

export default function PlatformV7ConnectorsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <TestModeSystemsPanel />
      <ConnectorsPage />
    </div>
  );
}
