import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES, EXECUTIVE_ROLES } from '../../lib/route-roles';

const auditEvents = [
  { id: 'AUD-001', actor: 'operator', event: 'document.signed', object: 'DOC-001', linkedHref: '/documents/DOC-001', timestamp: '2026-04-03 10:12' },
  { id: 'AUD-002', actor: 'system', event: 'payment.hold', object: 'PAY-001', linkedHref: '/payments/PAY-001', timestamp: '2026-04-03 10:40' },
  { id: 'AUD-003', actor: 'lab', event: 'quality.final', object: 'LAB-001', linkedHref: '/lab/LAB-001', timestamp: '2026-04-03 11:05' },
];

export default function AuditPage() {
  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...EXECUTIVE_ROLES]} title="Audit rail ограничен" subtitle="Аудит нужен internal и executive-ролям как доказательный и provenance-контур.">
      <PageFrame title="Audit" subtitle="Журнал событий, provenance, history and linked evidence trace." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Audit' }]} />}>
        <SourceNote source="embedded audit registry" warning="Audit rail не должен быть просто логом. Из него должен быть прямой вход в связанный объект, где событие реально влияет на execution truth." compact />

        <DetailHero
          kicker="Audit registry"
          title="Журнал событий и provenance"
          description="События должны вести дальше в документы, платежи, quality и dispute rails, а не оставаться отдельной лентой."
          chips={[`events ${auditEvents.length}`, 'provenance', 'evidence trail']}
          nextStep="Открыть событие, проверить linked object и подтвердить влияние на execution rail."
          owner="audit / provenance"
          blockers="audit rail не должен быть тупиком без перехода в связанный объект"
          actions={[
            { href: '/documents', label: 'Documents' },
            { href: '/payments', label: 'Payments', variant: 'secondary' },
            { href: '/support', label: 'Support', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">События</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {auditEvents.map((event) => (
              <Link key={event.id} href={`/audit/${event.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{event.event}</div>
                  <div className="muted small">{event.actor} · {event.object} · {event.timestamp}</div>
                </div>
                <span className="mini-chip">Открыть</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из audit списка оператор должен уходить в linked object rail, а не просто читать лог событий."
          items={[
            { href: '/documents', label: 'Documents', detail: 'Подтвердить документный trail и подписи.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/payments', label: 'Payments', detail: 'Проверить hold / release / callback history.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/lab', label: 'Lab', detail: 'Проверить quality trail и влияние на settlement.', icon: '∴', meta: 'quality', tone: 'amber' },
            { href: '/support', label: 'Support', detail: 'Если событие спорное — открыть support/dispute continuation.', icon: '!', meta: 'support', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть событие и связанный объект"
          detail="Следующий шаг — не смотреть лог, а пройти в rail, где событие реально меняет состояние сделки."
          primary={{ href: '/audit/AUD-001', label: 'Открыть событие' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/payments', label: 'Payments' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
