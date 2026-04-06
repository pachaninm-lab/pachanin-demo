import Link from 'next/link';

const tone = (value?: string | null) => {
  if (value === 'GREEN') return 'highlight-green';
  if (value === 'AMBER') return 'highlight-amber';
  return 'highlight-red';
};

export function EvidencePackPanel({ pack, compact = false }: { pack?: any; compact?: boolean }) {
  if (!pack) return null;

  return (
    <section className="card">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Evidence pack</div>
          <div className="muted small" style={{ marginTop: 8 }}>
            Сделка должна собирать подтверждающий контур: документы, маршрут, приёмку, лабораторию, деньги и журнал событий.
          </div>
        </div>
        <div className={tone(pack.band)}>{pack.band || 'RED'} · {pack.score || 0}/100</div>
      </div>

      <div className="muted small" style={{ marginTop: 12 }}>{pack.nextAction || 'Следующий шаг по пакету подтверждений не определён.'}</div>

      <div className={compact ? 'stack-sm' : 'grid cols-2'} style={{ marginTop: 12 }}>
        {(pack.requiredArtifacts || []).map((item: any) => (
          <div key={item.code} className="soft-box">
            <div className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <b>{item.title}</b>
                <div className="muted tiny" style={{ marginTop: 6 }}>{item.detail}</div>
              </div>
              <div className={item.present ? 'highlight-green' : 'highlight-red'}>{item.present ? 'OK' : 'GAP'}</div>
            </div>
            {item.href ? <div style={{ marginTop: 8 }}><Link href={item.href} className="button-secondary">Открыть контур</Link></div> : null}
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="soft-box">
          <div className="muted tiny">Пробелы</div>
          <div style={{ marginTop: 6 }}>{(pack.gaps || []).length ? pack.gaps.join(' · ') : 'Критичных gaps не видно.'}</div>
        </div>
        <div className="soft-box">
          <div className="muted tiny">Сводка</div>
          <div style={{ marginTop: 6 }}>{pack.summary?.auditEvents || 0} event(s) · docs {pack.summary?.documents || 0} · labs {pack.summary?.labs || 0} · payments {pack.summary?.payments || 0}</div>
        </div>
      </div>
    </section>
  );
}
