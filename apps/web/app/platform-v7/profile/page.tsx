import Link from 'next/link';

const CERTS = [
  'Проверено ФГИС',
  'Верификация контрагента пройдена',
  'Документы компании загружены',
];

const METRICS = [
  { label: 'Сделок в контуре', value: '23', note: 'Включая пилотные и операторские' },
  { label: 'Оборот', value: '130.6 млн ₽', note: 'По демо-портфелю апреля' },
  { label: 'Средний цикл', value: '4.8 дня', note: 'От сделки до выпуска денег' },
  { label: 'Рейтинг', value: '4.7 / 5', note: 'На основе исполнения и SLA' },
];

export default function ProfilePage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Профиль компании</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Рабочая карточка компании: реквизиты, базовое доверие, история исполнения и статус проверки. Это P1-страница для пилота, не финальный production-кабинет.
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {CERTS.map((item) => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Реквизиты</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Cell label='Компания' value='ООО «Прозрачная Цена»' />
          <Cell label='ИНН' value='6800000000' />
          <Cell label='ОГРН' value='1206800000000' />
          <Cell label='Регион' value='Тамбовская область' />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {METRICS.map((metric) => (
          <section key={metric.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{metric.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{metric.value}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{metric.note}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что видно по компании</div>
        <Bullet text='Есть рабочий контур сделки и операторский слой.' />
        <Bullet text='Проверка контрагентов и документов встроена в сделку, а не вынесена наружу.' />
        <Bullet text='Есть базовая история исполнения и доказательный слой.' />
        <Bullet text='Часть интеграций ещё в pilot-ready / sandbox режиме и это видно честно.' />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          О проекте
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Вернуться в платформу
        </Link>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{value}</div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
