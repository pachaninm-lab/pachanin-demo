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

const CONTROL_MODULES = [
  {
    title: 'Банковый контур',
    note: 'Release, factor/escrow и transport gate вынесены в отдельный контролируемый модуль.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Status и ready-state',
    note: 'Есть отдельная поверхность, где видно честное состояние внешних контуров и новых модулей.',
    href: '/platform-v7/status',
  },
  {
    title: 'Онбординг и auth',
    note: 'Подключение компании, вход и роли выведены в отдельные поверхности, а не размазаны по системе.',
    href: '/platform-v7/onboarding',
  },
  {
    title: 'Доверительный слой',
    note: 'Карточки контрагентов, команда компании и отзывы по сделкам усиливают управляемость и разборность.',
    href: '/platform-v7/profile',
  },
];

export default function SecurityPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
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

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Модули контроля и защиты</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Здесь видны уже встроенные поверхности, через которые в продукте реализуются доступы, контроль денег, статус контуров и слой доверия.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {CONTROL_MODULES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
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
