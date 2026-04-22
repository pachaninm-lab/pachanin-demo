'use client';

import { useMemo, useState } from 'react';

type FactoringStatus = 'Проверка' | 'Документы' | 'Одобрено' | 'Аванс выплачен';

type FactoringApplication = {
  id: string;
  buyer: string;
  deal: string;
  amount: number;
  status: FactoringStatus;
  next: string;
  note: string;
};

const initialApplications: FactoringApplication[] = [
  {
    id: 'FAC-201',
    buyer: 'МаслоПресс ООО',
    deal: 'DL-9108',
    amount: 8.6,
    status: 'Одобрено',
    next: 'Подтвердить выпуск аванса',
    note: 'Финальный лимит подтверждён, осталось дать команду на выплату аванса.'
  },
  {
    id: 'FAC-202',
    buyer: 'Агрохолдинг СК',
    deal: 'DL-9110',
    amount: 12.1,
    status: 'Проверка',
    next: 'Дождаться финального скоринга',
    note: 'Банк дочитывает финансовый профиль и проверяет структуру сделки.'
  },
  {
    id: 'FAC-203',
    buyer: 'Зерно Трейд',
    deal: 'DL-9114',
    amount: 5.4,
    status: 'Документы',
    next: 'Загрузить пакет уступки требований',
    note: 'Не хватает уступки, акта сверки и финального реестра поставки.'
  }
];

const formatMillions = (value: number) => `${value.toFixed(1).replace('.', ',')} млн ₽`;

const badgeStyle = (status: FactoringStatus) => {
  if (status === 'Аванс выплачен') {
    return { background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (status === 'Одобрено') {
    return { background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB' };
  }
  if (status === 'Документы') {
    return { background: 'rgba(180,83,9,0.10)', border: '1px solid rgba(180,83,9,0.18)', color: '#B45309' };
  }
  return { background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#475569' };
};

export default function BankFactoringPage() {
  const [applications, setApplications] = useState<FactoringApplication[]>(initialApplications);
  const [filter, setFilter] = useState<'Все' | FactoringStatus>('Все');
  const [message, setMessage] = useState('');

  const filteredApplications = useMemo(() => {
    return filter === 'Все' ? applications : applications.filter((item) => item.status === filter);
  }, [applications, filter]);

  const metrics = useMemo(() => {
    const total = applications.length;
    const approved = applications.filter((item) => item.status === 'Одобрено').length;
    const pending = applications.filter((item) => item.status === 'Проверка' || item.status === 'Документы').length;
    const paidAdvance = applications
      .filter((item) => item.status === 'Аванс выплачен')
      .reduce((sum, item) => sum + item.amount, 0);

    return [
      { title: 'Доступный лимит', value: '48 млн ₽', note: 'Сводный лимит по одобренным покупателям' },
      { title: 'Ставка', value: 'КС + 4.2%', note: 'Базовая модель для пилотного контура' },
      { title: 'Активные заявки', value: String(total), note: `${pending} требуют движения, ${approved} готовы к авансу` },
      { title: 'Выплаченные авансы', value: formatMillions(paidAdvance || 0), note: 'Факт профинансированных сделок по текущей выборке' }
    ];
  }, [applications]);

  const advanceApplication = (id: string) => {
    setApplications((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (item.status === 'Проверка') {
          setMessage(`Заявка ${item.id}: скоринг завершён, можно переходить к документам.`);
          return { ...item, status: 'Документы', next: 'Собрать уступку и акт сверки', note: 'Скоринг пройден, остался документный пакет для уступки.' };
        }
        if (item.status === 'Документы') {
          setMessage(`Заявка ${item.id}: пакет документов принят, лимит одобрен.`);
          return { ...item, status: 'Одобрено', next: 'Подтвердить выпуск аванса', note: 'Документы закрыты, заявка готова к авансированию.' };
        }
        if (item.status === 'Одобрено') {
          setMessage(`Заявка ${item.id}: аванс выплачен и привязан к сделке ${item.deal}.`);
          return { ...item, status: 'Аванс выплачен', next: 'Контролировать возврат через закрытие поставки', note: 'Аванс ушёл покупателю, дальнейший контроль через исполнение сделки.' };
        }
        setMessage(`Заявка ${item.id}: дополнительное движение не требуется.`);
        return item;
      })
    );
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Факторинг</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Контур финансирования покупателя: лимиты, скоринг, документная готовность и выплата аванса по сделкам платформы.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 800 }}>
            Пилотный банковый модуль
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {metrics.map((card) => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{card.title}</div>
            <div style={{ fontSize: 30, lineHeight: 1.05, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{card.note}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Заявки на факторинг</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['Все', 'Проверка', 'Документы', 'Одобрено', 'Аванс выплачен'] as const).map((item) => {
              const active = filter === item;
              return (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  style={{
                    appearance: 'none',
                    border: active ? '1px solid rgba(10,122,95,0.20)' : '1px solid #E4E6EA',
                    background: active ? 'rgba(10,122,95,0.08)' : '#fff',
                    color: active ? '#0A7A5F' : '#475569',
                    borderRadius: 999,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {message ? (
          <div style={{ borderRadius: 14, border: '1px solid rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.06)', color: '#0A7A5F', padding: 14, fontSize: 13, fontWeight: 700 }}>
            {message}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {filteredApplications.map((item) => (
            <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F1419' }}>{item.id}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, ...badgeStyle(item.status) }}>{item.status}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1419' }}>{item.buyer} · {item.deal}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Сумма заявки</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{formatMillions(item.amount)}</div>
                </div>
                <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419', marginTop: 8, lineHeight: 1.45 }}>{item.next}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={`/platform-v7/deals/${item.deal}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid #D4D9E2', color: '#0F1419', textDecoration: 'none', fontWeight: 800, background: '#fff' }}>
                  Открыть сделку
                </a>
                <button onClick={() => advanceApplication(item.id)} style={{ appearance: 'none', border: '1px solid rgba(37,99,235,0.18)', background: 'rgba(37,99,235,0.08)', color: '#2563EB', minHeight: 44, padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>
                  {item.status === 'Проверка' ? 'Завершить скоринг' : item.status === 'Документы' ? 'Принять пакет' : item.status === 'Одобрено' ? 'Выплатить аванс' : 'Проверить историю'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
