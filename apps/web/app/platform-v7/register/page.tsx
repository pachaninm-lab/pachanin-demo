import Link from 'next/link';

const blocks = [
  {
    title: 'Компания',
    items: ['ИНН / ОГРН', 'Регион и адрес', 'Контактное лицо', 'Основная культура или роль'],
  },
  {
    title: 'Документы',
    items: ['Устав / ЕГРЮЛ', 'Полномочия подписанта', 'Сертификаты и допуски', 'Данные по складам / элеваторам'],
  },
  {
    title: 'Финансовый контур',
    items: ['Расчётный счёт', 'СберБизнес ID', 'Безопасная сделка / эскроу', 'Режим факторинга'],
  },
];

export default function RegisterPage() {
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 980 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 800, width: 'fit-content' }}>
            Подключение компании
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 800, color: '#0F1419' }}>Регистрация</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, maxWidth: 760 }}>
            Создание учётной записи компании: профиль, документы, полномочия, банковый контур и будущий запуск первого лота или сделки.
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {blocks.map((block) => (
          <div key={block.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{block.title}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {block.items.map((item) => (
                <div key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Готово к запуску?</div>
          <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>После регистрации переходи в онбординг и заводи первый лот или покупательский контур.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/onboarding" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Открыть онбординг</Link>
          <Link href="/platform-v7/login" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 800 }}>Уже есть доступ</Link>
        </div>
      </section>
    </div>
  );
}
