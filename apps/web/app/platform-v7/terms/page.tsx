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

const MODULE_LINKS = [
  {
    title: 'Auth и подключение компании',
    note: 'Вход, регистрация, auth hub и онбординг уже выделены в отдельный пользовательский контур.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Банковый контур',
    note: 'Release, callbacks, factor/escrow и transport gate оформлены в отдельную поверхность.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Статус и готовность',
    note: 'Есть отдельная страница, где видно честное состояние сервисов и новых модулей.',
    href: '/platform-v7/status',
  },
  {
    title: 'Доверительный слой',
    note: 'Профиль компании, команда, карточки контрагентов и отзывы по сделкам встроены в платформу.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Документы и правила',
    note: 'Privacy, security, docs и правовые поверхности доступны отдельно и связаны между собой.',
    href: '/platform-v7/docs',
  },
];

export default function TermsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
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

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Встроенные модули платформы</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Условия использования распространяются не на абстрактный сайт, а на уже встроенные пользовательские и операционные поверхности платформы.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODULE_LINKS.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

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
