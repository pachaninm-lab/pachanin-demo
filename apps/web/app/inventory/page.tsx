import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { EXECUTIVE_ROLES, OPERATOR_ROLES, ELEVATOR_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function InventoryPage() {
  const state = await readCommercialWorkspace();
  const batches = Array.isArray(state?.inventoryBatches) ? state.inventoryBatches : [
    { id: 'LOT-001', culture: 'Пшеница 3 кл.', grade: '3 класс', tons: 280, storageSite: 'Тамбовский узел', qualityStatus: 'GREEN', weightStatus: 'CONFIRMED', status: 'READY', linkedDealId: 'DEAL-001' },
    { id: 'LOT-002', culture: 'Подсолнечник', grade: 'масличный', tons: 190, storageSite: 'Липецкий узел', qualityStatus: 'AMBER', weightStatus: 'PENDING', status: 'REVIEW', linkedDealId: 'DEAL-002' },
  ];

  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...OPERATOR_ROLES, ...ELEVATOR_ROLES, ...INTERNAL_ONLY_ROLES]} title="Inventory rail ограничен" subtitle="Экран партий нужен складу, оператору и управляющим ролям как рабочий storage rail.">
      <PageFrame title="Inventory" subtitle="Партии, quality profile и следующий переход в deal / documents / settlement rail." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Inventory' }]} />}>
        <SourceNote source="commercial workspace / storage projection" warning="Inventory rail не должен быть просто списком остатков. Из него должен быть прямой вход в quality, documents, receiving и deal rail." compact />

        <DetailHero
          kicker="Inventory registry"
          title="Партии хранения и исполнения"
          description="Каждая партия должна вести дальше: в документы, settlement, receiving или связанную сделку."
          chips={[`batches ${batches.length}`, `tons ${(batches as any[]).reduce((acc: number, item: any) => acc + Number(item.tons || 0), 0)}`, 'storage rail']}
          nextStep="Открыть проблемную партию и довести handoff в следующий rail."
          owner="storage / operator"
          blockers={batches.some((item: any) => String(item.qualityStatus) !== 'GREEN' || String(item.weightStatus) !== 'CONFIRMED') ? 'есть партии с quality/weight blockers' : 'критичных blockers по batch-реестру не видно'}
          actions={[
            { href: '/documents', label: 'Documents' },
            { href: '/settlement', label: 'Settlement', variant: 'secondary' },
            { href: '/receiving', label: 'Receiving', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Партии</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {batches.map((batch: any) => (
              <Link key={batch.id} href={`/inventory/${batch.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{batch.culture} · {batch.grade}</div>
                  <div className="muted small">{batch.id} · {batch.storageSite} · {batch.tons} т</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">{batch.status}</div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>{batch.linkedDealId || '—'}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из inventory rail оператор должен уходить в documents, receiving, settlement и linked deal rail."
          items={[
            { href: '/documents', label: 'Documents', detail: 'Проверить weight tickets и quality evidence по партии.', icon: '⌁', meta: 'evidence', tone: 'green' },
            { href: '/receiving', label: 'Receiving', detail: 'Понять, с какого слота и handoff пришла партия.', icon: '🏁', meta: 'receiving', tone: 'blue' },
            { href: '/settlement', label: 'Settlement', detail: 'После final quality/storage handoff перевести batch в money rail.', icon: '₽', meta: 'money', tone: 'amber' },
            { href: '/deals', label: 'Deal rail', detail: 'Открыть linked deal и проверить execution continuation.', icon: '≣', meta: 'deals', tone: 'gray' },
          ]}
        />

        <NextStepBar
          title="Открыть проблемную партию"
          detail="Следующий шаг — зайти в batch и довести handoff в deal / documents / settlement rail."
          primary={{ href: '/inventory/LOT-001', label: 'Открыть партию' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/settlement', label: 'Settlement' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
