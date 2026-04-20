import Link from 'next/link';
import { BankRuntime } from '@/components/v7r/BankRuntime';

const quickLinks = [
  {
    title: 'Пакет перевозочных документов',
    description: 'DL-9102 · юрзначимый пакет СберКорус по рейсу, подписи и влияние на выпуск денег.',
    href: '/platform-v7/deals/DL-9102/transport-documents',
  },
  {
    title: 'Полная симуляция сценария',
    description: 'Пошаговая имитация: пакет → подписи → webhooks → release gate.',
    href: '/platform-v7/deals/DL-9102/transport-documents/simulation',
  },
  {
    title: 'Горячий список оператора',
    description: 'Кейсы, где транспортный контур тормозит деньги и требует действий.',
    href: '/platform-v7/control-tower/hotlist',
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

export default function PlatformV7BankPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
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
              <span style={{ fontSize: 12, fontWeight: 900, color: '#0F1419' }}>СберКорус</span>
            </div>
            <h1 style={{ margin: '10px 0 0', fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: '#0F1419' }}>
              Банковый контур с транспортным gate
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#425466', maxWidth: 760 }}>
              Выпуск денег теперь связан не только с приёмкой и спором, но и с внешним юридически значимым транспортным контуром. В демо это слой СберКорус: пакет документов, подписи, webhooks и итоговый transport gate для release.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid rgba(10,122,95,0.14)' }}>
              <span style={{ fontSize: 12, color: '#425466', fontWeight: 700 }}>Transport gate</span>
              <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 900 }}>Под контролем</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid rgba(217,119,6,0.14)' }}>
              <span style={{ fontSize: 12, color: '#425466', fontWeight: 700 }}>Кейс на разбор</span>
              <span style={{ fontSize: 12, color: '#B45309', fontWeight: 900 }}>DL-9102</span>
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

      <BankRuntime />
    </div>
  );
}
