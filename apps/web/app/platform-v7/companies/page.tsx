import Link from 'next/link';

const COMPANIES = [
  {
    inn: '6829123456',
    name: 'Агрохолдинг СК',
    region: 'Тамбовская область',
    rating: '4.8 / 5',
    deals: '12',
    status: 'Низкий риск',
    note: 'Якорный контрагент пилотного контура.',
  },
  {
    inn: '3664098765',
    name: 'МаслоПресс ООО',
    region: 'Воронежская область',
    rating: '4.6 / 5',
    deals: '8',
    status: 'Средний риск',
    note: 'Хорошо проходит документы и банковый контур.',
  },
  {
    inn: '7701234567',
    name: 'ПромАгро АО',
    region: 'Москва',
    rating: '4.4 / 5',
    deals: '21',
    status: 'Ручные проверки банка',
    note: 'Крупный объём, требует дисциплины SLA.',
  },
];

export default function CompaniesPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Контрагенты</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Реестр компаний в контуре сделки. Нужен не для визиток, а для понимания надёжности исполнения, цикла и признаков доверия по каждому контрагенту.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {COMPANIES.map((company) => (
          <article key={company.inn} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{company.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>ИНН {company.inn} · {company.region}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
                {company.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Cell label='Рейтинг' value={company.rating} />
              <Cell label='Сделок' value={company.deals} />
              <Cell label='Комментарий' value={company.note} />
            </div>

            <div>
              <Link href={`/platform-v7/companies/${company.inn}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                Открыть карточку
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/profile' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Профиль компании
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#0F1419', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
