import Link from 'next/link';

const COMPANIES: Record<string, {
  name: string;
  inn: string;
  ogrn: string;
  region: string;
  rating: string;
  deals: string;
  avgCycle: string;
  note: string;
  certificates: string[];
}> = {
  '6829123456': {
    name: 'Агрохолдинг СК',
    inn: '6829123456',
    ogrn: '1206800001111',
    region: 'Тамбовская область',
    rating: '4.8 / 5',
    deals: '12',
    avgCycle: '4.3 дня',
    note: 'Якорный контрагент в пилотном контуре. По компании виден стабильный документный слой и предсказуемое исполнение.',
    certificates: ['Проверено ФГИС', 'Верификация контрагента пройдена', 'Низкий риск'],
  },
  '3664098765': {
    name: 'МаслоПресс ООО',
    inn: '3664098765',
    ogrn: '1193600002222',
    region: 'Воронежская область',
    rating: '4.6 / 5',
    deals: '8',
    avgCycle: '5.1 дня',
    note: 'Рабочий контрагент по масличному направлению. Хорошо проходит документный и банковый контур.',
    certificates: ['Проверено ФГИС', 'Документы в контуре', 'Средний риск'],
  },
  '7701234567': {
    name: 'ПромАгро АО',
    inn: '7701234567',
    ogrn: '1187700003333',
    region: 'Москва',
    rating: '4.4 / 5',
    deals: '21',
    avgCycle: '5.7 дня',
    note: 'Крупный контрагент с высоким объёмом. Нуждается в дисциплине ролей и аккуратном SLA-контуре.',
    certificates: ['Верификация контрагента пройдена', 'Высокий объём', 'Ручные проверки банка'],
  },
};

export default function CompanyPage({ params }: { params: { inn: string } }) {
  const company = COMPANIES[params.inn] ?? {
    name: 'Контрагент',
    inn: params.inn,
    ogrn: '—',
    region: '—',
    rating: '—',
    deals: '—',
    avgCycle: '—',
    note: 'Карточка контрагента пока не заполнена. Это безопасная заглушка для дальнейшего расширения профилей.',
    certificates: ['Карточка в разработке'],
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{company.name}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>{company.note}</div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {company.certificates.map((item) => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Реквизиты и статус</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Cell label='ИНН' value={company.inn} />
          <Cell label='ОГРН' value={company.ogrn} />
          <Cell label='Регион' value={company.region} />
          <Cell label='Рейтинг' value={company.rating} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Metric label='Сделок в контуре' value={company.deals} note='Зафиксировано в рабочем контуре' />
        <Metric label='Средний цикл' value={company.avgCycle} note='От сделки до выпуска денег' />
        <Metric label='Проверка' value='Пройдена' note='Компания видна в комплаенс-контуре' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что важно по контрагенту</div>
        <Bullet text='Карточка нужна не для визитки, а для понимания надёжности исполнения.' />
        <Bullet text='Контрагент должен быть виден через документы, сделки, споры и bank-ready слой.' />
        <Bullet text='Рейтинг и цикл — это признаки дисциплины контрагента, а не просто маркетинг.' />
      </section>

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
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{value}</div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
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
