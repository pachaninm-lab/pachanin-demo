import Link from 'next/link';

const ITEMS = [
  { id: 'N-101', type: 'critical', title: 'DL-9102: выпуск денег заблокирован', note: 'Открыт спор по качеству и не хватает пакета доказательств.', action: '/platform-v7/disputes/DSP-104', bucket: 'Критичные' },
  { id: 'N-102', type: 'sla', title: 'DL-9107: истекает SLA оператора', note: 'До дедлайна осталось менее 4 часов.', action: '/platform-v7/control-tower', bucket: 'SLA' },
  { id: 'N-103', type: 'bank', title: 'CB-441: банк подтвердил release', note: 'Деньги по сделке готовы к финальному отражению.', action: '/platform-v7/bank/events/CB-441', bucket: 'Банк' },
  { id: 'N-104', type: 'logistics', title: 'ТМБ-14: водитель подтвердил прибытие', note: 'Можно переходить к приёмке и акту.', action: '/platform-v7/logistics/%D0%A2%D0%9C%D0%91-14', bucket: 'Логистика' },
  { id: 'N-105', type: 'deal', title: 'LOT-2403: лот переведён в PASS', note: 'Документы и source reference прошли проверку.', action: '/platform-v7/lots/LOT-2403', bucket: 'Сделки' },
];

const FILTERS = ['Критичные', 'SLA', 'Сделки', 'Банк', 'Логистика'];
const QUICK_ACTIONS = [
  { title: 'Архивировать прочитанные', note: 'Очистить шум и оставить только активные сигналы.' },
  { title: 'Pin критичные', note: 'Закрепить верхние блокеры до снятия риска.' },
  { title: 'Snooze на 1 час', note: 'Отложить неключевые события без потери контекста.' },
];

function tone(type: string) {
  if (type === 'critical') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Критично' };
  if (type === 'sla') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'SLA' };
  if (type === 'bank') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'Банк' };
  if (type === 'logistics') return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB', label: 'Логистика' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569', label: 'Сделка' };
}

export default function NotificationsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Уведомления</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Единый inbox по критичным событиям: сделки, банк, логистика, SLA и контур документов. Это рабочий центр внимания, а не декоративный список.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Фильтры и действия</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Базовый P1-слой inbox-центра: фильтры по типу сигналов и быстрые операторские действия без потери контекста.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((filter) => (
            <span key={filter} style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 800 }}>
              {filter}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {QUICK_ACTIONS.map((item) => (
            <div key={item.title} style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {ITEMS.map((item) => {
          const t = tone(item.type);
          return (
            <article key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800 }}>{item.bucket}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 800 }}>
                  {t.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={item.action} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                  Открыть
                </Link>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700 }}>
                  Pin
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700 }}>
                  Snooze
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Control Tower
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
      </div>
    </div>
  );
}
