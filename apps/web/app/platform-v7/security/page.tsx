import Link from 'next/link';

const SECTIONS = [
  {
    title: 'Доступ и роли',
    body: 'Платформа разделяет роли по рабочему контексту: оператор, продавец, покупатель, банк, сюрвейер, логистика, лаборатория и комплаенс. Это снижает риск хаоса и случайных действий не тем пользователем.',
  },
  {
    title: 'Доказательность событий',
    body: 'Ключевые действия по сделке фиксируются в контуре: документы, маршруты, приёмка, статус денег и спор. Это даёт основу для разбора спорных ситуаций и внутреннего аудита.',
  },
  {
    title: 'Контур денег',
    body: 'Деньги не должны идти раньше документов и подтверждённых событий. Release привязан к банку, документам и состоянию спора. Если есть blocker, выпуск останавливается.',
  },
  {
    title: 'Честная стадия зрелости',
    body: 'Система находится в стадии pilot-ready с сопровождением. Часть интеграций уже имитируется близко к боевому контуру, часть ещё работает в режиме песочницы или ручной проверки.',
  },
];

const CHECKS = [
  'Контроль ролей и доступов',
  'Блокировка выпуска денег при открытом споре',
  'Проверка обязательных документов перед release',
  'Отдельный статус интеграций и внешних контуров',
  'Операторский audit trail',
  'Полевые события: маршрут, приёмка, акт',
];

export default function SecurityPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1020, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Безопасность</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Это не декларация “всё закрыто”, а понятное описание того, как платформа снижает риск ошибок, спорности и раннего выпуска денег.
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

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что уже контролируется в контуре</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {CHECKS.map((item) => (
            <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 900 }}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/status' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Открыть статус сервисов
        </Link>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          О проекте
        </Link>
      </div>
    </div>
  );
}
