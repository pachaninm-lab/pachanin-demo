import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

export default function ExecutionStudioPage() {
  return (
    <AppShell title="Execution studio" subtitle="Сборка controlled-pilot сценариев и визуализация полного execution rail">
      <div className="stack-sm">
        <Link href="/execution-studio/EXE-001" className="secondary-link">EXE-001</Link>
        <Link href="/execution-studio/EXE-002" className="secondary-link">EXE-002</Link>
      </div>
    </AppShell>
  );
}
