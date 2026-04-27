import Link from 'next/link';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_MARKET_RFQ_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const links = [
  { title: 'Банк', href: PLATFORM_V7_BANK_ROUTE },
  { title: 'Проверка выпуска денег', href: PLATFORM_V7_RELEASE_SAFETY_ROUTE },
  { title: 'Market / RFQ', href: PLATFORM_V7_MARKET_RFQ_ROUTE },
  { title: 'Центр управления', href: PLATFORM_V7_CONTROL_TOWER_ROUTE },
  { title: 'Инвестор', href: '/platform-v7/investor' },
];

const groups = [
  {
    title: 'Что уже собрано',
    items: [
      ['Market/RFQ route', 'ready'],
      ['release-safety audit', 'ready'],
      ['Bank Hub sandbox panels', 'partial'],
      ['Deal Workspace tabs', 'partial'],
      ['seller FGIS sandbox', 'partial'],
      ['buyer financing sandbox', 'partial'],
      ['logistics sandbox projection', 'partial'],
    ],
  },
  {
    title: 'Что нельзя заявлять как live',
    items: [
      ['live bank integration', 'missing'],
      ['live FGIS integration', 'missing'],
      ['live GPS/telematics', 'missing'],
      ['live EDO/ETRN signing', 'missing'],
      ['confirmed GMV', 'missing'],
    ],
  },
  {
    title: 'Риски для банка и инвестора',
    items: [
      ['live integrations not confirmed', 'missing'],
      ['real deals not proven', 'missing'],
      ['anti-bypass not validated', 'missing'],
      ['unit economics not verified', 'missing'],
      ['legal docs need review', 'partial'],
      ['bank pilot required', 'partial'],
    ],
  },
];

function statusTone(status: string) {
  if (status === 'ready') return { label: 'ready', color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'partial') return { label: 'partial', color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
  return { label: 'missing', color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
}

export default function PlatformV7DataRoomPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Room · controlled pilot</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Проверочный пакет для банка и инвестора</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 880 }}>
              Честная карта состояния platform-v7: что уже собрано в sandbox, что требует controlled pilot и что нельзя заявлять как production-ready.
            </div>
          </div>
          <Link href='/platform-v7/investor' style={btn()}>Инвестор</Link>
        </div>
      </section>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Honesty rule</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Статус проекта: sandbox / controlled pilot / pilot-ready with accompaniment. Live bank, live FGIS, live GPS, live EDO и production-ready здесь не заявляются.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none', background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, color: BRAND, fontSize: 13, fontWeight: 900 }}>
            {link.title} →
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        {groups.map((group) => (
          <section key={group.title} style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: T }}>{group.title}</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {group.items.map(([label, status]) => {
                const tone = statusTone(status);
                return (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
                    <span style={{ fontSize: 13, color: T, fontWeight: 800 }}>{label}</span>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 900 }}>{tone.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function btn() {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
