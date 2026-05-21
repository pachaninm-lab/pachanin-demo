import {
  canBankConfirmBasis,
  canDealPassComplianceForReserve,
  selectBankReviewCase,
  selectComplianceProfiles,
} from '@/lib/platform-v7/bank-compliance-pilot';
import { formatRub } from '@/lib/platform-v7/deal-execution-source-of-truth';

export function BankCompliancePilotPanel({ mode }: { readonly mode: 'bank' | 'compliance' }) {
  const reviewCase = selectBankReviewCase('DL-9106');
  const profiles = selectComplianceProfiles('DL-9106');

  if (!reviewCase) return null;

  if (mode === 'compliance') {
    return (
      <section style={panel}>
        <div style={micro}>Комплаенс · 115-ФЗ · 152-ФЗ · КЭП/МЧД</div>
        <h2 style={h2}>Допуск участников к резерву и выплате</h2>
        <div style={notice}>
          Резерв и банковое основание не продолжаются, пока участник находится на manual review без решения.
        </div>
        <div style={grid}>
          {profiles.map((profile) => (
            <article key={profile.counterpartyId} style={card}>
              <div style={rowHead}>
                <div>
                  <div style={idText}>{profile.role} · {profile.counterpartyId}</div>
                  <h3 style={h3}>{profile.companyName}</h3>
                </div>
                <Pill tone={profile.admissionStatus === 'admitted' ? 'good' : profile.admissionStatus === 'stopped' ? 'bad' : 'warn'}>{profile.admissionStatus}</Pill>
              </div>
              <div style={facts}>
                <Fact label='ИНН' value={profile.inn} />
                <Fact label='ОГРН/ОГРНИП' value={profile.ogrn} />
                <Fact label='ЕГРЮЛ/ЕГРИП' value={profile.egrulStatus} />
                <Fact label='Директор' value={profile.director} />
                <Fact label='Представитель' value={profile.representative} />
                <Fact label='Бенефициар' value={profile.beneficialOwner} />
                <Fact label='Выгодоприобретатель' value={profile.beneficiary} />
                <Fact label='Полномочия' value={profile.authorityStatus} />
                <Fact label='МЧД' value={profile.mchdStatus} />
                <Fact label='КЭП' value={profile.kepStatus} />
                <Fact label='ПДн' value={profile.pdnBasis} />
                <Fact label='Риски' value={`налоговый ${profile.taxRisk}; санкционный ${profile.sanctionsRisk}; bank-risk ${profile.bankRisk}`} />
              </div>
              {profile.stopReason ? <div style={stop}>{profile.stopReason}</div> : null}
            </article>
          ))}
        </div>
        <div style={summaryLine}>
          Допуск к резерву: {canDealPassComplianceForReserve('DL-9106') ? 'разрешён' : 'остановлен до решения комплаенса'}.
        </div>
      </section>
    );
  }

  return (
    <section style={panel}>
      <div style={micro}>Банк · KYB · 115-ФЗ · reconciliation</div>
      <h2 style={h2}>Основание для денег</h2>
      <div style={grid}>
        <article style={card}>
          <div style={idText}>DL-9106</div>
          <h3 style={h3}>{formatRub(reviewCase.money.reserveAmount)}</h3>
          <div style={facts}>
            <Fact label='Резерв' value={formatRub(reviewCase.money.reserveAmount)} />
            <Fact label='На ручной проверке' value={formatRub(reviewCase.money.manualReviewAmount)} />
            <Fact label='К подтверждению банка' value={formatRub(reviewCase.money.readyToReleaseAmount)} />
            <Fact label='Подтверждено банком' value={formatRub(reviewCase.money.releasedAmount)} />
            <Fact label='Формула' value={reviewCase.money.calculationFormula} />
            <Fact label='Reconciliation' value={reviewCase.money.reconciliationStatus} />
          </div>
        </article>
        <article style={card}>
          <div style={idText}>115-ФЗ</div>
          <h3 style={h3}>Идентификация сторон</h3>
          <div style={facts}>
            {reviewCase.fz115Identifications.map((item) => (
              <Fact key={item.subject} label={item.subject} value={`${item.name} · ${item.identifier} · ${item.status}`} />
            ))}
            <Fact label='Выгодоприобретатель' value={reviewCase.beneficiary} />
            <Fact label='Бенефициарный владелец' value={reviewCase.beneficialOwner} />
          </div>
        </article>
      </div>
      <div style={grid}>
        <FactCard label='KYB' value={reviewCase.kybStatus} />
        <FactCard label='Банковое основание' value={reviewCase.basisStatus} />
        <FactCard label='Partial release' value={reviewCase.partialReleaseStatus} />
        <FactCard label='Bank callback' value={reviewCase.manualCallbackStatus} />
      </div>
      <div style={notice}>
        Банк видит статус основания и сверки, а не сообщение о движении денег. Статус: основание не готово, требуется ручное подтверждение банка или внешний callback после закрытия блокеров.
      </div>
      <div style={list}>
        {reviewCase.blockers.slice(0, 6).map((blocker) => (
          <div key={blocker} style={stop}>{blocker}</div>
        ))}
      </div>
      <div style={summaryLine}>
        Можно подтвердить основание: {canBankConfirmBasis(reviewCase) ? 'да' : 'нет'} · следующий шаг: {reviewCase.nextAction}.
      </div>
    </section>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={fact}>
      <div style={factLabel}>{label}</div>
      <div style={factValue}>{value}</div>
    </div>
  );
}

function FactCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={factCard}>
      <div style={factLabel}>{label}</div>
      <div style={factValue}>{value}</div>
    </div>
  );
}

function Pill({ tone, children }: { readonly tone: 'good' | 'warn' | 'bad'; readonly children: string }) {
  const color = tone === 'good' ? '#0A7A5F' : tone === 'bad' ? '#B91C1C' : '#B45309';
  const border = tone === 'good' ? 'rgba(10,122,95,0.18)' : tone === 'bad' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)';
  return <span style={{ ...pill, color, borderColor: border }}>{children}</span>;
}

const panel = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 12, boxShadow: '0 10px 22px rgba(15,23,42,0.045)' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 } as const;
const card = { background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 10 } as const;
const facts = { display: 'grid', gap: 7 } as const;
const list = { display: 'grid', gap: 7 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' } as const;
const micro = { color: '#0A7A5F', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 22, lineHeight: 1.15, fontWeight: 950 } as const;
const h3 = { margin: '4px 0 0', color: '#0F1419', fontSize: 18, lineHeight: 1.2, fontWeight: 950 } as const;
const idText = { color: '#2563EB', fontSize: 12, fontWeight: 950 } as const;
const fact = { display: 'grid', gap: 3, border: '1px solid #E4E6EA', borderRadius: 10, padding: 9, background: '#F8FAFB' } as const;
const factCard = { display: 'grid', gap: 4, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#FFFFFF' } as const;
const factLabel = { color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const factValue = { color: '#0F1419', fontSize: 12, lineHeight: 1.4, fontWeight: 800 } as const;
const notice = { border: '1px solid rgba(217,119,6,0.18)', background: 'rgba(217,119,6,0.07)', borderRadius: 12, padding: 12, color: '#0F1419', fontSize: 13, lineHeight: 1.5, fontWeight: 800 } as const;
const stop = { border: '1px solid rgba(220,38,38,0.16)', background: 'rgba(220,38,38,0.06)', borderRadius: 10, padding: 10, color: '#7F1D1D', fontSize: 12, lineHeight: 1.45, fontWeight: 800 } as const;
const summaryLine = { color: '#0F1419', fontSize: 13, lineHeight: 1.5, fontWeight: 900 } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '6px 9px', borderRadius: 999, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 11, fontWeight: 950 } as const;
