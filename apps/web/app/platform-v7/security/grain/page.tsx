import Link from 'next/link';

const signals = [
  { title: 'Аномалия доступа', value: 'новое устройство', note: 'Вход в роль с нового устройства требует подтверждения и записи в журнал.', href: '/platform-v7/profile/team', tone: 'warn' },
  { title: 'Ручное исключение', value: 'запрещено', note: 'Исключение по документу или выплате не проходит без основания и ответственного.', href: '/platform-v7/documents/grain', tone: 'stop' },
  { title: 'Маршрут риска', value: 'расхождение ETA', note: 'Отклонение рейса от маршрута связывается с логистикой, документами и доказательствами.', href: '/platform-v7/logistics/grain', tone: 'warn' },
  { title: 'Финансовый сигнал', value: 'выпуск закрыт', note: 'Любая попытка выпуска без условий отправляется в антиобход и комплаенс.', href: '/platform-v7/settlement/grain', tone: 'stop' },
] as const;

const metrics = [
  { label: 'Риск-счёт', value: '78/100', tone: 'bad' },
  { label: 'Исключения', value: '0 разрешено', tone: 'good' },
  { label: 'Событий', value: '14', tone: 'warn' },
  { label: 'Действие', value: 'проверить доступ', tone: 'good' },
] as const;

export default function GrainSecurityPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Риск-контроль зерновой сделки</div>
        <h1 style={h1}>Аномалии, подозрительные действия, ручные исключения и журнал риска</h1>
        <p style={lead}>Экран показывает события, которые могут нарушить исполнение сделки: доступ с нового устройства, ручное исключение, отклонение маршрута, попытку выплаты без условий или действие вне доказательного контура.</p>
        <div style={actions}>
          <Link href='/platform-v7/security' style={primaryBtn}>Безопасность</Link>
          <Link href='/platform-v7/anti-bypass/grain' style={ghostBtn}>Антиобход</Link>
          <Link href='/platform-v7/compliance/grain' style={ghostBtn}>Комплаенс</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Сигналы риска</div>
        <div style={stepGrid}>{signals.map((signal, index) => <SignalCard key={signal.title} signal={signal} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FECACA' }}>Правило риска</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Риск не закрывается вручную</h2>
        <p style={{ margin: 0, color: '#FEE2E2', fontSize: 14, lineHeight: 1.55 }}>Если событие связано с доступом, документом, маршрутом или выплатой, оно должно иметь источник, ответственного и решение. Без этого действие остаётся заблокированным и уходит в журнал риска.</p>
      </section>
    </main>
  );
}

function SignalCard({ signal, index }: { signal: typeof signals[number]; index: number }) {
  return <Link href={signal.href} style={stepCard}><span style={{ ...num, background: color(signal.tone) }}>{index + 1}</span><strong style={title}>{signal.title}</strong><b style={{ ...value, color: color(signal.tone) }}>{signal.value}</b><span style={note}>{signal.note}</span><span style={{ ...cta, color: color(signal.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#7F1D1D', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const stepGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const stepCard = { textDecoration: 'none', minHeight: 178, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
const num = { width: 28, height: 28, borderRadius: 999, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 900 } as const;
const title = { color: '#0F1419', fontSize: 17, lineHeight: 1.2, fontWeight: 900 } as const;
const value = { fontSize: 13, lineHeight: 1.3, fontWeight: 900 } as const;
const note = { color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const cta = { marginTop: 'auto', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
