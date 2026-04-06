import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { ModuleHub } from '../../../../components/module-hub';
import { NextStepBar } from '../../../../components/next-step-bar';
import { SourceNote } from '../../../../components/source-note';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';

const beneficiaryMap: Record<string, any> = {
  DEMO: {
    id: 'BEN-001',
    name: 'ООО Агроцентр',
    status: 'VERIFIED',
    accountStatus: 'READY',
    linkedDealId: 'DEAL-001',
    linkedPaymentId: 'PAY-001',
    nextAction: 'Проверить beneficiary readiness перед release и bank callback',
    blockers: ['beneficiary rail не должен жить отдельно от payments / documents', 'без KYB readiness деньги не должны идти дальше']
  }
};

export default function SberBeneficiaryDetailPage({ params }: { params: { id: string } }) {
  const beneficiary = beneficiaryMap[params.id] || beneficiaryMap.DEMO;

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Beneficiary rail ограничен" subtitle="Бенефициары доступны только finance / bank / operator ролям.">
      <PageFrame title={`Beneficiary ${beneficiary.id}`} subtitle="Деталь бенефициара: KYB, account readiness and linked payment/deal path." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: beneficiary.id }]} />}>
        <SourceNote source="embedded sber beneficiary detail" warning="Beneficiary rail нужен не как справочник реквизитов. Он должен объяснять, готов ли получатель к money release и куда идти дальше в payments / documents / deal rail." compact />

        <DetailHero
          kicker="Beneficiary rail"
          title={beneficiary.name}
          description={`${beneficiary.status} · account ${beneficiary.accountStatus}`}
          chips={[beneficiary.status, beneficiary.accountStatus, beneficiary.linkedDealId]}
          nextStep={beneficiary.nextAction}
          owner="finance / bank / operator"
          blockers={beneficiary.blockers.join(' · ')}
          actions={[
            { href: '/sber', label: 'Назад в Sber' },
            { href: `/payments/${beneficiary.linkedPaymentId}`, label: 'Открыть payment', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры бенефициара</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Name</span><b>{beneficiary.name}</b></div>
              <div className="list-row"><span>KYB</span><b>{beneficiary.status}</b></div>
              <div className="list-row"><span>Account</span><b>{beneficiary.accountStatus}</b></div>
              <div className="list-row"><span>Deal</span><b>{beneficiary.linkedDealId}</b></div>
              <div className="list-row"><span>Payment</span><b>{beneficiary.linkedPaymentId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Payments — release / hold decision</div>
              <div className="soft-box">Documents — legal basis и beneficiary readiness</div>
              <div className="soft-box">Deal rail — linked execution continuation</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После beneficiary detail пользователь должен уходить туда, где реально решается выпуск денег."
          items={[
            { href: `/payments/${beneficiary.linkedPaymentId}`, label: 'Payments', detail: 'Проверить release / hold и beneficiary readiness.', icon: '₽', meta: beneficiary.linkedPaymentId, tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal пакет и bank readiness.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: `/deals/${beneficiary.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: beneficiary.linkedDealId, tone: 'amber' },
            { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Проверить callback sequence по beneficiary path.', icon: '↗', meta: 'events', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, где решается beneficiary readiness"
          detail={beneficiary.nextAction}
          primary={{ href: `/payments/${beneficiary.linkedPaymentId}`, label: 'Открыть payments' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: `/deals/${beneficiary.linkedDealId}`, label: 'Deal rail' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
