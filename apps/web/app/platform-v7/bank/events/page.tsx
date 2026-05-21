import Link from 'next/link';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
} from '@/lib/platform-v7/routes';

const bankEvents = [
  {
    code: 'BE-RESERVE-01',
    title: 'Резерв подтверждён',
    deal: 'DL-9102',
    status: 'успешно',
    amount: '3 873 600 ₽',
    effect: 'деньги видны в резерве; выпуск невозможен до документов и закрытия рейса',
    next: 'проверить документы и рейс',
  },
  {
    code: 'BE-RELEASE-02',
    title: 'Запрос выпуска остановлен',
    deal: 'DL-9103',
    status: 'остановлено',
    amount: '1 240 000 ₽',
    effect: 'часть суммы удержана из-за спора по качеству',
    next: 'открыть пакет доказательств',
  },
  {
    code: 'BE-MISMATCH-03',
    title: 'Расхождение ответа банка',
    deal: 'DL-9116',
    status: 'ручная проверка',
    amount: '780 000 ₽',
    effect: 'выпуск запрещён до сверки события банка и статуса сделки',
    next: 'назначить ответственного оператора',
  },
  {
    code: 'BE-RETRY-04',
    title: 'Повторная отправка безопасна',
    deal: 'DL-9120',
    status: 'ожидает',
    amount: '410 000 ₽',
    effect: 'повтор не создаёт двойной выпуск; используется ключ идемпотентности',
    next: 'дождаться ответа внешнего контура',
  },
] as const;

const eventTypes = [
  ['Резерв', 'Создание денежного контейнера под сделку.'],
  ['Удержание', 'Временная остановка выпуска из-за документа, спора или расхождения.'],
  ['Выпуск', 'Движение денег только после выполнения условий сделки.'],
  ['Сверка', 'Сопоставление ответа банка, статуса сделки и журнала действий.'],
] as const;

export default function PlatformV7BankEventsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#B45309', fontSize: 12, fontWeight: 900 }}>
          Банк · тестовые события
        </div>
        <div style={{ maxWidth: 920 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Консоль банковских событий</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>
            Экран показывает, как денежные события влияют на сделку: резерв, удержание, выпуск, расхождение и ручная проверка. Это тестовый контур для пилота, а не подтверждение боевого подключения банка.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={PLATFORM_V7_RELEASE_SAFETY_ROUTE} style={primaryLink}>Проверка выпуска</Link>
          <Link href={PLATFORM_V7_BANK_ROUTE} style={secondaryLink}>Банковый контур</Link>
          <Link href={PLATFORM_V7_TRUST_ROUTE} style={secondaryLink}>Центр доверия</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {eventTypes.map(([title, description]) => (
          <article key={title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 15, color: '#0F1419', fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#64748B' }}>{description}</div>
          </article>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Журнал событий</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {bankEvents.map((event) => (
            <article key={event.code} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #EEF1F4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900 }}>{event.code} · {event.deal}</div>
                  <div style={{ marginTop: 4, fontSize: 15, color: '#0F1419', fontWeight: 900 }}>{event.title}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 9px', borderRadius: 999, background: '#fff', border: '1px solid #CBD5E1', fontSize: 11, color: '#334155', fontWeight: 900 }}>{event.status}</span>
                  <span style={{ padding: '5px 9px', borderRadius: 999, background: '#fff', border: '1px solid #CBD5E1', fontSize: 11, color: '#0A7A5F', fontWeight: 900 }}>{event.amount}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                <Cell label="Влияние на сделку" value={event.effect} />
                <Cell label="Следующее действие" value={event.next} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #EEF1F4', borderRadius: 12, padding: 10, background: '#fff' }}>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: '#0F1419', fontWeight: 750 }}>{value}</div>
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
