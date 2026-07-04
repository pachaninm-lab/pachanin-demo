import Link from 'next/link';
import { CockpitHero, PremiumCtaButton } from '@/components/platform-v7/premium';
import { TimelineWithImpact } from '@/components/platform-v7/visual/TimelineWithImpact';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { serverApiUrl, serverAuthHeaders } from '@/lib/server-api';
import { AuditLogPanel } from '@/components/platform-v7/AuditLogPanel';
import { RbacMatrix } from '@/components/platform-v7/RbacMatrix';

async function getAuditLog(): Promise<Array<{ id: string; action: string; entityType: string; entityId: string; actorUserId?: string; createdAt: string }>> {
  try {
    const res = await fetch(serverApiUrl('/audit'), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!res.ok) throw new Error(`audit ${res.status}`);
    return res.json();
  } catch {
    return [];
  }
}

const events = [
  {
    id: 'audit-1',
    text: 'СДИЗ по DL-9106 не закрыт',
    impact: '9,65 млн ₽ остаются без банковского основания',
    actor: 'Оператор',
    ts: '09:42',
    tone: 'blocked' as const,
  },
  {
    id: 'audit-2',
    text: 'ЭТрН ожидает подпись грузополучателя',
    impact: 'рейс не может стать основанием для проверки выплаты',
    actor: 'Логистика',
    ts: '10:18',
    tone: 'warn' as const,
  },
  {
    id: 'audit-3',
    text: 'Лаборатория зафиксировала отклонение качества',
    impact: 'создано удержание 624 тыс. ₽ по спору DL-9102',
    actor: 'Лаборатория',
    ts: '11:05',
    tone: 'blocked' as const,
  },
  {
    id: 'audit-4',
    text: 'Акт приёмки по DL-9109 подписан',
    impact: 'открыт путь к передаче основания банку',
    actor: 'Элеватор',
    ts: '12:20',
    tone: 'ok' as const,
  },
];

export default async function PlatformV7AuditLogPage() {
  const liveLog = await getAuditLog();
  const apiOnline = liveLog.length > 0;

  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto', padding: '4px 0 24px' }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        role="ADMIN · Журнал аудита"
        summary={
          apiOnline
            ? `${liveLog.length} записей из БД · последняя: ${liveLog[0] ? new Date(liveLog[0].createdAt).toLocaleTimeString('ru') : '-'}`
            : 'Демонстрационные данные — сервер недоступен'
        }
      />
      <CockpitHero
        eyebrow='Журнал с последствиями'
        title='Что изменилось в сделке и на какие деньги повлияло'
        lead='Журнал показывает не только событие, но и последствие: какая сумма стоит, какой документ стал основанием, кто отвечает и где продолжить действие.'
        aside={<TrustDot state='test' size='sm' label='тестовый контур' />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          <PremiumCtaButton href='/platform-v7/deals/DL-9106/clean' glyph='doc'>Открыть сделку</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/control-tower' variant='ghost'>Центр управления</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/documents' variant='ghost'>Документы</PremiumCtaButton>
        </div>
      </CockpitHero>

      <TimelineWithImpact events={events} />

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Детальный аудит-лог · фильтр по важности</div>
        <AuditLogPanel />
      </section>

      <section style={grid}>
        <Card title='Главный блокер' value='СДИЗ не закрыт' note='Останавливает банковское основание по DL-9106.' danger />
        <Card title='Деньги' value='9,65 млн ₽ стоят' note='Сумма связана с документной причиной остановки.' money />
        <Card title='Ответственный' value='оператор + продавец' note='Следующее действие фиксируется в карточке сделки.' />
        <Card title='Следующий шаг' value='закрыть СДИЗ' note='После действия журнал получит новую запись.' />
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Матрица доступа (RBAC)</div>
          <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', marginTop: 4 }}>Что может делать каждая роль · фильтр по ролям и разделам</div>
        </div>
        <RbacMatrix />
      </section>
    </main>
  );
}

function Card({ title, value, note, danger = false, money = false }: { title: string; value: string; note: string; danger?: boolean; money?: boolean }) {
  return (
    <article style={{ background: '#fff', border: `1px solid ${danger ? 'rgba(220,38,38,0.18)' : money ? 'rgba(37,99,235,0.18)' : 'var(--pc-border, #E4E6EA)'}`, borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
      <div style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</div>
      <strong style={{ color: danger ? '#B91C1C' : money ? '#2563EB' : 'var(--pc-text-primary, #0F1419)', fontSize: 18, lineHeight: 1.2 }}>{value}</strong>
      <p style={{ margin: 0, color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.5 }}>{note}</p>
    </article>
  );
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 26, padding: 20, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: 'var(--pc-text-primary, #0F1419)', fontSize: 'clamp(28px,7vw,44px)', lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: 'var(--pc-text-secondary, #475569)', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: 'var(--pc-text-primary, #0F1419)', fontSize: 14, fontWeight: 850 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 } as const;
