'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { P7HiddenDetails } from '@/components/platform-v7/P7HiddenDetails';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_MATURITY_LABEL, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportLastMessage, supportObjectLabel, supportSortCases } from '@/lib/platform-v7/support-helpers';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 800 };

const FIELD_SUPPORT_ROLES = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const OPERATOR_SUPPORT_ROLES = new Set<PlatformRole>(['operator', 'executive']);
const SCOPED_SUPPORT_ROLES = new Set<PlatformRole>(['bank', 'arbitrator', 'compliance']);
const PLATFORM_ROLES: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

function isPlatformRole(value: string | null): value is PlatformRole {
  return !!value && PLATFORM_ROLES.includes(value as PlatformRole);
}

function dt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function supportIntro(role: PlatformRole) {
  if (FIELD_SUPPORT_ROLES.has(role)) {
    return {
      title: role === 'driver' ? 'Помощь по моему рейсу' : 'Помощь по моей проверке',
      text: 'Здесь видны только мои обращения по рейсу, документу, фото, пломбе, весу, пробе или задержке. Операторские очереди, суммы риска и банковские данные скрыты.',
      listTitle: 'Мои обращения',
      showOperatorMetrics: false,
      showMoney: false,
    };
  }

  if (SCOPED_SUPPORT_ROLES.has(role)) {
    return {
      title: 'Поддержка по моему контуру',
      text: 'Здесь видны обращения, связанные с моей зоной проверки: основание, документ, допуск, спор или ручная сверка. Общая операторская очередь скрыта.',
      listTitle: 'Обращения по моему контуру',
      showOperatorMetrics: false,
      showMoney: role === 'bank' || role === 'arbitrator',
    };
  }

  return {
    title: 'Центр поддержки исполнения сделки',
    text: 'Каждое обращение привязано к сделке, документу, рейсу, деньгам, спору или блокеру. Сначала видны статус, риск и следующий шаг; детали раскрываются отдельно.',
    listTitle: 'Мои обращения',
    showOperatorMetrics: OPERATOR_SUPPORT_ROLES.has(role),
    showMoney: true,
  };
}

export function SupportIndexPage() {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const queryRole = searchParams.get('role');
  const role = isPlatformRole(queryRole) ? queryRole : storeRole;
  const { cases, messages } = useSupportCases();
  const sortedCases = supportSortCases(cases);
  const totalMoney = sortedCases.reduce((sum, item) => sum + item.moneyAtRiskRub, 0);
  const urgent = sortedCases.filter((item) => item.priority === 'P0' || item.priority === 'P1').length;
  const intro = supportIntro(role);

  return (
    <div data-testid='platform-v7-support-page' style={{ display: 'grid', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-support-page']{gap:12px!important}
          .p7-support-hero{grid-template-columns:1fr!important;padding:16px!important;border-radius:24px!important}
          .p7-support-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
          .p7-support-hero p{font-size:13px!important;line-height:1.45!important}
          .p7-support-create{width:100%!important;justify-content:center!important;min-height:52px!important}
          .p7-support-metrics{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .p7-support-metrics > div{padding:12px!important;border-radius:16px!important}
          .p7-support-metrics > div:nth-child(n+3){display:none!important}
          .p7-support-case{padding:13px!important;border-radius:16px!important;gap:8px!important}
          .p7-support-case-grid{grid-template-columns:1fr!important;gap:8px!important}
          .p7-support-case-grid > div:nth-child(3){display:none!important}
          .p7-support-list-header a{display:none!important}
        }
      `}</style>
      <section className='p7-support-hero' style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ ...pill, width: 'fit-content' }}>{SUPPORT_MATURITY_LABEL}</div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{intro.title}</h1>
          <p style={muted}>{intro.text}</p>
        </div>
        <Link className='p7-support-create' href={`/platform-v7/support/new?role=${role}`} style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 14, background: 'var(--pc-accent, #0A7A5F)', color: '#fff', fontSize: 13, fontWeight: 900, width: 'fit-content', display: 'inline-flex', alignItems: 'center' }}>Создать обращение</Link>
      </section>

      <section className='p7-support-metrics' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>Всего обращений</div><div style={{ fontSize: 28, fontWeight: 900 }}>{sortedCases.length}</div></div>
        <div style={card}><div style={muted}>Срочные</div><div style={{ fontSize: 28, fontWeight: 900 }}>{urgent}</div></div>
        {intro.showMoney ? <div style={card}><div style={muted}>Деньги под риском</div><div style={{ fontSize: 28, fontWeight: 900 }}>{supportFormatRub(totalMoney)}</div></div> : null}
        {intro.showOperatorMetrics ? <div style={card}><div style={muted}>Операторская очередь</div><Link href='/platform-v7/support/operator' style={{ color: 'var(--pc-accent, #0A7A5F)', fontSize: 14, fontWeight: 900, textDecoration: 'none' }}>Открыть очередь</Link></div> : null}
      </section>

      <section style={{ ...card, display: 'grid', gap: 12 }}>
        <div className='p7-support-list-header' style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{intro.listTitle}</h2>
          <Link href={`/platform-v7/support/new?role=${role}`} style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>+ Новое обращение</Link>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {sortedCases.map((item) => (
            <article className='p7-support-case' key={item.id} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 16, padding: 14, display: 'grid', gap: 10, background: 'var(--pc-bg-elevated, rgba(15,20,25,0.02))' }}>
              <Link href={`/platform-v7/support/${item.id}?role=${role}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className='p7-support-case-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 7 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span></div><div style={{ fontSize: 16, fontWeight: 900 }}>{item.title}</div></div>
                  <div style={{ display: 'grid', gap: 6 }}><div style={muted}>Статус</div><b>{SUPPORT_STATUS_LABELS[item.status]}</b><div style={muted}>Следующий шаг: {item.nextAction}</div></div>
                  <div style={{ display: 'grid', gap: 6 }}><div style={muted}>{supportObjectLabel(item)}</div><b>SLA: {dt(item.slaDueAt)}</b>{intro.showMoney ? <b>{supportFormatRub(item.moneyAtRiskRub)}</b> : null}</div>
                </div>
              </Link>
              <P7HiddenDetails title='Детали обращения' meta='последнее сообщение, объект, SLA и влияние на деньги'>
                <p style={{ ...muted, margin: 0 }}>{supportLastMessage(item.id, messages)}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
                  <div style={miniCell}><span style={miniLabel}>Объект</span><b>{supportObjectLabel(item)}</b></div>
                  <div style={miniCell}><span style={miniLabel}>SLA</span><b>{dt(item.slaDueAt)}</b></div>
                  <div style={miniCell}><span style={miniLabel}>Ответственный</span><b>{item.owner}</b></div>
                  {intro.showMoney ? <div style={miniCell}><span style={miniLabel}>Деньги под риском</span><b>{supportFormatRub(item.moneyAtRiskRub)}</b></div> : null}
                </div>
              </P7HiddenDetails>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const miniCell: CSSProperties = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 10, display: 'grid', gap: 4 };
const miniLabel: CSSProperties = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' };
