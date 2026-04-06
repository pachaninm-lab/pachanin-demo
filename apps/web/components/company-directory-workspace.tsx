'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Company = {
  id: string;
  name: string;
  segment: string;
  region: string;
  verification?: string;
  financeReadiness?: string;
  paymentDiscipline?: string;
  value?: string;
  focus?: string[];
  lastSignal?: string;
};

type Lead = {
  id: string;
  companyId?: string;
  companyName: string;
  status: string;
  entryPoint: string;
  owner?: string;
  nextAction?: string;
};

export function CompanyDirectoryWorkspace({
  initialCompanies,
  initialLeads
}: {
  initialCompanies: Company[];
  initialLeads: Lead[];
}) {
  const [segment, setSegment] = useState('');
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');

  const segments = useMemo(() => Array.from(new Set(initialCompanies.map((item) => item.segment))).sort(), [initialCompanies]);
  const regions = useMemo(() => Array.from(new Set(initialCompanies.map((item) => item.region))).sort(), [initialCompanies]);

  const companies = useMemo(() => {
    let data = [...initialCompanies];
    if (segment) data = data.filter((item) => item.segment === segment);
    if (region) data = data.filter((item) => item.region === region);
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter((item) => `${item.name} ${item.value || ''} ${(item.focus || []).join(' ')}`.toLowerCase().includes(q));
    }
    return data;
  }, [initialCompanies, segment, region, query]);

  return (
    <div className="section-stack">
      <section className="section-card-tight">
        <div className="section-title">Фильтры каталога</div>
        <div className="mobile-two-grid" style={{ marginTop: 12 }}>
          <label className="field-block">
            <span>Сегмент</span>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="">Все сегменты</option>
              {segments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-block">
            <span>Регион</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Все регионы</option>
              {regions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-block" style={{ gridColumn: '1 / -1' }}>
            <span>Поиск</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Компания, value, focus" />
          </label>
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Активные входы в работу</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {initialLeads.map((lead) => (
            <div key={lead.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{lead.companyName}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{lead.entryPoint}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>owner {lead.owner || '—'} · next {lead.nextAction || '—'}</div>
              </div>
              <span className="mini-chip">{lead.status}</span>
            </div>
          ))}
          {!initialLeads.length ? <div className="muted small">Активных входов пока нет.</div> : null}
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Компании</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {companies.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`} className="list-row linkable" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{company.name}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{company.segment} · {company.region}</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>
                  verification {company.verification || '—'} · finance {company.financeReadiness || '—'} · payment {company.paymentDiscipline || '—'}
                </div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{company.lastSignal || company.value || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mini-chip">{company.financeReadiness || '—'}</div>
              </div>
            </Link>
          ))}
          {!companies.length ? <div className="muted small">Под фильтры компании не найдены.</div> : null}
        </div>
      </section>
    </div>
  );
}
