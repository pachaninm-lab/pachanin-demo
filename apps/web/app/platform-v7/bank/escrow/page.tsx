'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PLATFORM_V7_DEALS_ROUTE } from '@/lib/platform-v7/routes';

type EscrowState = 'Удержание' | 'Готово к раскрытию' | 'Ожидание решения' | 'Частично раскрыто' | 'Раскрыто';

type EscrowRow = {
  id: string;
  deal: string;
  amount: number;
  released: number;
  trigger: string;
  state: EscrowState;
  owner: string;
  note: string;
};

const initialRows: EscrowRow[] = [
  {
    id: 'ESC-301',
    deal: 'DL-9102',
    amount: 6.4,
    released: 0,
    trigger: 'Финальный протокол качества',
    state: 'Удержание',
    owner: 'Оператор / банк',
    note: 'Деньги стоят в sandbox hold до закрытия качества и полного пакета документов. Боевой эскроу-счёт не открыт.'
  },
  {
    id: 'ESC-302',
    deal: 'DL-9108',
    amount: 12.8,
    released: 0,
    trigger: 'Приёмка + bank callback',
    state: 'Готово к раскрытию',
    owner: 'Банк',
    note: 'Все обязательные события подтверждены в controlled-pilot логике; можно имитировать движение денег без live-платежа.'
  },
  {
    id: 'ESC-303',
    deal: 'DL-9111',
    amount: 8.6,
    released: 0,
    trigger: 'Закрытие спора',
    state: 'Ожидание решения',
    owner: 'Арбитр / оператор',
    note: 'Денежный режим зависит от решения по спорной качественной дельте; выпуск денег заблокирован до доказательств.'
  }
];

const formatMillions = (value: number) => `${value.toFixed(1).replace('.', ',')} млн ₽`;

const stateStyle = (state: EscrowState) => {
  if (state === 'Раскрыто') {
    return { background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (state === 'Частично раскрыто') {
    return { background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB' };
  }
  if (state === 'Готово к раскрытию') {
    return { background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (state === 'Ожидание решения') {
    return { background: 'rgba(180,83,9,0.10)', border: '1px solid rgba(180,83,9,0.18)', color: '#B45309' };
  }
  return { background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#475569' };
};

export default function BankEscrowPage() {
  const [rows, setRows] = useState<EscrowRow[]>(initialRows);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'Все' | EscrowState>('Все');

  const filteredRows = useMemo(() => {
    return filter === 'Все' ? rows : rows.filter((row) => row.state === filter);
  }, [rows, filter]);

  const metrics = useMemo(() => {
    const held = rows.filter((row) => row.state === 'Удержание' || row.state === 'Ожидание решения').reduce((sum, row) => sum + (row.amount - row.released), 0);
    const released = rows.reduce((sum, row) => sum + row.released, 0);
    const triggers = new Set(rows.map((row) => row.trigger)).size;
    return [
      { title: 'Sandbox escrow', value: String(rows.length), note: 'Денежные кейсы по сделкам в controlled-pilot контуре' },
      { title: 'На удержании', value: formatMillions(held || 0), note: 'Сумма, которая ещё не может быть раскрыта в симуляции' },
      { title: 'Условия раскрытия', value: String(triggers), note: 'Приёмка, качество, документы, callback и спорный режим' },
      { title: 'Sandbox release', value: formatMillions(released || 0), note: 'Имитация выпущенных средств; боевой платёж не выполнялся' }
    ];
  }, [rows]);

  const releasePartial = (id: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (row.state === 'Готово к раскрытию') {
        const partial = Number((row.amount * 0.5).toFixed(1));
        setMessage(`Эскроу ${row.id}: sandbox-раскрытие ${formatMillions(partial)} по сделке ${row.deal}; live-платёж не выполнялся.`);
        return {
          ...row,
          released: partial,
          state: 'Частично раскрыто',
          owner: 'Банк / оператор',
          note: 'Первая часть выпущена в sandbox. Остаток ждёт финального подтверждения закрытия кейса.'
        };
      }
      if (row.state === 'Частично раскрыто') {
        setMessage(`Эскроу ${row.id}: полностью раскрыто в sandbox и закрыто по сделке ${row.deal}.`);
        return {
          ...row,
          released: row.amount,
          state: 'Раскрыто',
          owner: 'Банк',
          note: 'Все условия выполнены в controlled-pilot логике; денежный кейс закрыт без live-платежа.'
        };
      }
      setMessage(`Эскроу ${row.id}: сначала нужно снять удержание или дождаться готовности к раскрытию.`);
      return row;
    }));
  };

  const moveToReady = (id: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (row.state === 'Удержание' || row.state === 'Ожидание решения') {
        setMessage(`Эскроу ${row.id}: блокер снят, кейс готов к sandbox-раскрытию.`);
        return {
          ...row,
          state: 'Готово к раскрытию',
          owner: 'Банк',
          trigger: 'Финальная сверка + callback банка',
          note: 'Критический блокер снят, можно переходить к имитации денежного выпуска.'
        };
      }
      setMessage(`Эскроу ${row.id}: дополнительного перевода в ready не требуется.`);
      return row;
    }));
  };

  const returnToHold = (id: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (row.state === 'Частично раскрыто') {
        setMessage(`Эскроу ${row.id}: остаток возвращён в hold до закрытия документа или спора.`);
        return {
          ...row,
          state: 'Удержание',
          owner: 'Оператор / банк',
          note: 'Часть денег уже выпущена в sandbox, остаток снова удержан до дополнительной проверки.'
        };
      }
      setMessage(`Эскроу ${row.id}: возврат в hold возможен после частичного раскрытия.`);
      return row;
    }));
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Эскроу</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Sandbox-контур удержания и раскрытия денег по подтверждённым событиям: приёмка, лаборатория, документы, спор и callback банка. Это не live escrow и не боевое банковское списание.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
            Controlled-pilot · sandbox
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
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Активные escrow-кейсы</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['Все', 'Удержание', 'Ожидание решения', 'Готово к раскрытию', 'Частично раскрыто', 'Раскрыто'] as const).map((state) => {
              const active = filter === state;
              return (
                <button
                  key={state}
                  onClick={() => setFilter(state)}
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
                  {state}
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
          {filteredRows.map((item) => (
            <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F1419' }}>{item.id}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, ...stateStyle(item.state) }}>{item.state}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1419' }}>{item.deal}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Сумма под управлением</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{formatMillions(item.amount)}</div>
                </div>
                <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Уже выпущено</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{formatMillions(item.released)}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                Условие раскрытия: <span style={{ color: '#0F1419', fontWeight: 700 }}>{item.trigger}</span><br />
                Владелец шага: <span style={{ color: '#0F1419', fontWeight: 700 }}>{item.owner}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={`${PLATFORM_V7_DEALS_ROUTE}/${item.deal}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid #D4D9E2', color: '#0F1419', textDecoration: 'none', fontWeight: 800, background: '#fff' }}>
                  Открыть сделку
                </Link>
                <button onClick={() => moveToReady(item.id)} style={{ appearance: 'none', border: '1px solid rgba(37,99,235,0.18)', background: 'rgba(37,99,235,0.08)', color: '#2563EB', minHeight: 44, padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Снять блокер
                </button>
                <button onClick={() => releasePartial(item.id)} style={{ appearance: 'none', border: '1px solid rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', minHeight: 44, padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>
                  {item.state === 'Готово к раскрытию' ? 'Sandbox release' : item.state === 'Частично раскрыто' ? 'Финально раскрыть' : 'Проверить release'}
                </button>
                <button onClick={() => returnToHold(item.id)} style={{ appearance: 'none', border: '1px solid rgba(180,83,9,0.18)', background: 'rgba(180,83,9,0.08)', color: '#B45309', minHeight: 44, padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Вернуть в hold
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
