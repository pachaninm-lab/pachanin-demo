import Link from 'next/link';

type MobileDealActionLensProps = {
  dealId: string;
  lotId: string;
  money: string;
  blocker: string;
  owner: string;
  primaryAction: string;
  primaryHref: string;
  docs: string;
  trip: string;
  quality: string;
  dispute: string;
};

export function MobileDealActionLens(props: MobileDealActionLensProps) {
  return (
    <section className='p7-mobile-action-lens' data-testid='p7-mobile-deal-action-lens'>
      <style>{`
        .p7-mobile-action-lens{display:none}
        @media(max-width:767px){
          .p7-mobile-action-lens{display:grid;gap:12px;margin:0 0 14px}
          .p7-mobile-action-lens__hero{position:relative;overflow:hidden;border:1px solid rgba(10,122,95,.18);border-radius:28px;background:radial-gradient(circle at 14% 0%,rgba(10,122,95,.16),transparent 34%),linear-gradient(135deg,#ffffff 0%,#f6fbf8 62%,#eef8f3 100%);box-shadow:0 18px 44px rgba(15,23,42,.09);padding:18px;display:grid;gap:15px}
          .p7-mobile-action-lens__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
          .p7-mobile-action-lens__eyebrow{font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.08em;color:#0a7a5f;font-weight:950}
          .p7-mobile-action-lens__title{margin:7px 0 0;color:#0f1419;font-size:31px;line-height:1.02;letter-spacing:-.055em;font-weight:950}
          .p7-mobile-action-lens__badge{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border-radius:999px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.16);color:#b91c1c;font-size:11px;font-weight:950;white-space:nowrap}
          .p7-mobile-action-lens__money{border:1px solid rgba(37,99,235,.16);border-radius:22px;background:rgba(255,255,255,.86);padding:14px;display:grid;gap:5px}
          .p7-mobile-action-lens__money-label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#64748b}
          .p7-mobile-action-lens__money-value{font-size:34px;line-height:1;font-weight:950;color:#0f1419;letter-spacing:-.045em}
          .p7-mobile-action-lens__cause{font-size:14px;line-height:1.45;color:#334155;font-weight:850}
          .p7-mobile-action-lens__owner{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .p7-mobile-action-lens__fact{border:1px solid #e4e6ea;border-radius:16px;background:#fff;padding:11px;display:grid;gap:5px}
          .p7-mobile-action-lens__fact-label{font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#64748b}
          .p7-mobile-action-lens__fact-value{font-size:13px;line-height:1.3;font-weight:950;color:#0f1419}
          .p7-mobile-action-lens__cta{min-height:58px;border-radius:18px;background:#007a5f;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 16px;font-size:16px;line-height:1.25;font-weight:950;box-shadow:0 16px 32px rgba(0,122,95,.22)}
          .p7-mobile-action-lens__micro{margin:0;color:#64748b;font-size:12px;line-height:1.4;text-align:center}
          .p7-mobile-action-lens__chips{display:flex;gap:8px;overflow-x:auto;padding:0 1px 2px;scrollbar-width:none}
          .p7-mobile-action-lens__chips::-webkit-scrollbar{display:none}
          .p7-mobile-action-lens__chip{flex:0 0 auto;min-height:52px;border:1px solid #e4e6ea;border-radius:999px;background:#fff;padding:8px 14px;display:grid;gap:2px;align-content:center;box-shadow:0 8px 20px rgba(15,23,42,.04)}
          .p7-mobile-action-lens__chip-label{font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#64748b}
          .p7-mobile-action-lens__chip-value{font-size:13px;font-weight:950;color:#0f1419;white-space:nowrap}
          .p7-mobile-action-lens__details{border:1px solid #e4e6ea;border-radius:20px;background:#fff;overflow:hidden}
          .p7-mobile-action-lens__summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;font-size:14px;font-weight:950;color:#0f1419;cursor:pointer}
          .p7-mobile-action-lens__summary::-webkit-details-marker{display:none}
          .p7-mobile-action-lens__detail-grid{display:grid;gap:8px;padding:0 16px 16px}
          .p7-mobile-action-lens__detail-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #eef2f7;padding-top:9px;font-size:13px;line-height:1.35;color:#475569}
          .p7-mobile-action-lens__detail-row strong{color:#0f1419;text-align:right}
        }
      `}</style>

      <div className='p7-mobile-action-lens__hero'>
        <div className='p7-mobile-action-lens__top'>
          <div>
            <div className='p7-mobile-action-lens__eyebrow'>Action Lens</div>
            <h1 className='p7-mobile-action-lens__title'>Что закрыть сейчас</h1>
          </div>
          <span className='p7-mobile-action-lens__badge'>стоп денег</span>
        </div>

        <div className='p7-mobile-action-lens__money'>
          <div className='p7-mobile-action-lens__money-label'>{props.dealId} · {props.lotId}</div>
          <div className='p7-mobile-action-lens__money-value'>{props.money}</div>
          <div className='p7-mobile-action-lens__cause'>{props.blocker}</div>
        </div>

        <div className='p7-mobile-action-lens__owner'>
          <div className='p7-mobile-action-lens__fact'>
            <div className='p7-mobile-action-lens__fact-label'>Ответственный</div>
            <div className='p7-mobile-action-lens__fact-value'>{props.owner}</div>
          </div>
          <div className='p7-mobile-action-lens__fact'>
            <div className='p7-mobile-action-lens__fact-label'>После действия</div>
            <div className='p7-mobile-action-lens__fact-value'>запись в журнал</div>
          </div>
        </div>

        <Link href={props.primaryHref} className='p7-mobile-action-lens__cta'>{props.primaryAction}</Link>
        <p className='p7-mobile-action-lens__micro'>Детали скрыты ниже, чтобы первый экран не перегружал оператора.</p>
      </div>

      <div className='p7-mobile-action-lens__chips' aria-label='Короткое состояние сделки'>
        <Chip label='Документы' value={props.docs} />
        <Chip label='Рейс' value={props.trip} />
        <Chip label='Качество' value={props.quality} />
        <Chip label='Спор' value={props.dispute} />
      </div>

      <details className='p7-mobile-action-lens__details'>
        <summary className='p7-mobile-action-lens__summary'>Почему деньги стоят <span>↓</span></summary>
        <div className='p7-mobile-action-lens__detail-grid'>
          <Row label='Причина' value={props.blocker} />
          <Row label='Ответственный' value={props.owner} />
          <Row label='Действие' value={props.primaryAction} />
        </div>
      </details>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return <div className='p7-mobile-action-lens__chip'><span className='p7-mobile-action-lens__chip-label'>{label}</span><strong className='p7-mobile-action-lens__chip-value'>{value}</strong></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className='p7-mobile-action-lens__detail-row'><span>{label}</span><strong>{value}</strong></div>;
}
