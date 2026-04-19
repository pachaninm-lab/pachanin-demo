import Link from 'next/link';

const BLOCKS = [
  {
    title: 'Предмет оферты',
    body: 'Демо- и пилотный контур предоставляют пользователю доступ к рабочим экранам, статусам, документам, маршрутам, событиям и действиям, связанным с исполнением сделки. Оферта описывает использование этого контура как сервиса сопровождения, а не как замену договора между сторонами сделки.',
  },
  {
    title: 'Пилотный режим',
    body: 'Часть функций и интеграций в текущем контуре может работать в режиме имитации, песочницы или ручной проверки. Использование платформы в таком режиме не является подтверждением того, что все интеграции полностью введены в промышленную эксплуатацию.',
  },
  {
    title: 'Обязанности пользователя',
    body: 'Пользователь обязан корректно использовать свою роль, не искажать документы, не обходить контур исполнения сделки и не выдавать демо-статусы за юридически подтверждённые результаты, если это не подтверждено документами и внешним контуром.',
  },
  {
    title: 'Границы сервиса',
    body: 'Платформа помогает фиксировать статусы, снижать спорность и удерживать сделку в одном рабочем контуре, но не заменяет собой правовую экспертизу, банковое решение, регуляторное подтверждение, внутренние процедуры сторон и их договорные обязательства.',
  },
];

export default function OfertaPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1020, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Оферта</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Краткая рабочая версия оферты для демо- и пилотного контура. Без притворства, что это уже финальный юридический пакет под production.
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
          Платформа не должна обещать пользователю больше, чем подтверждено реальной стадией готовности, внешними контурами и способностью команды исполнить обещанное. Всё, что не доведено до боевого режима, должно быть видно честно.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/terms' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Условия использования
        </Link>
        <Link href='/platform-v7/privacy' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Политика конфиденциальности
        </Link>
      </div>
    </div>
  );
}
