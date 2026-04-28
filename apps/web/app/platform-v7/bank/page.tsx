import Link from 'next/link';
import { P7MoneySafetyAuditStrip } from '@/components/platform-v7/P7MoneySafetyAuditStrip';
import { BankBeneficiariesPanel } from '@/components/platform-v7/BankBeneficiariesPanel';
import { BankManualReviewPanel } from '@/components/platform-v7/BankManualReviewPanel';
import { BankSmartContractsPanel } from '@/components/platform-v7/BankSmartContractsPanel';
import { BankRuntime } from '@/components/v7r/BankRuntime';
import { DomainMoneySummary } from '@/components/v7r/DomainMoneySummary';

const quickLinks = [
  {
    title: 'Проверка выпуска денег',
    description: 'Блокеры, удержания и кандидаты к выпуску.',
    href: '/platform-v7/bank/release-safety',
  },
  {
    title: 'Готовность сделки',
    description: 'ФГИС, документы, логистика, банк, спор и удержания.',
    href: '/platform-v7/readiness',
  },
  {
    title: 'Журнал торгов',
    description: 'История ставок, изменений, проверки денег и выбора предложения.',
    href: '/platform-v7/offer-log',
  },
  {
    title: 'Антиобход',
    description: 'Правила раскрытия сторон, контактов и удержания сделки внутри платформы.',
    href: '/platform-v7/anti-bypass',
  },
  {
    title: 'Пакет перевозочных документов',
    description: 'DL-9102 · юридически значимый пакет по рейсу, подписям и влиянию на выпуск денег.',
    href: '/platform-v7/deals/DL-9102/transport-documents',
  },
  {
    title: 'Факторинг',
    description: 'Лимиты покупателя, ставка, заявки на финансирование и выплаченные авансы.',
    href: '/platform-v7/bank/factoring',
  },
  {
    title: 'Эскроу',
    description: 'Резервирование денег до наступления подтверждённых условий раскрытия.',
    href: '/platform-v7/bank/escrow',
  },
];

const partners = [
  {
    name: 'Сбер',
    status: 'Активный контур',
    note: 'Основной банковый слой платформы: безопасная сделка, транспортный контроль, факторинг и эскроу.',
    tone: 'rgba(10,122,95,0.08)',
    border: 'rgba(10,122,95,0.18)',
    color: '#0A7A5F',
  },
  {
    name: 'ВТБ',
    status: 'Следующий слой',
    note: 'Кандидат на второй банковый контур после закрепления повторяемого пилота.',
    tone: '#F8FAFB',
    border: '#E4E6EA',
    color: '#475569',
  },
  {
    name: 'Альфа',
    status: 'Следующий слой',
    note: 'Потенциальный партнёр для расширения сценариев покупателя и платёжных инструментов.',
    tone: '#F8FAFB',
    border: '#E4E6EA',
    color: '#475569',
  },
  {
    name: 'Россельхозбанк',
    status: 'Профильный банк',
    note: 'Логичный кандидат для отраслевого масштаба после доказанного пилотного контура.',
    tone: '#F8FAFB',
    border: '#E4E6EA',
    color: '#475569',
  },
];

export default function PlatformV7BankPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DomainMoneySummary />
      <P7MoneySafetyAuditStrip />

      <section
        style={{
          background: 'linear-gradient(135deg, rgba(10,122,95,0.08) 0%, rgba(14,165,233,0.08) 100%)',
          border: '1px solid rgba(10,122,95,0.18)',
          borderRadius: 18,
          padding: 18,
          display: 'grid',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(10,122,95,0.18)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#0A7A5F', boxShadow: '0 0 0 3px rgba(10,122,95,0.12)' }} />
              <span style={{ fontSize: 12, fontWeight: 900, color: '#0F1419' }}>Банк · sandbox</span>
            </div>
            <h1 style={{ margin: '10px 0 0', fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: '#0F1419' }}>
              Банковый контур с guard-контролем
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#425466', maxWidth: 760 }}>
              Выпуск денег связан с приёмкой, документами, транспортным gate, комплаенсом и спором. Новые панели ниже работают в sandbox и не заявляют боевую банковую интеграцию.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid rgba(10,122,95,0.14)' }}>
              <span style={{ fontSize: 12, color: '#425466', fontWeight: 700 }}>Guard-контур</span>
              <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 900 }}>Включён</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid rgba(217,119,6,0.14)' }}>
              <span style={{ fontSize: 12, color: '#425466', fontWeight: 700 }}>Интеграции</span>
              <span style={{ fontSize: 12, color: '#B45309', fontWeight: 900 }}>sandbox</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: 'none',
                display: 'grid',
                gap: 8,
                padding: 16,
                borderRadius: 14,
                background: '#fff',
                border: '1px solid rgba(15,20,25,0.08)',
                boxShadow: '0 8px 24px rgba(15,20,25,0.04)',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1.3, fontWeight: 900, color: '#0F1419' }}>{link.title}</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: '#5B6576' }}>{link.description}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#0A7A5F' }}>Открыть →</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Банки-партнёры</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
            Сейчас активный контур построен вокруг Сбера. Остальные банки показаны как следующий слой масштаба, а не как уже подтверждённые боевые интеграции.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {partners.map((partner) => (
            <div key={partner.name} style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 14, background: partner.tone, border: `1px solid ${partner.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 900, color: '#0F1419' }}>{partner.name}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: `1px solid ${partner.border}`, color: partner.color, fontSize: 11, fontWeight: 800 }}>{partner.status}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{partner.note}</div>
            </div>
          ))}
        </div>
      </section>

      <BankBeneficiariesPanel />
      <BankSmartContractsPanel />
      <BankManualReviewPanel />
      <BankRuntime />
    </div>
  );
}
