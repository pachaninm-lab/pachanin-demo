import { getGoldenPath } from '../lib/golden-paths';

type CanonicalRoleHome = {
  summary?: {
    title?: string;
    primaryCta?: string;
    queueCount?: number;
    blockerCount?: number;
    unreadCount?: number;
  };
  widgets?: {
    queue?: Array<{ id?: string; title?: string; label?: string; detail?: string; nextAction?: string; severity?: string }>;
    alerts?: Array<{ id?: string; title?: string; label?: string; detail?: string }>;
    documents?: Array<unknown>;
    supportTickets?: Array<unknown>;
  };
};

function deriveStage(roleId: string, canonical?: CanonicalRoleHome | null) {
  const queue = canonical?.widgets?.queue || [];
  const blockers = Number(canonical?.summary?.blockerCount || canonical?.widgets?.alerts?.length || 0);
  const primary = String(canonical?.summary?.primaryCta || queue?.[0]?.nextAction || '').toLowerCase();

  if (roleId === 'seller' || roleId === 'buyer') {
    if (primary.includes('док') || blockers > 2) return 'docs';
    if (primary.includes('деньг') || primary.includes('оплат')) return roleId === 'seller' ? 'money' : 'settlement';
    if (primary.includes('прием') || primary.includes('приём')) return 'receiving';
    if (primary.includes('сделк')) return 'deal';
    if (primary.includes('торг') || primary.includes('ставк') || primary.includes('оффер')) return 'origin';
    return roleId === 'seller' ? 'lot' : 'search';
  }
  if (roleId === 'logistics') {
    if (primary.includes('подтверд') || primary.includes('точк')) return 'checkpoint';
    if (primary.includes('выгруз') || primary.includes('прием')) return 'arrival';
    return 'trip';
  }
  if (roleId === 'driver') {
    if (primary.includes('погруз')) return 'load';
    if (primary.includes('выгруз') || primary.includes('передач')) return 'handoff';
    if (primary.includes('маршрут') || primary.includes('рейс')) return 'trip';
    return 'accept';
  }
  if (roleId === 'lab') {
    if (primary.includes('пломб')) return 'seal';
    if (primary.includes('протокол') || primary.includes('результ')) return 'result';
    if (primary.includes('цен') || primary.includes('спор')) return 'impact';
    return 'sample';
  }
  if (roleId === 'receiving') {
    if (primary.includes('вес')) return 'weight';
    if (primary.includes('решен') || primary.includes('приня')) return 'decision';
    if (primary.includes('деньг') || primary.includes('фин')) return 'handoff';
    return 'queue';
  }
  if (roleId === 'finance') {
    if (primary.includes('hold') || blockers > 0) return 'hold';
    if (primary.includes('release') || primary.includes('оплат')) return 'release';
    if (primary.includes('сверк') || primary.includes('закры')) return 'close';
    return 'readiness';
  }
  if (roleId === 'executive') {
    if (primary.includes('спор') || primary.includes('риск')) return 'risk';
    if (primary.includes('касс') || primary.includes('оплат')) return 'cash';
    if (primary.includes('сделк') || blockers > 0) return 'flow';
    return 'market';
  }
  if (roleId === 'ops' || roleId === 'admin') {
    if (blockers > 0) return 'blocker';
    if (primary.includes('эскал') || primary.includes('исполн')) return 'execution';
    if (primary.includes('закры') || primary.includes('спор')) return 'close';
    return roleId === 'admin' ? 'health' : 'intake';
  }
  return '';
}

export function JourneyFocusPanel({ roleId, canonical }: { roleId: string; canonical?: CanonicalRoleHome | null }) {
  const path = getGoldenPath(roleId);
  if (!path) return null;

  const queue = canonical?.widgets?.queue || [];
  const alerts = canonical?.widgets?.alerts || [];
  const documents = canonical?.widgets?.documents || [];
  const supportTickets = canonical?.widgets?.supportTickets || [];
  const blockers = Number(canonical?.summary?.blockerCount || alerts.length || 0);
  const nextAction = canonical?.summary?.primaryCta || queue?.[0]?.nextAction || queue?.[0]?.title || 'Открыть главный рабочий объект';
  const currentItem = queue?.[0];
  const stageCode = deriveStage(roleId, canonical);

  return (
    <section className="detail-header detail-hero-grid">
      <div className="min-w-0">
        <div className="eyebrow">Единый рабочий путь</div>
        <div className="detail-title">{path.title}</div>
        <div className="page-subtitle" style={{ marginTop: 8, maxWidth: 860 }}>{path.outcome}</div>
        <div className="panel-grid" style={{ marginTop: 18 }}>
          <div className="info-card card-accent">
            <div className="label">Что происходит сейчас</div>
            <div className="value">{currentItem?.title || currentItem?.label || canonical?.summary?.title || 'Рабочий контур готов к действию'}</div>
            <div className="small muted" style={{ marginTop: 8 }}>{currentItem?.detail || 'Следующий шаг должен быть виден без переходов по служебным разделам.'}</div>
          </div>
          <div className="info-card">
            <div className="label">Следующий шаг</div>
            <div className="value">{nextAction}</div>
            <div className="small muted" style={{ marginTop: 8 }}>Сильный экран должен отвечать не обзором, а действием.</div>
          </div>
          <div className="info-card">
            <div className="label">Что блокирует</div>
            <div className="value">{blockers}</div>
            <div className="small muted" style={{ marginTop: 8 }}>{blockers ? 'Есть блокеры. Они должны вести в точку решения, а не в обзорный тупик.' : 'Критичных блокеров сейчас не видно.'}</div>
          </div>
        </div>
      </div>
      <div className="aside-stack min-w-[300px]">
        <div className="info-card">
          <div className="label">Ключевые сигналы</div>
          <div className="role-kpi-grid" style={{ marginTop: 12 }}>
            <div className="info-card"><div className="label">очередь</div><div className="value">{Number(canonical?.summary?.queueCount || queue.length || 0)}</div></div>
            <div className="info-card"><div className="label">документы</div><div className="value">{documents.length}</div></div>
            <div className="info-card"><div className="label">support</div><div className="value">{supportTickets.length}</div></div>
            <div className="info-card"><div className="label">alerts</div><div className="value">{alerts.length}</div></div>
          </div>
        </div>
      </div>
      <div className="dashboard-section" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
        <div className="panel-title-row">
          <div>
            <h2 className="dashboard-section-title" style={{ marginBottom: 8 }}>Путь без хаоса</h2>
            <p className="dashboard-section-subtitle" style={{ marginBottom: 0 }}>Пользователь должен понимать, где он находится в процессе и что ведёт к результату.</p>
          </div>
        </div>
        <div className="dashboard-grid-3" style={{ marginTop: 16 }}>
          {path.steps.map((step, index) => {
            const active = step.code === stageCode;
            return (
              <div key={step.code} className="dashboard-card" style={{ borderColor: active ? 'rgba(44,201,107,.35)' : undefined, boxShadow: active ? '0 0 0 1px rgba(44,201,107,.2) inset' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div className="dashboard-list-title">{index + 1}. {step.label}</div>
                  <span className={`status-pill ${active ? 'green' : 'gray'}`}>{active ? 'сейчас' : 'шаг'}</span>
                </div>
                <div className="dashboard-list-subtitle" style={{ marginTop: 10 }}>{step.hint}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
