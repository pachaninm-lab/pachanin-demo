import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { SourceNote } from '../../components/source-note';
import { CommercialExpansionBoard } from '../../components/commercial-expansion-board';
import { getCommercialExpansionReadModel } from '../../lib/commercial-expansion-server';

export default async function Page() {
  const payload = await getCommercialExpansionReadModel();
  return (
    <PageAccessGuard allowedRoles={['SUPPORT_MANAGER', 'ACCOUNTING', 'EXECUTIVE', 'ADMIN']}>
      <AppShell title="Expansion" subtitle="Connected runtime board">
        <div className="space-y-6">
          <SourceNote source={payload.meta.source} updatedAt={payload.meta.updatedAt} warning="Runtime-connected expansion board." />
          <CommercialExpansionBoard payload={payload as any} />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
