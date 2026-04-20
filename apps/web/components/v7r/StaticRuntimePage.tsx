import Link from 'next/link';

type StaticAction = {
  label: string;
  href: string;
  primary?: boolean;
};

type StaticSection = {
  title: string;
  body: string;
};

type StaticMetric = {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn';
};

function metricPalette(tone: StaticMetric['tone']) {
  if (tone === 'good') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warn') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(15,20,25,0.04)', border: 'rgba(15,20,25,0.08)', color: '#0F1419' };
}

export function StaticRuntimePage({
  eyebrow,
  title,
  description,
  metrics,
  sections,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: StaticMetric[];
  sections: StaticSection[];
  actions: StaticAction[];
}) {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: '#0A7A5F' }} />
          <span style={{ fontSize: 12, fontWeight: 900, color: '#0F1419' }}>{eyebrow}</span>
        </div>
        <div>
          <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 900, color: '#0F1419' }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#5B6576', maxWidth: 920 }}>{description}</div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {metrics.map((metric) => {
          const palette = metricPalette(metric.tone);
          return (
            <section key={metric.label} style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 16, display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{metric.label}</div>
              <div style={{ fontSize: 24, lineHeight: 1.1, fontWeight: 900, color: palette.color }}>{metric.value}</div>
            </section>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {sections.map((section) => (
          <section key={section.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{section.title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{section.body}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            style={{
              textDecoration: 'none',
              padding: '10px 14px',
              borderRadius: 12,
              background: action.primary ? '#0A7A5F' : '#fff',
              border: `1px solid ${action.primary ? '#0A7A5F' : '#E4E6EA'}`,
              color: action.primary ? '#fff' : '#0F1419',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
