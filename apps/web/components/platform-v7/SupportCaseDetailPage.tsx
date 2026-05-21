'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { P7HiddenDetails } from '@/components/platform-v7/P7HiddenDetails';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  supportAuditTransitionLabel,
  supportFormatRub,
  supportLastMessage,
  supportLinkedExecutionHref,
  supportObjectLabel,
  supportSlaLabel,
  supportSortedAuditEvents,
} from '@/lib/platform-v7/support-helpers';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const fieldRoles = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const moneyRoles = new Set<PlatformRole>(['operator', 'executive', 'buyer', 'seller', 'bank', 'arbitrator']);
const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];
const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', width: 'fit-content', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 850 };

function isPlatformRole(value: string | null): value is PlatformRole {
  return !!value && roles.includes(value as PlatformRole);
}

function dt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function roleTitle(role: PlatformRole) {
  if (role === 'driver') return 'Водительский контур';
  if (fieldRoles.has(role)) return 'Полевой контур';
  if (role === 'bank') return 'Банковская проверка';
  if (role === 'arbitrator') return 'Арбитраж';
  if (role === 'compliance') return 'Комплаенс';
  return 'Контур поддержки';
}

export function SupportCaseDetailPage({ caseId }: { caseId: string }) {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const queryRole = searchParams.get('role');
  const role = isPlatformRole(queryRole) ? queryRole : storeRole;
  const showMoney = moneyRoles.has(role) && !fieldRoles.has(role);
  const { cases, messages, auditEvents, updateCaseStatus } = useSupportCases();
  const item = cases.find((supportCase) => supportCase.id === caseId);
  const roleQuery = `role=${role}`;

  if (!item) {
    return (
      <div data-testid='platform-v7-support-case-detail' style={{ display: 'grid', gap: 16, maxWidth: 880, margin: '0 auto' }}>
        <section style={card}>
          <div style={{ ...pill, color: 'var(--pc-danger, #B42318)', borderColor: 'rgba(180,35,24,.2)' }}>Обращение не найдено</div>
          <h1 style={{ margin: '10px 0 0', fontSize: 28 }}>Нет обращения {caseId}</h1>
          <p style={muted}>В текущем контуре поддержки нет такого ID. Вернись в список обращений и открой карточку оттуда.</p>
          <Link href={`/platform-v7/support?${roleQuery}`} style={primaryLink}>К списку обращений</Link>
        </section>
      </div>
    );
  }

  const publicMessages = messages.filter((message) => message.caseId === item.id && message.public);
  const audit = supportSortedAuditEvents(auditEvents.filter((event) => event.caseId === item.id));
  const executionHref = supportLinkedExecutionHref(item);

  return (
    <div data-testid='platform-v7-support-case-detail' style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-support-case-detail']{gap:12px!important}
          .p7-support-case-hero{padding:16px!important;border-radius:24px!important}
          .p7-support-case-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
          .p7-support-case-hero p{font-size:13px!important;line-height:1.45!important}
          .p7-support-case-grid{grid-template-columns:1fr!important;gap:8px!important}
          .p7-support-case-grid > div:nth-child(n+4){display:none!important}
          .p7-support-case-actions{display:grid!important;grid-template-columns:1fr!important}
          .p7-support-case-actions a,.p7-support-case-actions button{width:100%!important;min-height:52px!important;justify-content:center!important}
          .p7-support-case-desktop-heavy{display:none!important}
        }
      `}</style>

      <section className='p7-support-case-hero' style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...pill, color: 'var(--pc-accent, #0A7A5F)' }}>{roleTitle(role)}</span>
          <span style={pill}>{item.id}</span>
          <span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span>
          <span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>{item.title}</h1>
        <p style={{ ...muted, margin: 0 }}>{item.description}</p>
        <div className='p7-support-case-actions' style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/support?${roleQuery}`} style={secondaryLink}>Все обращения</Link>
          <Link href={executionHref} style={secondaryLink}>Открыть объект</Link>
          <button type='button' onClick={() => updateCaseStatus(item.id, 'waiting_user', roleTitle(role), 'Запрошены данные для закрытия обращения.')} style={buttonLink}>Запросить данные</button>
        </div>
      </section>

      <section className='p7-support-case-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <Metric label='Статус' value={SUPPORT_STATUS_LABELS[item.status]} />
        <Metric label='SLA' value={`${supportSlaLabel(item)} · ${dt(item.slaDueAt)}`} danger={supportSlaLabel(item).includes('просрочен')} />
        <Metric label='Ответственный' value={item.owner} />
        <Metric label='Объект' value={supportObjectLabel(item)} />
        {showMoney ? <Metric label='Деньги под риском' value={supportFormatRub(item.moneyAtRiskRub)} danger={item.moneyAtRiskRub > 0} /> : null}
        <Metric label='Следующий шаг' value={item.nextAction} />
      </section>

      <section style={{ ...card, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Последнее сообщение</h2>
        <p style={{ ...muted, margin: 0 }}>{supportLastMessage(item.id, messages)}</p>
        <P7HiddenDetails title='История сообщений' meta='показывается по запросу, чтобы не перегружать экран'>
          <div style={{ display: 'grid', gap: 8 }}>
            {publicMessages.map((message) => (
              <div key={message.id} style={messageCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>{message.author}</b><span style={muted}>{dt(message.createdAt)}</span></div>
                <p style={{ margin: '6px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.55 }}>{message.body}</p>
              </div>
            ))}
          </div>
        </P7HiddenDetails>
      </section>

      <section className='p7-support-case-desktop-heavy' style={{ ...card, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Журнал обращения</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {audit.map((event) => (
            <div key={event.id} style={messageCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>{event.action}</b><span style={muted}>{dt(event.createdAt)}</span></div>
              <p style={{ margin: '6px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.55 }}>{event.description}</p>
              {supportAuditTransitionLabel(event) ? <div style={{ marginTop: 6, ...pill }}>{supportAuditTransitionLabel(event)}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={card}><div style={muted}>{label}</div><div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, fontWeight: 900, color: danger ? 'var(--pc-danger, #B42318)' : 'var(--pc-text-primary, #0F1419)' }}>{value}</div></div>;
}

const messageCard: CSSProperties = { border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 12, background: 'var(--pc-bg-elevated, rgba(15,20,25,.02))' };
const primaryLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', textDecoration: 'none', padding: '11px 14px', borderRadius: 14, background: 'var(--pc-accent, #0A7A5F)', color: '#fff', fontSize: 13, fontWeight: 900 };
const secondaryLink: CSSProperties = { ...primaryLink, background: 'var(--pc-bg-card, #fff)', color: 'var(--pc-text-primary, #0F1419)', border: '1px solid var(--pc-border, #E4E6EA)' };
const buttonLink: CSSProperties = { ...secondaryLink, cursor: 'pointer' };
