'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_MATURITY_LABEL, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportObjectLabel, supportSortCases } from '@/lib/platform-v7/support-helpers';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const fieldRoles = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const scopedRoles = new Set<PlatformRole>(['bank', 'arbitrator', 'compliance']);
const operatorRoles = new Set<PlatformRole>(['operator', 'executive']);
const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];
const card: CSSProperties = { background: 'var(--pc-bg-card,#fff)', border: '1px solid var(--pc-border,#E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted,#64748b)', fontSize: 13, lineHeight: 1.55 };
const pill: CSSProperties = { display: 'inline-flex', width: 'fit-content', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border,#E4E6EA)', fontSize: 11, fontWeight: 850 };

function isRole(value: string | null): value is PlatformRole { return !!value && roles.includes(value as PlatformRole); }
function dt(value: string) { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function intro(role: PlatformRole) {
  if (fieldRoles.has(role)) return { title: role === 'driver' ? 'Помощь по моему рейсу' : 'Помощь по моей проверке', text: 'Только мои обращения по рейсу, фото, пломбе, весу, пробе или задержке. Банк, деньги и операторская очередь скрыты.', money: false, operator: false };
  if (scopedRoles.has(role)) return { title: 'Поддержка по моему контуру', text: 'Обращения по основанию, документу, допуску, спору или ручной сверке. Общая операторская очередь скрыта.', money: role === 'bank' || role === 'arbitrator', operator: false };
  return { title: 'Центр поддержки', text: 'Обращения привязаны к сделке, документу, рейсу, деньгам, спору или блокеру.', money: true, operator: operatorRoles.has(role) };
}

export function SupportIndexPage() {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const queryRole = searchParams.get('role');
  const role = isRole(queryRole) ? queryRole : storeRole;
  const { cases } = useSupportCases();
  const sortedCases = supportSortCases(cases);
  const view = intro(role);
  const totalMoney = sortedCases.reduce((sum, item) => sum + item.moneyAtRiskRub, 0);
  const urgent = sortedCases.filter((item) => item.priority === 'P0' || item.priority === 'P1').length;

  return (
    <div data-testid='platform-v7-support-page' style={{ display: 'grid', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <style>{`@media(max-width:767px){[data-testid='platform-v7-support-page']{gap:10px!important}.p7-support-hero{padding:16px!important;border-radius:24px!important;gap:8px!important}.p7-support-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}.p7-support-hero p{font-size:13px!important;line-height:1.45!important}.p7-support-create{width:100%!important;justify-content:center!important;min-height:52px!important}.p7-support-metrics{grid-template-columns:1fr 1fr!important;gap:8px!important}.p7-support-metrics>div{padding:12px!important;border-radius:16px!important}.p7-support-metrics>div:nth-child(n+3){display:none!important}.p7-support-list{padding:14px!important;border-radius:22px!important}.p7-support-list h2{font-size:22px!important}.p7-support-case{display:block!important;padding:14px!important;border-radius:16px!important;background:#fff!important;color:#0F1419!important}.p7-support-case a{display:grid!important;gap:8px!important;color:#0F1419!important;text-decoration:none!important}.p7-support-case-grid{display:none!important}.p7-support-mobile-card{display:grid!important}.p7-support-mobile-title{font-size:15px!important;line-height:1.25!important;color:#0F1419!important}.p7-support-mobile-meta{font-size:12px!important;line-height:1.35!important;color:#64748b!important}.p7-support-mobile-open{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:fit-content!important;min-height:34px!important;padding:0 12px!important;border-radius:999px!important;border:1px solid #E4E6EA!important;color:#0F1419!important;background:#fff!important;font-size:12px!important;font-weight:900!important}}@media(min-width:768px){.p7-support-mobile-card{display:none!important}}`}</style>

      <section className='p7-support-hero' style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={pill}>{SUPPORT_MATURITY_LABEL}</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{view.title}</h1>
        <p style={{ ...muted, margin: 0 }}>{view.text}</p>
        <Link className='p7-support-create' href={`/platform-v7/support/new?role=${role}`} style={primary}>Создать обращение</Link>
      </section>

      <section className='p7-support-metrics' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Metric label='Всего обращений' value={String(sortedCases.length)} />
        <Metric label='Срочные' value={String(urgent)} />
        {view.money ? <Metric label='Деньги под риском' value={supportFormatRub(totalMoney)} /> : null}
        {view.operator ? <div style={card}><div style={muted}>Операторская очередь</div><Link href='/platform-v7/support/operator' style={inlineLink}>Открыть очередь</Link></div> : null}
      </section>

      <section className='p7-support-list' style={{ ...card, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{fieldRoles.has(role) ? 'Мои обращения' : 'Обращения'}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {sortedCases.length === 0 ? <div style={{ ...card, background: 'var(--pc-bg-elevated,rgba(15,20,25,.02))' }}>Нет обращений по этой роли.</div> : null}
          {sortedCases.map((item) => (
            <article className='p7-support-case' key={item.id} style={{ border: '1px solid var(--pc-border,#E4E6EA)', borderRadius: 16, padding: 14, background: 'var(--pc-bg-elevated,rgba(15,20,25,.02))', color: 'var(--pc-text-primary,#0F1419)' }}>
              <Link href={`/platform-v7/support/detail?id=${encodeURIComponent(item.id)}&role=${role}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className='p7-support-mobile-card' style={{ display: 'none', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span></div>
                  <b className='p7-support-mobile-title'>{item.title || 'Детали обращения'}</b>
                  <span className='p7-support-mobile-meta'>{SUPPORT_STATUS_LABELS[item.status]} · {supportObjectLabel(item)} · SLA {dt(item.slaDueAt)}</span>
                  <span className='p7-support-mobile-meta'>{item.nextAction}</span>
                  <span className='p7-support-mobile-open'>Раскрыть</span>
                </div>
                <div className='p7-support-case-grid' style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.2fr) minmax(180px,.8fr) minmax(180px,.8fr)', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 7 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span></div><b>{item.title || 'Детали обращения'}</b></div>
                  <div style={{ display: 'grid', gap: 5 }}><span style={muted}>Статус</span><b>{SUPPORT_STATUS_LABELS[item.status]}</b><span style={muted}>{item.nextAction}</span></div>
                  <div style={{ display: 'grid', gap: 5 }}><span style={muted}>{supportObjectLabel(item)}</span><b>SLA: {dt(item.slaDueAt)}</b>{view.money ? <b>{supportFormatRub(item.moneyAtRiskRub)}</b> : null}</div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={card}><div style={muted}>{label}</div><div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div></div>; }
const primary: CSSProperties = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', padding: '12px 14px', borderRadius: 14, background: 'var(--pc-accent,#0A7A5F)', color: '#fff', fontSize: 13, fontWeight: 900 };
const inlineLink: CSSProperties = { color: 'var(--pc-accent,#0A7A5F)', fontSize: 14, fontWeight: 900, textDecoration: 'none' };
