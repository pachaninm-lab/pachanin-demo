import Link from 'next/link';

export default function PlatformV7TradingAliasPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }} data-demo="true">
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Торговая секция</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>
          Торговый стакан и сопоставление заявок сейчас в сборке. Чтобы не получить 404, мы честно показываем промежуточный вход: переходы ведут на витрину лотов и на аукционы — оттуда можно инициировать сделку.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Link href="/platform-v7/marketplace" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 }}>Витрина лотов</Link>
          <Link href="/platform-v7/deals" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
          <Link href="/platform-v7/control-tower" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Control Tower</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что будет в торговой секции</div>
        <ul style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, marginTop: 10, paddingLeft: 18 }}>
          <li>Стакан заявок покупки/продажи по культурам и базисам поставки.</li>
          <li>Матчинг лота с встречной заявкой, индикация спреда и объёма рынка.</li>
          <li>Одно-клик переход «матч → черновик сделки» с предзаполнением реквизитов.</li>
          <li>Фильтр по региону, ГОСТ-классу, сроку поставки и способу расчёта.</li>
        </ul>
        <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 12 }}>Статус: раздел в сборке. До релиза сделки заводятся через витрину лотов или аукционный модуль.</div>
      </section>
    </div>
  );
}
