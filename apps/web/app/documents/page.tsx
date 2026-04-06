import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';

const docs = [
  { id: 'DOC-001', title: 'Договор поставки', type: 'CONTRACT', status: 'SIGNED', source: 'edo', linkedDealId: 'DEAL-001' },
  { id: 'DOC-002', title: 'Весовой билет', type: 'WEIGH_TICKET', status: 'PENDING', source: 'weighbridge', linkedDealId: 'DEAL-002' },
  { id: 'DOC-003', title: 'Лабораторный протокол', type: 'LAB_PROTOCOL', status: 'READY', source: 'lab', linkedDealId: 'DEAL-001' },
];

export default function DocumentsPage() {
  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Реестр документов ограничен" subtitle="Документный контур доступен только участникам сделки, бухгалтерии и оператору.">
      <PageFrame title="Документы" subtitle="Пакет документов сделки: upload, signing, completeness and linked execution handoff." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Документы' }]} />}>
        <SourceNote source="embedded document registry" warning="Реестр документов нужен не как папка файлов. Из него должен быть прямой вход в deal, payments, receiving и dispute rails." compact />

        <DetailHero
          kicker="Document registry"
          title="Документный контур исполнения"
          description="Каждый документ должен вести дальше: в сделку, деньги, приёмку и доказательный контур, а не оставаться отдельным файлом."
          chips={[`docs ${docs.length}`, 'completeness', 'evidence rail']}
          nextStep="Открыть проблемный документ и провести handoff в связанный рабочий rail."
          owner="document / operator"
          blockers={docs.some((item) => item.status !== 'SIGNED' && item.type === 'CONTRACT') ? 'есть документные blockers для release/execution' : 'критичных документных blockers не видно'}
          actions={[
            { href: '/deals', label: 'Сделки' },
            { href: '/payments', label: 'Платежи', variant: 'secondary' },
            { href: '/receiving', label: 'Приёмка', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Документы</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {docs.map((doc) => (
              <Link key={doc.id} href={`/documents/${doc.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{doc.title}</div>
                  <div className="muted small">{doc.id} · {doc.type} · source {doc.source}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">{doc.status}</div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>{doc.linkedDealId}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из document registry пользователь должен уходить в deal, payments, receiving и dispute rails."
          items={[
            { href: '/deals', label: 'Deal rail', detail: 'Проверить owner и blocker по связанному execution rail.', icon: '≣', meta: 'deals', tone: 'blue' },
            { href: '/payments', label: 'Payments', detail: 'Документы должны влиять на hold / release и callback path.', icon: '₽', meta: 'money', tone: 'green' },
            { href: '/receiving', label: 'Receiving', detail: 'Акты, весовые и quality proof должны быть встроены в приёмку.', icon: '◫', meta: 'receiving', tone: 'amber' },
            { href: '/disputes', label: 'Disputes', detail: 'Если документ спорный — переход в claim rail без ручного поиска.', icon: '!', meta: 'claims', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть документ и связанный объект"
          detail="Следующий шаг — зайти в документ и проверить, как он влияет на основной контур сделки."
          primary={{ href: '/documents/DOC-001', label: 'Открыть документ' }}
          secondary={[{ href: '/deals', label: 'Deals' }, { href: '/payments', label: 'Payments' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
