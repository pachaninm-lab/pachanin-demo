import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { EXECUTIVE_ROLES, OPERATOR_ROLES, ELEVATOR_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function InventoryDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const batch = state.inventoryBatches.find((item) => item.id === params.id) || null;

  if (!batch) {
    return (
      <PageFrame title="Партия не найдена" subtitle="Карточка inventory batch отсутствует в текущем workspace.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в inventory rail и открой актуальную партию.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/inventory" className="primary-link">Inventory rail</Link>
            <Link href="/receiving" className="secondary-link">Receiving</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...OPERATOR_ROLES, ...ELEVATOR_ROLES, ...INTERNAL_ONLY_ROLES]} title="Карточка партии ограничена" subtitle="Карточка inventory batch нужна складу, оператору и управляющим ролям.">
      <PageFrame title={batch.id} subtitle={`${batch.culture} · ${batch.tons} т · ${batch.storageSite}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/inventory', label: 'Inventory' }, { label: batch.id }]} />}>
        <SourceNote source="commercial workspace / storage projection" warning="Карточка inventory batch должна быть рабочим storage rail с linked receiving, quality и документами, а не просто остатком на складе." compact />
        <DetailHero
          kicker="Inventory batch"
          title={batch.storageSite}
          description={`Партия ${batch.culture} · ${batch.grade}. Показываем quality, weight, storage и куда batch должен передаваться дальше.`}
          chips={[`${batch.tons} т`, batch.qualityStatus, batch.weightStatus, batch.status]}
          nextStep={batch.linkedDealId ? 'Открыть linked deal и проверить storage / settlement связь.' : 'Проверить linked receiving rail и quality path.'}
          owner="storage rail"
          blockers={batch.blockers?.join(' · ') || 'критичных blockers по batch не отмечено'}
          actions={[
            { href: '/inventory', label: 'Назад в inventory' },
            batch.linkedDealId ? { href: `/deals/${batch.linkedDealId}`, label: 'Открыть сделку', variant: 'secondary' } : { href: '/receiving', label: 'Receiving', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' },
          ]}
        />
        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Storage / quality</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Storage site</span><b>{batch.storageSite}</b></div>
              <div className="list-row"><span>Culture / grade</span><b>{batch.culture} · {batch.grade}</b></div>
              <div className="list-row"><span>Quality</span><b>{batch.qualityStatus}</b></div>
              <div className="list-row"><span>Weight</span><b>{batch.weightStatus}</b></div>
              <div className="list-row"><span>Linked deal</span><b>{batch.linkedDealId || '—'}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {(batch.nextRails || ['Documents', 'Settlement', 'Dispatch']).map((item) => <span key={item} className="mini-chip">{item}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>Партия не должна оставаться только внутри inventory rail. Дальше обязаны быть quality, documents и money / dispatch continuation.</div>
          </div>
        </div>
        <ModuleHub
          title="Связанные модули партии"
          subtitle="Inventory batch должен вести дальше: receiving, documents, deal, settlement."
          items={[
            { href: '/receiving', label: 'Receiving', detail: 'Понять, с какого слота и handoff пришла партия.', icon: '🏁', meta: batch.linkedDealId || 'slot', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить weight tickets и quality evidence.', icon: '⌁', meta: 'evidence', tone: 'green' },
            batch.linkedDealId ? { href: `/deals/${batch.linkedDealId}`, label: 'Deal rail', detail: 'Связать storage batch со сделкой и settlement.', icon: '≣', meta: batch.linkedDealId, tone: 'amber' } : { href: '/settlement', label: 'Settlement', detail: 'Перейти в money rail после quality/storage handoff.', icon: '₽', meta: 'next', tone: 'amber' },
          ]}
        />
        <NextStepBar
          title={batch.linkedDealId ? 'Открыть сделку и проверить storage continuation' : 'Открыть receiving / settlement rail'}
          detail={`${batch.id} · ${batch.storageSite}`}
          primary={{ href: batch.linkedDealId ? `/deals/${batch.linkedDealId}` : '/settlement', label: batch.linkedDealId ? 'Открыть сделку' : 'Открыть settlement' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/receiving', label: 'Receiving' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
