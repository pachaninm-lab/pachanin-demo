import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { getRuntimeExportPack, getRuntimeSnapshot } from '../../lib/runtime-server';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';

type SearchParams = { kind?: 'deal' | 'finance' | 'dispute' | 'compliance' | 'pilot_kpi'; dealId?: string };

function amount(value?: number | null) {
  if (!value) return '—';
  return `${Number(value).toLocaleString('ru-RU')} ₽`;
}

export default async function ExportPacksPage({ searchParams }: { searchParams?: SearchParams }) {
  const snapshot = await getRuntimeSnapshot();
  const dealId = searchParams?.dealId || snapshot.deals?.[0]?.id;
  const kind = searchParams?.kind || (dealId ? 'deal' : 'pilot_kpi');
  const data = await getRuntimeExportPack(kind as any, dealId);
  const pack = data.pack;
  const kinds = [
    ['deal', 'Deal pack'],
    ['finance', 'Finance decision pack'],
    ['dispute', 'Dispute pack'],
    ['compliance', 'Compliance pack'],
    ['pilot_kpi', 'Pilot KPI pack']
  ] as const;

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Export packs ограничены" subtitle="Пакеты сделки, комплаенса и финансов доступны только рабочим ролям сделки и операторскому контуру.">
      <AppShell title="Export packs" subtitle="Готовые пакеты для банка, инвестора, арбитража и комплаенса прямо из системы, а не руками по чатам и папкам.">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Export packs' }]} />
        <SourceNote source={data.meta?.source || 'runtime.export-pack'} warning="Экспорт нужен не для красоты. Это доказательный слой: таймлайн, документы, качество, деньги, решения и audit trail в одном пакете." compact />

        <section className="dashboard-grid-5">
          {kinds.map(([value, label]) => (
            <Link key={value} href={`/export-packs?kind=${value}${dealId ? `&dealId=${dealId}` : ''}`} className="dashboard-card">
              <div className="dashboard-card-title">{label}</div>
              <div className="dashboard-card-caption">{kind === value ? 'Открыт сейчас' : 'Открыть пакет'}</div>
            </Link>
          ))}
        </section>

        {dealId ? (
          <section className="section-card-tight">
            <div className="section-title">Сделка</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {snapshot.deals.slice(0, 6).map((deal: any) => (
                <Link key={deal.id} href={`/export-packs?kind=${kind}&dealId=${deal.id}`} className="mini-chip">{deal.id}</Link>
              ))}
            </div>
          </section>
        ) : null}

        {!pack ? <div className="section-card">Пакет недоступен.</div> : null}

        {pack?.pilotKpis ? (
          <section className="dashboard-grid-5">
            <div className="dashboard-card"><div className="dashboard-card-title">Release ready</div><div className="dashboard-card-value">{pack.pilotKpis.metrics?.releaseReadyRate ?? 0}%</div><div className="dashboard-card-caption">benchmark {pack.pilotKpis.benchmark?.releaseReadyRate || '—'}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Dispute rate</div><div className="dashboard-card-value">{pack.pilotKpis.metrics?.disputeRate ?? 0}%</div><div className="dashboard-card-caption">benchmark {pack.pilotKpis.benchmark?.disputeRate || '—'}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Evidence avg</div><div className="dashboard-card-value">{pack.pilotKpis.metrics?.avgEvidenceScore ?? 0}</div><div className="dashboard-card-caption">benchmark {pack.pilotKpis.benchmark?.avgEvidenceScore || '—'}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Blockers / deal</div><div className="dashboard-card-value">{pack.pilotKpis.metrics?.avgBlockersPerDeal ?? 0}</div><div className="dashboard-card-caption">benchmark {pack.pilotKpis.benchmark?.avgBlockersPerDeal || '—'}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Money at risk</div><div className="dashboard-card-value">{pack.metrics?.moneyAtRisk ?? 0}</div><div className="dashboard-card-caption">{amount(pack.metrics?.moneyAtRiskAmountRub ?? 0)}</div></div>
          </section>
        ) : null}

        {Array.isArray(pack?.goldenPaths) && pack.goldenPaths.length ? (
          <section className="section-card">
            <div className="dashboard-section-title">Golden paths</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {pack.goldenPaths.map((path: any) => (
                <div key={path.id} className="soft-box">
                  <div className="panel-title-row">
                    <div>
                      <b>{path.title}</b>
                      <div className="muted tiny">{path.lane} · probability {path.probability ?? '—'}%</div>
                    </div>
                    <div className="detail-meta">
                      {(path.tags || []).map((tag: string) => <span key={tag} className="mini-chip">{tag}</span>)}
                    </div>
                  </div>
                  <div className="muted small" style={{ marginTop: 8 }}>{path.description}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {Array.isArray(pack?.documents) && pack.documents.length ? (
          <section className="section-card">
            <div className="dashboard-section-title">Документы</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {pack.documents.map((doc: any) => (
                <div key={doc.id} className="dashboard-list-card">
                  <div className="dashboard-list-main">
                    <div className="dashboard-list-icon">⌁</div>
                    <div>
                      <div className="dashboard-list-title">{doc.title || doc.type || doc.id}</div>
                      <div className="dashboard-list-subtitle">{doc.status || 'draft'} · {doc.sourceOfTruth || doc.source || 'unknown source'}</div>
                    </div>
                  </div>
                  <div className="dashboard-list-meta">
                    <StatusChip value={doc.status || 'unknown'} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      </AppShell>
    </PageAccessGuard>
  );
}

function StatusChip({ value }: { value: string }) {
  const upper = String(value).toUpperCase();
  const tone = upper.includes('OK') || upper.includes('READY') || upper.includes('GREEN') ? 'green' : upper.includes('WARN') || upper.includes('AMBER') ? 'amber' : upper.includes('RED') || upper.includes('BLOCK') ? 'red' : 'gray';
  return <span className={`status-pill ${tone}`}>{value}</span>;
}
