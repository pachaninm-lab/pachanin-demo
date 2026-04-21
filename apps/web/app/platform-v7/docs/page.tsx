import Link from 'next/link';

const ENDPOINTS = [
  { method: 'GET', path: '/api/sim/bank-callback', note: 'Проверка mock callback контура банка' },
  { method: 'POST', path: '/api/sim/bank-callback', note: 'Имитация выпуска денег по сделке' },
  { method: 'GET', path: '/platform-v7/deals/[id]/documents', note: 'Документный контур сделки' },
  { method: 'GET', path: '/platform-v7/status', note: 'Статус внешних сервисов и интеграций' },
];

const SECTIONS = [
  {
    title: 'Что это за docs',
    body: 'Это не финальный публичный SDK-портал, а рабочая страница для пилота и интеграций. Она показывает основные точки входа и то, как сейчас устроен демо-контур.',
  },
  {
    title: 'Главный принцип',
    body: 'Интеграции должны служить исполнению сделки: документы, маршрут, приёмка, банк, спор. Если контур ещё в mock или sandbox, это должно быть видно честно.',
  },
  {
    title: 'Что подключается первым',
    body: 'Сначала подключаются банк, документы и события сделки. Потом усиливаются внешние сервисы и отчётность. Не наоборот.',
  },
];

const MODULE_REFERENCES = [
  {
    title: 'Auth и подключение компании',
    note: 'Login, register, auth hub и onboarding уже вынесены в отдельные поверхности.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Банковые модули',
    note: 'Факторинг, эскроу и release-контур уже встроены в банковую поверхность.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Status и ready-state',
    note: 'Есть отдельный слой, где видно честное состояние сервисов и новых модулей.',
    href: '/platform-v7/status',
  },
  {
    title: 'Trust-слой',
    note: 'Карточки контрагентов, профиль компании, команда и отзывы по сделкам.',
    href: '/platform-v7/profile',
  },
];

export default function DocsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Developer Docs</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Рабочая документация по демо- и пилотному контуру. Без притворства, что это уже финальный production SDK-портал.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {SECTIONS.map((section) => (
          <section key={section.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{section.title}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{section.body}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Новые модули в документационном контуре</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Помимо API и entry points здесь видны встроенные продуктовые поверхности, которые уже доступны пользователю и требуют документационного сопровождения.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODULE_REFERENCES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ключевые точки входа</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ENDPOINTS.map((item) => (
            <div key={`${item.method}-${item.path}`} style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 12, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{item.method}</div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{item.path}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{item.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/connectors' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Интеграции
        </Link>
        <Link href='/platform-v7/status' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Статус сервисов
        </Link>
      </div>
    </div>
  );
}
