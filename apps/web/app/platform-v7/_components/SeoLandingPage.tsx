import Link from 'next/link';

export type SeoLandingPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  benefitTitle: string;
  benefits: string[];
  mechanicsTitle: string;
  mechanics: string[];
  riskTitle: string;
  risks: string[];
  primaryCta?: string;
  related?: Array<{ href: string; label: string }>;
};

export function SeoLandingPage({
  eyebrow,
  title,
  lead,
  benefitTitle,
  benefits,
  mechanicsTitle,
  mechanics,
  riskTitle,
  risks,
  primaryCta = 'Обсудить подключение',
  related = [],
}: SeoLandingPageProps) {
  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 22, padding: 22, display: 'grid', gap: 12 }}>
        <div style={{ color: '#0A7A5F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>{eyebrow}</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 54px)', lineHeight: 1, letterSpacing: '-.05em', color: 'var(--pc-text-primary, #0F1419)' }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 820, fontSize: 16, lineHeight: 1.7, color: 'var(--pc-text-secondary, #475569)' }}>{lead}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <Link href='/platform-v7/contact' style={primaryButton}>{primaryCta}</Link>
          <Link href='/platform-v7/demo' style={secondaryButton}>Посмотреть демо-сделку</Link>
          <Link href='/platform-v7' style={secondaryButton}>На главную</Link>
        </div>
      </section>

      <section style={gridTwo}>
        <InfoCard title={benefitTitle} items={benefits} />
        <InfoCard title={mechanicsTitle} items={mechanics} />
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 20, display: 'grid', gap: 12 }}>
        <h2 style={h2}>{riskTitle}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {risks.map((item) => <Bullet key={item} text={item} />)}
        </div>
      </section>

      {related.length ? (
        <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 20, display: 'grid', gap: 12 }}>
          <h2 style={h2}>Смежные разделы</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {related.map((item) => (
              <Link key={item.href} href={item.href} style={chip}>{item.label}</Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 20, display: 'grid', gap: 12 }}>
      <h2 style={h2}>{title}</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => <Bullet key={item} text={item} />)}
      </div>
    </article>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--pc-text-secondary, #475569)', fontSize: 14, lineHeight: 1.65 }}>
      <span style={{ color: '#0A7A5F', fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}

const h2 = { margin: 0, fontSize: 22, lineHeight: 1.15, letterSpacing: '-.03em', color: 'var(--pc-text-primary, #0F1419)' } as const;
const gridTwo = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 } as const;
const primaryButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 14, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const secondaryButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 14, background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 14, fontWeight: 800 } as const;
const chip = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 38, padding: '0 12px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 13, fontWeight: 800 } as const;
