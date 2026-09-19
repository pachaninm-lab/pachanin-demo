'use client';

import Link from 'next/link';

type CompanyProfile = {
  id: string;
  name: string;
  segment?: string;
  verification?: string;
  financeReadiness?: string;
  paymentDiscipline?: string;
  value?: string;
  focus?: string[];
  lastSignal?: string;
};

type CompanyLead = {
  id: string;
  status?: string;
  entryPoint?: string;
  owner?: string;
  nextAction?: string;
};

export function CompanyProfileWorkspace({
  company,
  leads = [],
}: {
  company: CompanyProfile;
  leads?: CompanyLead[];
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Company profile workspace</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Карточка контрагента должна переводить в RFQ, price request, finance и dispatch без отдельного ручного поиска.
          </div>
        </div>
        <span className="mini-chip blue">{company.segment || 'company'}</span>
      </div>

      <div className="workspace-grid" style={{ marginTop: 16 }}>
        <div className="soft-box">
          <div className="text-sm font-semibold">{company.name}</div>
          <div className="muted small" style={{ marginTop: 8 }}>{company.value || 'Контрагент в рабочем контуре.'}</div>
          <div className="section-stack" style={{ marginTop: 12 }}>
            <div className="list-row"><span>Verification</span><b>{company.verification || '—'}</b></div>
            <div className="list-row"><span>Finance readiness</span><b>{company.financeReadiness || '—'}</b></div>
            <div className="list-row"><span>Payment discipline</span><b>{company.paymentDiscipline || '—'}</b></div>
          </div>
        </div>

        <div className="soft-box">
          <div className="text-sm font-semibold">Следующие действия</div>
          <div className="cta-stack" style={{ marginTop: 12 }}>
            <Link href="/purchase-requests" className="primary-link">Открыть RFQ</Link>
            <Link href="/market-center" className="secondary-link">Проверить цены</Link>
            <Link href="/finance" className="secondary-link">Перейти в финконтур</Link>
            <Link href="/dispatch" className="secondary-link">Открыть dispatch</Link>
          </div>
        </div>
      </div>

      <div className="section-stack" style={{ marginTop: 16 }}>
        <div className="text-sm font-semibold">Открытые интересы</div>
        {leads.length ? leads.map((lead) => (
          <div key={lead.id} className="list-row">
            <div>
              <div style={{ fontWeight: 700 }}>{lead.entryPoint || 'entry'}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{lead.nextAction || 'Нужен следующий шаг'}</div>
            </div>
            <span className="mini-chip amber">{lead.status || 'OPEN'}</span>
          </div>
        )) : <div className="muted small">Открытых интересов пока нет.</div>}
      </div>
    </section>
  );
}
