'use client';

import Link from 'next/link';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_EXECUTION_SOURCE, formatRub, formatTons } from '@/lib/platform-v7/deal-execution-source-of-truth';

type ScenarioCard = {
  title: string;
  description: string;
  href: string;
  role?: PlatformRole;
  accent: string;
};

const ROLE_CARDS: ScenarioCard[] = [
  { title: 'Продавец', description: 'Лот, предложения, документы, отгрузка и получение денег.', href: '/platform-v7/seller', role: 'seller', accent: '#0A7A5F' },
  { title: 'Покупатель', description: 'Ставка, резерв денег, приёмка груза и закрытие документов.', href: '/platform-v7/buyer', role: 'buyer', accent: '#2563EB' },
  { title: 'Логистика', description: 'Заявка, водитель, маршрут, пломба, фото, вес и отклонения.', href: '/platform-v7/logistics', role: 'logistics', accent: '#7C3AED' },
  { title: 'Водитель', description: 'Один рейс, маршрут и события без доступа к деньгам.', href: '/platform-v7/driver', role: 'driver', accent: '#475569' },
  { title: 'Банк', description: 'Резерв, удержание, выпуск денег и причины остановки.', href: '/platform-v7/bank', role: 'bank', accent: '#0F172A' },
  { title: 'Приёмка', description: 'Элеватор, лаборатория, вес, качество и основание выплаты.', href: '/platform-v7/elevator', role: 'elevator', accent: '#B45309' },
];

const SUPPORT_LINKS = [
  { title: 'Центр управления', href: '/platform-v7/control-tower', role: 'operator' as PlatformRole },
  { title: 'Документы', href: '/platform-v7/documents' },
  { title: 'Споры', href: '/platform-v7/disputes' },
  { title: 'Лаборатория', href: '/platform-v7/lab', role: 'lab' as PlatformRole },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor', role: 'surveyor' as PlatformRole },
  { title: 'Комплаенс', href: '/platform-v7/compliance', role: 'compliance' as PlatformRole },
] as const;

function RoleCard({ scenario }: { scenario: ScenarioCard }) {
  const { setRole } = usePlatformV7RStore();

  return (
    <Link
      href={`${scenario.href}${scenario.role ? `?as=${scenario.role}` : ''}`}
      onClick={() => scenario.role && setRole(scenario.role)}
      style={{
        textDecoration: 'none',
        background: '#fff',
        border: '1px solid #E4E6EA',
        borderRadius: 22,
        padding: 18,
        display: 'grid',
        gap: 12,
        minHeight: 188,
        boxShadow: '0 12px 28px rgba(15,20,25,0.045)',
      }}
    >
      <div style={{ width: 42, height: 4, borderRadius: 999, background: scenario.accent }} />
      <div style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.08, fontWeight: 950, color: '#0F1419' }}>{scenario.title}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#475569' }}>{scenario.description}</p>
      </div>
      <div style={{ marginTop: 'auto', minHeight: 44, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', background: scenario.accent, color: '#fff', fontSize: 15, fontWeight: 900, textAlign: 'center' }}>
        Открыть
      </div>
    </Link>
  );
}

export function PlatformRolesHub() {
  const { setRole } = usePlatformV7RStore();
  const { deal, logistics, money, documents } = PLATFORM_V7_EXECUTION_SOURCE;

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 20, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 860 }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
            Пилотный контур сделки
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px, 8.5vw, 62px)', lineHeight: 1.02, letterSpacing: '-0.052em', fontWeight: 950, color: '#0F1419' }}>
            Центр исполнения зерновой сделки
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#475569' }}>
            Один экран показывает сделку, деньги, документы, груз, спор и следующий ответственный шаг.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={microLabel}>Сквозной сценарий</div>
            <h2 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(26px, 7vw, 42px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 950 }}>
              {deal.lotId} → ставка → {deal.id} → {logistics.orderId} → {logistics.tripId}
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: 14, lineHeight: 1.55 }}>
              {deal.crop} · {formatTons(deal.volumeTons)} · резерв {formatRub(money.reservedRub)} · документы: {documents.transportPackStatus}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/lots/${deal.lotId}`} style={darkButton}>Открыть лот</Link>
            <Link href={`/platform-v7/deals/${deal.id}/clean`} style={lightButton}>Открыть сделку</Link>
            <Link href='/platform-v7/logistics/inbox' style={lightButton}>Заявка в логистике</Link>
            <Link href='/platform-v7/driver' style={lightButton}>Рейс водителя</Link>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {ROLE_CARDS.map((scenario) => <RoleCard key={scenario.title} scenario={scenario} />)}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12 }}>
        <div style={microLabel}>Дополнительные контуры</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUPPORT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={`${link.href}${'role' in link ? `?as=${link.role}` : ''}`}
              onClick={() => 'role' in link && setRole(link.role)}
              style={pillLink}
            >
              {link.title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

const microLabel = { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 900 } as const;
const darkButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const lightButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const pillLink = { textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 850 } as const;
