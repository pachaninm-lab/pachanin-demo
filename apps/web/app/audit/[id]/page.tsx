import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES, EXECUTIVE_ROLES } from '../../../lib/route-roles';

const auditMap: Record<string, any> = {
  'AUD-001': { actor: 'operator', event: 'document.signed', object: 'DOC-001', linkedHref: '/documents/DOC-001', linkedLabel: 'Документ', timestamp: '2026-04-03 10:12', reason: 'Подпись перевела document rail в юридически пригодный статус.' },
  'AUD-002': { actor: 'system', event: 'payment.hold', object: 'PAY-001', linkedHref: '/payments/PAY-001', linkedLabel: 'Платёж', timestamp: '2026-04-03 10:40', reason: 'Callback / mismatch удержал release до разборки.' },
  'AUD-003': { actor: 'lab', event: 'quality.final', object: 'LAB-001', linkedHref: '/lab/LAB-001', linkedLabel: 'Лаборатория', timestamp: '2026-04-03 11:05', reason: 'Финальный quality truth повлиял на settlement rail.' },
};

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  const item = auditMap[params.id];

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...EXECUTIVE_ROLES]} title="Карточка audit-события ограничена" subtitle="Деталь audit нужна internal и executive-ролям как evidence/provenance rail.">
      <PageFrame title={`Audit ${params.id}`} subtitle="Деталь аудита: actor, event, object, timestamp and linked evidence." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/audit', label: 'Audit' }, { label: params.id }]} />}>
        {!item ? (
          <div className="section-card">
            <div className="section-title">Событие не найдено</div>
            <div className="muted" style={{ marginTop: 8 }}>Вернись в audit rail и открой актуальную запись provenance.</div>
            <div className="cta-stack" style={{ marginTop: 16 }}>
              <Link href="/audit" className="primary-link">Audit rail</Link>
              <Link href="/documents" className="secondary-link">Documents</Link>
            </div>
          </div>
        ) : (
          <>
            <SourceNote source="embedded audit detail" warning="Карточка audit-события нужна не для чтения лога, а для перехода в linked object rail, где событие реально влияет на execution truth." compact />
            <DetailHero
              kicker="Audit event"
              title={item.event}
              description={`${item.actor} · ${item.object} · ${item.timestamp}`}
              chips={['provenance', 'linked object', 'evidence']}
              nextStep="Открыть связанный объект и проверить, как событие изменило execution rail."
              owner="audit / provenance"
              blockers="audit detail не должен быть тупиком без перехода в linked object"
              actions={[
                { href: '/audit', label: 'Назад в audit' },
                { href: item.linkedHref, label: `Открыть ${item.linkedLabel}`, variant: 'secondary' }
              ]}
            />

            <div className="mobile-two-grid">
              <div className="section-card-tight">
                <div className="section-title">Что произошло</div>
                <div className="section-stack" style={{ marginTop: 12 }}>
                  <div className="list-row"><span>Actor</span><b>{item.actor}</b></div>
                  <div className="list-row"><span>Event</span><b>{item.event}</b></div>
                  <div className="list-row"><span>Object</span><b>{item.object}</b></div>
                  <div className="list-row"><span>Timestamp</span><b>{item.timestamp}</b></div>
                </div>
              </div>
              <div className="section-card-tight">
                <div className="section-title">Почему это важно</div>
                <div className="muted small" style={{ marginTop: 12 }}>{item.reason}</div>
              </div>
            </div>

            <ModuleHub
              title="Следующий rail"
              subtitle="После просмотра audit detail пользователь должен идти в объект, где событие реально работает."
              items={[
                { href: item.linkedHref, label: item.linkedLabel, detail: 'Открыть связанный объект и проверить состояние после события.', icon: '→', meta: item.object, tone: 'blue' },
                { href: '/audit', label: 'Audit rail', detail: 'Вернуться в provenance и открыть соседние события.', icon: '≣', meta: 'history', tone: 'gray' }
              ]}
            />

            <NextStepBar
              title="Открыть связанный объект"
              detail="Следующий шаг — пройти в linked object rail и проверить влияние события на основной контур."
              primary={{ href: item.linkedHref, label: `Открыть ${item.linkedLabel}` }}
              secondary={[{ href: '/audit', label: 'Audit rail' }]}
            />
          </>
        )}
      </PageFrame>
    </PageAccessGuard>
  );
}
