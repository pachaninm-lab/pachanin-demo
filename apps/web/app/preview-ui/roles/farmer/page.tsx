import Link from 'next/link';

const cards = [
  ['Пшеница 3 кл.', '14 500 ₽/т', '15 200 ₽/т', '+4.8%'],
  ['Подсолнечник', '28 000 ₽/т', '29 800 ₽/т', '+6.4%'],
  ['Кукуруза', '12 800 ₽/т', '13 100 ₽/т', '+2.3%'],
];

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: 'rgba(6,11,22,.96)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 800, flex: 1 }}>Прозрачная Цена</div>
        <div style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>Фермер / Продавец</div>
      </div>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '18px 16px 0' }}>
        <section style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.1 }}>НТБ Мост</div>
              <div style={{ color: '#94a3b8', fontSize: 15 }}>Сравнение с биржевыми ценами</div>
            </div>
            <div style={{ background: 'rgba(34,197,94,.14)', color: '#22c55e', borderRadius: 16, padding: '10px 14px', fontWeight: 800 }}>+2–6% к НТБ</div>
          </div>
          {cards.map(([name, local, ntb, delta]) => (
            <a key={name} href="#" style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 10, alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{name}</div>
              <div style={{ color: '#cbd5e1', fontSize: 15 }}>{local}</div>
              <div style={{ color: '#fbbf24', fontSize: 15, fontWeight: 700 }}>{ntb}</div>
              <div style={{ color: '#22c55e', background: 'rgba(34,197,94,.12)', borderRadius: 999, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}>{delta}</div>
            </a>
          ))}
        </section>
        <div style={{ fontSize: 22, fontWeight: 800, margin: '20px 0 12px' }}>Новости рынка</div>
        {['Пшеница 3 кл. — рост на 2.3% за неделю', 'Экспортная пошлина на подсолнечник снижена'].map((title) => (
          <a key={title} href="#" style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 22, padding: 18, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>{title}</a>
        ))}
      </div>
      <Link href="/preview-ui/roles" style={{ position: 'fixed', right: 18, bottom: 18, width: 66, height: 66, borderRadius: 33, background: '#22c55e', color: '#04110a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 900 }}>✦</Link>
    </main>
  );
}
