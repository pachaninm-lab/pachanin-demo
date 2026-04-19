import Link from 'next/link';

const BLOCKS = [
  {
    title: 'Назначение платформы',
    body: 'Платформа предназначена для сопровождения исполнения сделки: фиксации статусов, документов, маршрутов, событий, банкового контура и спорных ситуаций. Это не просто витрина объявлений и не публичная биржа.',
  },
  {
    title: 'Рабочий характер данных',
    body: 'Часть данных и сценариев в демо-контуре может имитироваться для проверки логики продукта. Это не должно трактоваться как подтверждение полного production-ready статуса всех интеграций.',
  },
  {
    title: 'Роль пользователя',
    body: 'Каждый пользователь действует в своей роли: оператор, продавец, покупатель, логистика, банк, сюрвейер, лаборатория, комплаенс. Доступ к действиям и экранам ограничен контекстом роли.',
  },
  {
    title: 'Ограничение ответственности контура',
    body: 'Контур сделки помогает снижать хаос, спорность и риск раннего выпуска денег, но не подменяет собой правовую экспертизу, банковое решение, регуляторное подтверждение или внутренние процедуры сторон.',
  },
];

export default function TermsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1020, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Условия использования</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Краткая рабочая версия правил использования демо-контура и пилотного режима. Без завышения зрелости и без притворства, что всё уже боевое.
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
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Главный принцип</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          Всё, что пользователь видит в контуре, должно помогать исполнению сделки: не выпускать деньги раньше времени, не терять документы, не размазывать спор по мессенджерам и не ломать доказательную цепочку.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/privacy' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Политика конфиденциальности
        </Link>
        <Link href='/platform-v7/security' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Безопасность
        </Link>
      </div>
    </div>
  );
}
