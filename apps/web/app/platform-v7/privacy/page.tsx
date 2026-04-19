import Link from 'next/link';

const BLOCKS = [
  {
    title: 'Какие данные используются',
    body: 'В рабочем контуре сделки могут использоваться данные о компаниях, ролях, документах, маршрутах, статусах денег и событиях исполнения. В демо-режиме часть данных имитируется и хранится локально в браузере.',
  },
  {
    title: 'Для чего используются данные',
    body: 'Данные нужны не ради аналитики как таковой, а для исполнения сделки: показать следующий шаг, понять, где blocker, собрать документы, подтвердить маршрут и не выпустить деньги раньше времени.',
  },
  {
    title: 'Ограничение доступа',
    body: 'Система разделяет рабочий контекст по ролям. Оператор, банк, продавец, покупатель и полевые роли видят разные экраны и разные действия. Это снижает риск лишнего доступа и случайных ошибок.',
  },
  {
    title: 'Честная стадия',
    body: 'На текущей стадии часть контуров уже имитируется близко к боевому режиму, а часть ещё работает как pilot-ready с сопровождением. Это не заявление о полном production-ready контуре.',
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1020, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Политика конфиденциальности</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Это краткая рабочая версия для демо-контура: что за данные участвуют в исполнении сделки, зачем они нужны и как ограничивается доступ.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {BLOCKS.map((block) => (
          <section key={block.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{block.title}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{block.body}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ключевой принцип</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          Данные в системе должны служить исполнению сделки и доказательности, а не создавать ложное ощущение зрелости. Если контур работает в песочнице, это должно быть видно честно.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/security' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Страница безопасности
        </Link>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          О проекте
        </Link>
      </div>
    </div>
  );
}
