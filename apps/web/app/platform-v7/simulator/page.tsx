import Link from 'next/link';
import {
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_EXPORT_CENTER_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
} from '@/lib/platform-v7/routes';

const scenarios = [
  ['Чистая сделка', 'все условия выполнены', 'сумма готовится к выпуску', 'документы собраны', 'низкий'],
  ['Нет СДИЗ', 'обязательный документ отсутствует', 'деньги остаются в резерве', 'нужен владелец документа', 'высокий'],
  ['Расхождение банка', 'ответ банка требует сверки', 'выпуск остановлен', 'нужна ручная проверка', 'высокий'],
  ['Отклонение маршрута', 'рейс вышел из маршрута', 'часть суммы удержана', 'нужны фото, пломба и геометка', 'средний'],
  ['Лабораторное отклонение', 'качество ниже условий', 'расчёт требует пересмотра', 'нужен протокол и решение сторон', 'средний'],
  ['Частичный выпуск', 'бесспорная часть подтверждена', 'часть к выплате, часть удержана', 'спорный пакет открыт', 'контролируемый'],
] as const;

export default function PlatformV7SimulatorPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={heroStyle}>
        <div style={badgeStyle}>Симулятор · тестовый сценарий</div>
        <div style={{ maxWidth: 920 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Сценарии сделки</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>
            Экран показывает, как разные отклонения меняют деньги, документы, логистику, спор и следующий шаг. Используется для controlled pilot и демонстрации без заявлений о внешних подключениях.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE} style={primaryLink}>Путь сделки</Link>
          <Link href={PLATFORM_V7_BANK_EVENTS_ROUTE} style={secondaryLink}>События банка</Link>
          <Link href={PLATFORM_V7_EXPORT_CENTER_ROUTE} style={secondaryLink}>Выгрузки</Link>
          <Link href={PLATFORM_V7_TRUST_ROUTE} style={secondaryLink}>Центр доверия</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {scenarios.map(([name, signal, money, next, risk]) => (
          <article key={name} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.25, color: '#0F1419' }}>{name}</h2>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #CBD5E1', fontSize: 11, color: '#334155', fontWeight: 900 }}>{risk}</span>
            </div>
            <Cell label="Сигнал" value={signal} />
            <Cell label="Деньги" value={money} />
            <Cell label="Следующее действие" value={next} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE} style={miniLink}>Показать в пути</Link>
              <Link href={name === 'Лабораторное отклонение' ? PLATFORM_V7_DISPUTES_ROUTE : PLATFORM_V7_BANK_EVENTS_ROUTE} style={miniLink}>Открыть контур</Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #EEF1F4', borderRadius: 12, padding: 10, background: '#F8FAFB' }}>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: '#0F1419', fontWeight: 750 }}>{value}</div>
    </div>
  );
}

const heroStyle = { border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 } as const;
const badgeStyle = { display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
const cardStyle = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 } as const;
const primaryLink = { display: 'inline-flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondaryLink = { ...primaryLink, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
const miniLink = { display: 'inline-flex', minHeight: 38, alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 10, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1', textDecoration: 'none', fontSize: 12, fontWeight: 850 } as const;
