import Link from 'next/link';
import { P7ExecutionMachineReadOnlyStrip } from '@/components/platform-v7/P7ExecutionMachineReadOnlyStrip';
import { P7Grid, P7LinkButton, P7MetricCard, P7Notice, P7PanelShell } from '@/components/platform-v7/P7UiPrimitives';
import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard, type ReleaseGuardBlocker } from '@/lib/platform-v7/domain/release-guard';
import { formatCompactMoney } from '@/lib/v7r/helpers';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
} from '@/lib/platform-v7/routes';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  executionBlockers,
  formatRub,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const ERR = '#B91C1C';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';

const blockerLabels: Record<ReleaseGuardBlocker, string> = {
  NO_RESERVED_MONEY: 'нет подтверждённого резерва',
  NO_RELEASE_AMOUNT: 'нет суммы к выплате',
  OPEN_DISPUTE: 'открыт спор',
  DOCUMENTS_NOT_READY: 'документы не закрыты',
  MANUAL_BLOCKER: 'есть ручная остановка',
  DEAL_NOT_READY: 'стадия сделки не готова к выплате',
};

function gateState(blocked: boolean) {
  return blocked
    ? { label: 'Блокировано', bg: ERR_BG, border: ERR_BORDER, color: ERR }
    : { label: 'Разрешено', bg: BRAND_BG, border: BRAND_BORDER, color: BRAND };
}

function formatBlockers(blockers: readonly ReleaseGuardBlocker[]) {
  return blockers.length ? blockers.map((blocker) => blockerLabels[blocker]).join(', ') : '—';
}

export default function BankReleaseSafetyPage() {
  const rows = canonicalDomainDeals.slice(0, 12).map((deal) => {
    const check = evaluateReleaseGuard(deal);
    return {
      id: deal.id,
      grain: deal.grain,
      reserved: check.reservedAmount,
      hold: deal.money.holdAmount,
      release: check.releaseAmount,
      blockers: check.blockers,
      blocked: !check.canRequestRelease,
    };
  });

  const blockedRows = rows.filter((row) => row.blocked);
  const releaseCandidate = rows.filter((row) => !row.blocked).reduce((sum, row) => sum + row.release, 0);
  const blockedMoney = blockedRows.reduce((sum, row) => sum + Math.max(row.hold, row.release), 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <P7PanelShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Проверка выплаты · тестовый контур</div>
            <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: T }}>Проверка безопасности выпуска денег</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 860 }}>
              Страница показывает, почему выпуск денег не должен обходить спор, документы, ручную остановку и стадию сделки. Это контрольный экран, а не платёжный механизм.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <P7LinkButton href={PLATFORM_V7_BANK_ROUTE}>← Банк</P7LinkButton>
            <P7LinkButton href={PLATFORM_V7_OPERATOR_ROUTE}>Оператор</P7LinkButton>
            <P7LinkButton href={PLATFORM_V7_CONTROL_TOWER_ROUTE}>Центр управления</P7LinkButton>
          </div>
        </div>
      </P7PanelShell>

      <P7Grid min={200} gap={14}>
        <P7MetricCard title='К выплате после проверки' value={formatCompactMoney(releaseCandidate)} tone='green' />
        <P7MetricCard title='Остановлено' value={String(blockedRows.length)} tone={blockedRows.length > 0 ? 'red' : 'green'} />
        <P7MetricCard title='Под риском' value={formatCompactMoney(blockedMoney)} tone={blockedMoney > 0 ? 'red' : 'green'} />
      </P7Grid>

      <P7Notice title='Правило' tone='amber'>
        Деньги нельзя выпускать напрямую из карточки сделки. Выплата допустима только после закрытия условий: резерв, сумма к выплате, документы, отсутствие спора и ручных остановок.
      </P7Notice>

      <P7ExecutionMachineReadOnlyStrip compact />

      <DL9102MoneyCard />

      <P7PanelShell>
        <div style={{ fontSize: 16, fontWeight: 900, color: T, marginBottom: 14 }}>Сделки и условия выплаты</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => {
            const tone = gateState(row.blocked);
            return (
              <div key={row.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <Link href={`/platform-v7/deals/${row.id}`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND, textDecoration: 'none' }}>{row.id}</Link>
                    <span style={{ marginLeft: 8, fontSize: 13, color: M }}>{row.grain}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
                  <Cell label='Резерв' value={formatCompactMoney(row.reserved)} />
                  <Cell label='Удержано' value={formatCompactMoney(row.hold)} danger={row.hold > 0} />
                  <Cell label='К выплате' value={formatCompactMoney(row.release)} />
                  <Cell label='Причины остановки' value={formatBlockers(row.blockers)} danger={row.blockers.length > 0} />
                </div>
              </div>
            );
          })}
        </div>
      </P7PanelShell>
    </div>
  );
}

function DL9102MoneyCard() {
  const { deal, money, readiness } = PLATFORM_V7_EXECUTION_SOURCE;
  const canRelease = canRequestMoneyRelease();
  const blockers = executionBlockers();

  return (
    <section style={{ background: S, border: `1px solid ${BRAND_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Тестовая сделка · {deal.maturity}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>{deal.id} · {deal.lotId}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: M }}>{deal.buyerAlias} · {deal.seller} · {deal.basis}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <div style={{ background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Резерв</div>
          <div style={{ marginTop: 5, fontSize: 16, fontWeight: 900, color: T }}>{formatRub(money.reservedRub)}</div>
        </div>
        <div style={{ background: money.holdRub > 0 ? ERR_BG : BRAND_BG, border: `1px solid ${money.holdRub > 0 ? ERR_BORDER : BRAND_BORDER}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Удержано</div>
          <div style={{ marginTop: 5, fontSize: 16, fontWeight: 900, color: money.holdRub > 0 ? ERR : T }}>{formatRub(money.holdRub)}</div>
        </div>
        <div style={{ background: canRelease ? BRAND_BG : WARN_BG, border: `1px solid ${canRelease ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Кандидат к выплате</div>
          <div style={{ marginTop: 5, fontSize: 16, fontWeight: 900, color: canRelease ? BRAND : WARN }}>{formatRub(money.releaseCandidateRub)}</div>
        </div>
        <div style={{ background: canRelease ? BRAND_BG : ERR_BG, border: `1px solid ${canRelease ? BRAND_BORDER : ERR_BORDER}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Решение банка</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: canRelease ? BRAND : ERR }}>{canRelease ? 'можно выпускать' : 'нельзя выпускать'}</div>
        </div>
      </div>

      <div style={{ background: canRelease ? BRAND_BG : WARN_BG, border: `1px solid ${canRelease ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, color: canRelease ? BRAND : WARN, fontWeight: 900 }}>
          {canRelease ? 'Все условия выплаты пройдены, удержаний нет' : `Причины блокировки: ${blockers.join(' · ')}`}
        </div>
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 6 }}>
          {(['bank', 'documents', 'logistics', 'dispute'] as const).map((key) => (
            <span key={key} style={{ fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 999, background: readiness[key].status === 'готово' ? 'rgba(10,122,95,0.1)' : 'rgba(217,119,6,0.1)', color: readiness[key].status === 'готово' ? BRAND : WARN }}>
              {key === 'bank' ? 'Банк' : key === 'documents' ? 'Документы' : key === 'logistics' ? 'Логистика' : 'Спор'}: {readiness[key].status}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: danger ? ERR : T, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
