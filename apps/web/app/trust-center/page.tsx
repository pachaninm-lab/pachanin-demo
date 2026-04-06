import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES, EXECUTIVE_ROLES } from '../../lib/route-roles';

type TrustRecord = {
  orgId: string; orgName: string; kyc: string; kyb: string;
  sanctionCheck: string; reputationScore: number; tier: string;
  signerAuthority: boolean; restrictions: string[];
};

const TRUST_DATA: TrustRecord[] = [
  { orgId: 'org-farmer-1', orgName: 'АО Агро-Тамбов', kyc: 'VERIFIED', kyb: 'VERIFIED', sanctionCheck: 'CLEAR', reputationScore: 87, tier: 'A', signerAuthority: true, restrictions: [] },
  { orgId: 'org-farmer-2', orgName: 'ООО Зернопром', kyc: 'VERIFIED', kyb: 'PENDING', sanctionCheck: 'CLEAR', reputationScore: 72, tier: 'B', signerAuthority: true, restrictions: ['Лимит сделки 5 М₽'] },
  { orgId: 'org-buyer-1', orgName: 'ТД Зерноград', kyc: 'VERIFIED', kyb: 'VERIFIED', sanctionCheck: 'CLEAR', reputationScore: 91, tier: 'A+', signerAuthority: true, restrictions: [] },
  { orgId: 'org-buyer-2', orgName: 'ООО АгроТрейд', kyc: 'VERIFIED', kyb: 'IN_REVIEW', sanctionCheck: 'CLEAR', reputationScore: 58, tier: 'C', signerAuthority: false, restrictions: ['KYB проверка не завершена', 'Подпись недействительна'] },
];

const STATUS_COLOR: Record<string, string> = {
  VERIFIED: 'green', CLEAR: 'green', PENDING: 'amber', IN_REVIEW: 'amber', FAILED: 'red', BLOCKED: 'red',
};

export default function TrustCenterPage() {
  const blocked = TRUST_DATA.filter((r) => r.restrictions.length > 0 || r.kyb === 'IN_REVIEW' || r.kyb === 'PENDING');

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...EXECUTIVE_ROLES]}
      title="Trust Center ограничен"
      subtitle="KYC/KYB данные и trust-параметры доступны только внутренним ролям.">
      <AppShell title="Trust Center" subtitle="Допуск, reputation, KYC/KYB, signer authority, sanctions and restrictions">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Trust Center' }]} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Всего организаций', value: TRUST_DATA.length },
              { label: 'Полностью верифицированы', value: TRUST_DATA.filter((r) => r.kyc === 'VERIFIED' && r.kyb === 'VERIFIED').length },
              { label: 'Требуют внимания', value: blocked.length },
              { label: 'Без полномочий подписи', value: TRUST_DATA.filter((r) => !r.signerAuthority).length },
            ].map((s) => (
              <div key={s.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{s.value}</div>
                <div className="muted small">{s.label}</div>
              </div>
            ))}
          </div>

          {blocked.length > 0 && (
            <div className="soft-box" style={{ borderLeft: '3px solid var(--color-amber, #f59e0b)', background: 'var(--color-amber-soft, #fef3c7)' }}>
              <div style={{ fontWeight: 700 }}>⚠ {blocked.length} организации требуют проверки</div>
              <div className="muted small" style={{ marginTop: 4 }}>Незавершённый KYB блокирует крупные сделки и подпись документов.</div>
            </div>
          )}

          <div className="section-stack">
            {TRUST_DATA.map((r) => (
              <div key={r.orgId} className="soft-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.orgName}</div>
                    <div className="muted tiny">{r.orgId}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`mini-chip ${STATUS_COLOR[r.kyc] || 'gray'}`}>KYC: {r.kyc}</span>
                    <span className={`mini-chip ${STATUS_COLOR[r.kyb] || 'gray'}`}>KYB: {r.kyb}</span>
                    <span className={`mini-chip ${STATUS_COLOR[r.sanctionCheck] || 'gray'}`}>Санкции: {r.sanctionCheck}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div>
                    <span className="muted small">Рейтинг: </span>
                    <b>{r.reputationScore}/100 ({r.tier})</b>
                  </div>
                  <div>
                    <span className="muted small">Подпись: </span>
                    <span className={`mini-chip ${r.signerAuthority ? 'green' : 'red'}`}>
                      {r.signerAuthority ? 'Действительна' : 'Недействительна'}
                    </span>
                  </div>
                </div>
                {r.restrictions.length > 0 && (
                  <div>
                    {r.restrictions.map((res, i) => (
                      <div key={i} className="muted small" style={{ color: 'var(--color-red, #ef4444)' }}>⚠ {res}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/companies" className="mini-chip">Компании →</Link>
            <Link href="/operator-cockpit" className="mini-chip">Кокпит оператора</Link>
            <Link href="/reputation-control" className="mini-chip">Репутация</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
