import Link from 'next/link';

const cards = [
  { href: '/platform-v4-redesign/deal', label: 'Deal Center', text: 'Status, blocker, next action, money at risk.' },
  { href: '/platform-v4-redesign/bank', label: 'Bank', text: 'Reserve, hold, release, callbacks, mismatch.' },
  { href: '/platform-v4-redesign/documents', label: 'Documents', text: 'Document pack completeness and payment release.' },
  { href: '/platform-v4-redesign/control', label: 'Control', text: 'SLA, owner, evidence pack, dispute control.' },
  { href: '/platform-v4-redesign/seller', label: 'Seller', text: 'Lots, trips, expected money, commercial flow.' },
  { href: '/platform-v4-redesign/buyer', label: 'Buyer', text: 'Procurement, receiving, quality, release.' },
  { href: '/platform-v4-redesign/driver', label: 'Driver', text: 'One trip, one step, one confirmation.' },
  { href: '/platform-v4-redesign/receiving', label: 'Receiving', text: 'Weight, quality delta, fact confirmation.' },
] as const;

export default function Page() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f6f8fb 0%,#ffffff 46%,#f3f6fa 100%)', color: '#0f172a' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 16px 56px', display: 'grid', gap: 20 }}>
        <Link href='/platform-v4-redesign' style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, width: 'fit-content', padding: '0 16px', borderRadius: 999, border: '1px solid #dbe3ee', background: '#fff', color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>
          Back to redesign home
        </Link>

        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 28, padding: 32, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#2563eb' }}>Role directory</div>
          <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(2.4rem,5vw,4.3rem)', lineHeight: 1.02, letterSpacing: '-.03em', maxWidth: '10ch' }}>
            Each role opens a workspace, not the same green card.
          </h1>
          <p style={{ margin: '18px 0 0', maxWidth: 820, fontSize: 18, lineHeight: 1.65, color: '#475569' }}>
            This screen is split by deal execution logic. First money and control. Then operating roles. The main action is visible immediately.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {cards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: 'none',
                color: '#0f172a',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 10px 30px rgba(15,23,42,.05)',
                minHeight: 220,
                display: 'grid',
                alignContent: 'space-between',
                gap: 18,
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 34, width: 'fit-content', padding: '0 12px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Workspace
                </div>
                <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, letterSpacing: '-.03em' }}>{item.label}</h2>
                <p style={{ margin: 0, color: '#475569', fontSize: 17, lineHeight: 1.65 }}>{item.text}</p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, width: 'fit-content', padding: '0 18px', borderRadius: 14, background: '#0f172a', color: '#fff', fontWeight: 800 }}>
                Open screen
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
