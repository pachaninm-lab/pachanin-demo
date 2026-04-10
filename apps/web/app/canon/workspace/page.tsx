import Link from 'next/link';

const modules = [
  ['Рынок', '/canon/market'],
  ['Сделки', '/canon/deals'],
  ['Операции', '/canon/operations'],
  ['Приёмка', '/canon/receiving2'],
  ['Качество', '/canon/quality'],
  ['Документы', '/canon/documents'],
  ['Финансы', '/canon/finance'],
  ['Контроль', '/canon/control'],
  ['Интеграции', '/canon/integrations'],
  ['Симуляции', '/canon/simulator'],
  ['Роли', '/canon/roles'],
  ['Control Center', '/canon'],
] as const;

const queues = [
  ['DEAL-001', 'В пути к приёмке', '/canon/deals/detail'],
  ['FIN-247', 'Hold до подтверждения', '/canon/finance/detail'],
  ['OPS-A123', 'ETA 19:00 / слот подтверждён', '/canon/operations/detail'],
  ['Q-456', 'Ожидается retest', '/canon/quality/detail'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена · Workspace</div>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.04, fontWeight: 900 }}>Единое рабочее пространство платформы</h1>
        <p style={{ margin: '14px 0 22px', color: '#94a3b8', fontSize: 17, lineHeight: 1.6, maxWidth: 940 }}>Здесь нет пошагового demo. Здесь собраны рабочие модули, очереди, переходы и симуляции как в полноценной платформе.</p>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>Модули</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 14 }}>
              {modules.map(([title, href]) => (
                <Link key={href} href={href} style={{ textDecoration: 'none', color: 'inherit', padding: '14px 12px', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', fontWeight: 700 }}>
                  {title}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>Живые очереди</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {queues.map(([id, status, href]) => (
                <Link key={id} href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: '.8fr 1.2fr auto', gap: 12, alignItems: 'center', padding: '13px 14px', borderRadius: 18, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontWeight: 800 }}>{id}</div>
                  <div style={{ color: '#8ea0b7', fontSize: 14 }}>{status}</div>
                  <div style={{ color: '#22c55e', fontWeight: 800 }}>Открыть</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
