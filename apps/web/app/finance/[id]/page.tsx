import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { FINANCE_ROLES } from '../../../lib/route-roles';
import { SourceNote } from '../../../components/source-note';
import { FinanceApplicationWorkspace } from '../../../components/finance-application-workspace';
import { buildFinanceView, readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function FinanceApplicationDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const view = buildFinanceView(state, params.id);
  const application = view.application;
  const product = view.product;

  if (!application || !product) {
    return (
      <PageFrame title="Финзаявка не найдена" subtitle="Карточка финансирования отсутствует в текущем рабочем контуре.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в финансовый контур и открой актуальную заявку.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/finance" className="primary-link">Финансовый контур</Link>
            <Link href="/payments" className="secondary-link">Платежи</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...FINANCE_ROLES]} title="Карточка финансирования ограничена" subtitle="Карточка finance application нужна финансовым и operator-ролям.">
      <PageFrame title={application.id} subtitle={`${product.title} · ${application.companyName}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/finance', label: 'Финансы' }, { label: application.id }]} />}>
        <SourceNote source="commercial workspace / persisted state" warning="Карточка заявки теперь не только показывает данные, но и позволяет двигать статусы и видеть payment waterfall в одном месте." compact />

        <DetailHero
          kicker="Finance application"
          title={product.title}
          description={`${application.companyName} · ${application.amount.toLocaleString('ru-RU')} ₽ · ${application.disbursementMode}`}
          chips={[application.status, product.decisionTime, product.advanceRate]}
          nextStep={application.nextAction}
          owner={application.owner}
          blockers={application.blocker}
          actions={[
            application.dealId ? { href: `/deals/${application.dealId}`, label: 'Открыть сделку' } : { href: '/deals', label: 'Сделки' },
            { href: '/payments', label: 'Платежи', variant: 'secondary' },
            { href: '/documents', label: 'Документы', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры продукта</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Тип</span><b>{product.type}</b></div>
              <div className="list-row"><span>Для кого</span><b>{product.targetRole}</b></div>
              <div className="list-row"><span>Decision time</span><b>{product.decisionTime}</b></div>
              <div className="list-row"><span>Advance / limit</span><b>{product.advanceRate}</b></div>
              <div className="list-row"><span>Pricing</span><b>{product.pricing}</b></div>
              <div className="list-row"><span>Trigger</span><b>{product.trigger}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Карточка заявки</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Компания</span><b>{application.companyName}</b></div>
              <div className="list-row"><span>Сумма</span><b>{application.amount.toLocaleString('ru-RU')} ₽</b></div>
              <div className="list-row"><span>Requested at</span><b>{application.requestedAt}</b></div>
              <div className="list-row"><span>Target date</span><b>{application.targetDate}</b></div>
              <div className="list-row"><span>Collateral</span><b>{application.collateral}</b></div>
              <div className="list-row"><span>Disbursement</span><b>{application.disbursementMode}</b></div>
            </div>
          </div>
        </div>

        <section className="section-card-tight">
          <div className="section-title">Release gates</div>
          <div className="muted small" style={{ marginTop: 8 }}>Reserve зависит от docs green. Частичная выплата — от queue green + lab green. Финальный release — только после checkout/final receive и отсутствия спора.</div>
          <div className="detail-meta" style={{ marginTop: 12 }}>
            <span className="mini-chip">docs → reserve</span>
            <span className="mini-chip">queue + lab → partial</span>
            <span className="mini-chip">checkout + no dispute → final</span>
          </div>
        </section>

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Готовность</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {application.readiness.map((item) => <span key={item} className="mini-chip">{item}</span>)}
            </div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {application.timeline.map((step) => (
                <div key={step.step} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{step.step}</div>
                    <div className="muted small" style={{ marginTop: 6 }}>{step.detail}</div>
                  </div>
                  <span className="mini-chip">{step.status}</span>
                </div>
              ))}
            </div>
          </div>
          <FinanceApplicationWorkspace applicationId={application.id} initialApplication={application as any} initialWaterfall={view.plan} />
        </div>

        <ModuleHub
          title="Связанные финансовые действия"
          subtitle="Заявка должна продолжаться в сделку, платежи, документы и проверку компании."
          items={[
            application.dealId ? { href: `/deals/${application.dealId}`, label: 'Сделка', detail: 'Проверить blockers, shipment proof и status money.', icon: '≣', meta: application.dealId, tone: 'blue' } : { href: '/deals', label: 'Сделки', detail: 'Открыть сделочный контур.', icon: '≣', meta: 'open', tone: 'blue' },
            { href: '/payments', label: 'Платежи', detail: 'После approval заявка должна перейти в release steps.', icon: '₽', meta: application.status, tone: 'green' },
            { href: '/documents', label: 'Документы', detail: 'Проверить пакет, без которого нельзя выпускать деньги.', icon: '⌁', meta: 'docs', tone: 'amber' },
            { href: `/companies/${application.companyId}`, label: 'Компания', detail: 'Trust, KYB и история контрагента.', icon: '⌘', meta: application.companyName, tone: 'gray' },
            { href: '/knowledge/KB-FINANCE-WATERFALL', label: 'Playbook', detail: 'Как двигать заявку без хаоса и потери контроля.', icon: '≡', meta: 'guide', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title={application.nextAction}
          detail={application.blocker}
          primary={{ href: application.dealId ? `/deals/${application.dealId}` : '/finance', label: application.dealId ? 'Открыть сделку' : 'К finance hub' }}
          secondary={[{ href: '/payments', label: 'Платежи' }, { href: '/documents', label: 'Документы' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
