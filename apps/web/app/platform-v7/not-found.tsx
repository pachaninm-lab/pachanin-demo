import Link from 'next/link';

type QuickLink = {
  href: string;
  title: string;
  note: string;
};

const QUICK_LINKS: QuickLink[] = [
  { href: '/platform-v7', title: 'Главная / выбор роли', note: 'Точка входа в платформу с переключением между ролями.' },
  { href: '/platform-v7/marketplace', title: 'Витрина лотов', note: 'Все лоты: культура, регион, объём, цена, класс.' },
  { href: '/platform-v7/deals', title: 'Все сделки', note: '20+ сделок с SLA-сортировкой и полями статуса.' },
  { href: '/platform-v7/control-tower', title: 'Control Tower', note: 'KPI-дашборд оператора: reseved, hold, disputed.' },
  { href: '/platform-v7/logistics', title: 'Логистика', note: 'Маршруты, GPS-события, ETA, отклонения.' },
  { href: '/platform-v7/disputes', title: 'Споры', note: 'Открытые споры, holds, SLA, responsible ballAt.' },
  { href: '/platform-v7/bank', title: 'Банк', note: 'Резервы, выпуски, callbacks, ручные проверки.' },
  { href: '/platform-v7/integrations', title: 'Интеграции', note: 'ФГИС «Зерно», СберБизнес, СПАРК, лаборатории.' },
  { href: '/platform-v7/operator', title: 'Кабинет оператора', note: 'Очереди задач, callbacks, ручные действия.' },
];

export default function PlatformV7NotFound() {
  return (
    <div style={{ minHeight: '60vh', padding: 24, display: 'grid', placeItems: 'start center' }}>
      <div style={{ maxWidth: 820, width: '100%', display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#B45309', textTransform: 'uppercase' }}>404 · Страница не найдена</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: '8px 0 10px' }}>Нужный экран сделки, лота или модуля недоступен</h1>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
            Возможно, ссылка устарела или сущность ещё не заведена. Ниже — быстрая навигация по ключевым разделам платформы. Если ищете конкретную сделку — перейдите в «Все сделки» и найдите по ID.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <Link href="/platform-v7" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 }}>На главную</Link>
            <Link href="/platform-v7/deals" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
            <Link href="/platform-v7/marketplace" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Витрина лотов</Link>
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Быстрые переходы</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Основные маршруты платформы, сгруппированные по смыслу.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 14 }}>
            {QUICK_LINKS.map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', borderRadius: 12, padding: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.5, marginTop: 4 }}>{item.note}</div>
                <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 700, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>{item.href}</div>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Ищете сделку по ID?</div>
          <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 6 }}>ID сделок в демо имеют формат <code style={{ background: '#F5F7F8', padding: '1px 6px', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace' }}>DL-9102…DL-9111</code>. Перейдите в список и откройте карточку нужной сделки.</div>
          <Link href="/platform-v7/deals" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, marginTop: 12 }}>Открыть список сделок →</Link>
        </section>
      </div>
    </div>
  );
}
