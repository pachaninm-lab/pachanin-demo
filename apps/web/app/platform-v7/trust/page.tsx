import Link from 'next/link';
import {
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_EXPORT_CENTER_ROUTE,
  PLATFORM_V7_SIMULATOR_ROUTE,
} from '@/lib/platform-v7/routes';

const maturityRows = [
  {
    title: 'Подтверждено в предпилотном контуре',
    tone: '#0A7A5F',
    items: [
      'ролевой вход и рабочие поверхности',
      'сделка как центральный объект',
      'контур денег, документов, споров и логистики',
      'проверки по ролям и запрещённым обещаниям',
    ],
  },
  {
    title: 'Работает как тестовый сценарий',
    tone: '#B45309',
    items: [
      'банковские события и ответы банка',
      'сценарии отклонений и спорных кейсов',
      'выгрузки для банка, пилота и доказательств',
      'демо-путь сделки от лота до решения',
    ],
  },
  {
    title: 'Требует договоров и внешних доступов',
    tone: '#475569',
    items: [
      'боевой банк и номинальный счёт',
      'ФГИС «Зерно», СДИЗ, ЭДО и перевозочные документы',
      'GPS/телематика, лаборатория, КЭП и МЧД',
      'подтверждение на реальных сделках controlled pilot',
    ],
  },
  {
    title: 'Не обещается как текущий факт',
    tone: '#B91C1C',
    items: [
      'самостоятельное хранение денег платформой',
      'автоматическое решение всех споров',
      'закрытие всех юридических и операционных рисков',
      'подтверждённые боевые интеграции без договоров и тестов',
    ],
  },
] as const;

const gates = [
  ['Банк', 'Пока тестовый контур', 'Нужны договор, счёт, доступы, сверка событий и регламент ручных исключений.'],
  ['Документы', 'Частично внутри платформы', 'Внешний юридически значимый контур требует ЭДО, подписи и связки с обязательными системами.'],
  ['Логистика', 'Сценарий и полевой контур', 'Боевой маршрут требует провайдера телематики, регламентов и подтверждения на рейсах.'],
  ['Споры', 'Регламент и доказательства', 'Решения должны проверяться юристом на пилоте и подтверждаться фактическими доказательствами.'],
] as const;

export default function PlatformV7TrustPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 }}>
          Центр доверия · controlled pilot
        </div>
        <div style={{ maxWidth: 920 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Честная карта зрелости платформы</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>
            Этот экран отделяет подтверждённый предпилотный контур от тестовых сценариев и внешних подключений, которые требуют договоров, доступов и проверки на реальных сделках. Назначение — не усилить обещания, а убрать риск ложного чтения проекта.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={PLATFORM_V7_BANK_EVENTS_ROUTE} style={primaryLink}>События банка</Link>
          <Link href={PLATFORM_V7_SIMULATOR_ROUTE} style={secondaryLink}>Симулятор сценариев</Link>
          <Link href={PLATFORM_V7_EXPORT_CENTER_ROUTE} style={secondaryLink}>Выгрузки</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {maturityRows.map((row) => (
          <article key={row.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: row.tone }} />
              <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.25, color: '#0F1419' }}>{row.title}</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
              {row.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Ворота перед внешним обещанием</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {gates.map(([area, status, next]) => (
            <div key={area} style={{ display: 'grid', gridTemplateColumns: '150px 190px 1fr', gap: 12, padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #EEF1F4' }}>
              <strong style={{ fontSize: 13, color: '#0F1419' }}>{area}</strong>
              <span style={{ fontSize: 13, color: '#B45309', fontWeight: 800 }}>{status}</span>
              <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{next}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const primaryLink = {
  display: 'inline-flex',
  minHeight: 42,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  borderRadius: 12,
  background: '#0A7A5F',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
} as const;

const secondaryLink = {
  ...primaryLink,
  background: '#fff',
  color: '#0F1419',
  border: '1px solid #CBD5E1',
} as const;
