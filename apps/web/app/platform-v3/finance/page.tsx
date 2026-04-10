import Link from 'next/link';

const flow = [
  ['Резерв средств', 'Подтверждён'],
  ['Поставка', 'В процессе'],
  ['Лабораторный протокол', 'Ожидается'],
  ['Комплект документов', '92%'],
  ['Подтверждение банка', 'Ожидается'],
  ['Выпуск денег', 'Заблокирован'],
] as const;

export default function Page() {
  return (
    <div style={{ padding: '22px 16px 48px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em' }}>Деньги</div>
            <h1 style={{ margin: '10px 0 0', fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.03em' }}>Удержание, подтверждение и выпуск средств</h1>
            <div style={{ marginTop: 14, color: '#94a3b8', fontSize: 18, lineHeight: 1.6 }}>Деньги двигаются только после подтверждённых событий сделки, комплектности документов и подтверждения банка.</div>
          </div>
          <Link href="/platform-v3/documents" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', padding: '15px 18px', borderRadius: 16, fontWeight: 900, fontSize: 17 }}>Открыть документы</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginTop: 18 }}>
          {[
            ['7,1 млн ₽', 'На удержании'],
            ['6,54 млн ₽', 'Почти готово'],
            ['560 тыс. ₽', 'Под вопросом'],
          ].map(([v, l]) => (
            <div key={l} style={{ background: 'linear-gradient(180deg, rgba(13,18,31,.98) 0%, rgba(10,15,27,.98) 100%)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 24, padding: 20, minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 12px 40px rgba(0,0,0,.22)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(34,197,94,.14)' }} />
              <div>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{v}</div>
                <div style={{ marginTop: 10, color: '#95a4b8', fontSize: 18, lineHeight: 1.35 }}>{l}</div>
              </div>
            </div>
          ))}
        </div>

        <section style={{ marginTop: 18, background: 'linear-gradient(180deg, rgba(13,18,31,.98) 0%, rgba(10,15,27,.98) 100%)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 24, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,.22)' }}>
          <div style={{ fontSize: 30, fontWeight: 900 }}>Контур денег</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {flow.map(([a, b]) => (
              <div key={a} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{a}</div>
                <div style={{ color: b === 'Подтверждён' ? '#22c55e' : b === '92%' || b === 'В процессе' ? '#60a5fa' : '#fbbf24', fontSize: 17, fontWeight: 800 }}>{b}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
