import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Статус контура — Прозрачная Цена',
  description:
    'Честный статус ограниченного предынтеграционного контура: ФГИС, банк, ЭДО, лаборатории, внешние доступы и готовность к проверке.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/status',
  },
  robots: {
    index: false,
    follow: true,
  },
};

const SERVICES = [
  {
    id: 'fgis',
    name: 'ФГИС / СДИЗ',
    status: 'degraded',
    uptime: 'Проверка',
    note: 'Предынтеграционная сверка партий и источников. Нужны доступы, ключи и подтверждение на реальных партиях.',
    incidents: ['Проверить доступ к внешнему контуру', 'Сверить фактические расхождения данных и источников'],
  },
  {
    id: 'bank',
    name: 'Банк / события оплаты',
    status: 'degraded',
    uptime: 'Ручной контур',
    note: 'Показываем основания, блокеры и ручную сверку. Банковские операции требуют договора и согласованного регламента.',
    incidents: ['Согласовать банковский договор', 'Описать удержание, выпуск и сверку событий'],
  },
  {
    id: 'edo',
    name: 'ЭДО / ЭПД',
    status: 'test_mode',
    uptime: 'Контур',
    note: 'Маршрут документов есть в интерфейсе. Подписание, обмен и исправления требуют внешних доступов.',
    incidents: ['Закрепить матрицу документов', 'Подтвердить роли подписантов'],
  },
  {
    id: 'labs',
    name: 'Лаборатории / протоколы',
    status: 'test_mode',
    uptime: 'Контур',
    note: 'Качество и протоколы отражены как рабочий контур. Часть данных требует ручного сопровождения.',
    incidents: ['Утвердить формат протокола', 'Описать повторный анализ'],
  },
];

const MODULES = [
  {
    title: 'Вход и роль',
    readiness: 'UI-контур',
    note: 'Есть login, register, auth hub и role-lock на уровне интерфейса. Server-side RBAC остаётся отдельным этапом.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Банк и удержания',
    readiness: 'Предынтеграционно',
    note: 'Банковские поверхности показывают основание проверки, но договор и регламент остаются внешним условием.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Доверительный слой',
    readiness: 'UI-контур',
    note: 'Карточки контрагентов, команда и отзывы помогают проверке, но требуют подтверждения на реальных сделках.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Помощь роли',
    readiness: 'Сопровождение',
    note: 'Иконка помощи ведёт на этот статусный экран без смены личного кабинета.',
    href: '/platform-v7/status',
  },
];

function serviceTone(status: string) {
  if (status === 'ok') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'ОК' };
  if (status === 'degraded') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Требует проверки' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB', label: 'Тестовый режим' };
}

export default function StatusPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Статус контура</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Честный статус интеграций и внешних контуров. Здесь видно: что собрано в интерфейсе, что требует ручной проверки, а что ждёт договоров, доступов и предынтеграционной сверки.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Metric title='Подключено' value='0' note='Внешние подключения требуют подтверждения.' />
        <Metric title='Требует проверки' value='2' note='ФГИС/СДИЗ и банк требуют доступа и сверки.' />
        <Metric title='Тестовый режим' value='2' note='ЭДО/ЭПД и лабораторный контур требуют сопровождения.' />
        <Metric title='Режим' value='Контур' note='Controlled-pilot / pre-integration.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Модули и готовность</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Здесь показан статус рабочих поверхностей, которые помогают исполнению сделки, но не подменяют договоры, банк и внешние системы.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODULES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 11, fontWeight: 800 }}>{item.readiness}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--pc-text-secondary, #475569)' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        {SERVICES.map((service) => {
          const tone = serviceTone(service.status);
          return (
            <article key={service.id} style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{service.name}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>{service.note}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                  {tone.label}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Cell label='Состояние' value={service.uptime} />
                <Cell label='Последний статус' value={tone.label} />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующие проверки</div>
                {service.incidents.map((incident) => (
                  <div key={incident} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#F8FAFB', fontSize: 12, color: 'var(--pc-text-secondary, #475569)' }}>
                    {incident}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/connectors' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Проверить интеграции
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>
          Вернуться в Центр управления
        </Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{value}</div>
    </div>
  );
}
