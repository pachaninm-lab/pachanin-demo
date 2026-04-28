import Link from 'next/link';
import { OperatorQueuesPage } from '@/components/v7r/EsiaFgisRuntime';

const links = [
  { title: 'Проверка выпуска денег', href: '/platform-v7/bank/release-safety', note: 'Блокеры, удержания и кандидаты к выпуску' },
  { title: 'Готовность сделки', href: '/platform-v7/readiness', note: 'ФГИС, документы, логистика, банк и спор' },
  { title: 'Журнал торгов', href: '/platform-v7/offer-log', note: 'История ставок, изменений и выбора предложения' },
  { title: 'Антиобход', href: '/platform-v7/anti-bypass', note: 'Правила раскрытия сторон и контактов' },
  { title: 'Логистика', href: '/platform-v7/logistics', note: 'Маршруты, сроки прибытия и отклонения' },
];

export default function PlatformV7OperatorAliasPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'grid',
              gap: 6,
              textDecoration: 'none',
              border: '1px solid rgba(10,122,95,0.18)',
              borderRadius: 18,
              padding: 16,
              background: 'rgba(10,122,95,0.08)',
              color: '#0A7A5F',
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            <span>{link.title} →</span>
            <span style={{ color: '#475569', fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>{link.note}</span>
          </Link>
        ))}
      </section>
      <OperatorQueuesPage />
    </div>
  );
}
