import Link from 'next/link';

export function MobileDealFocus(props: {
  dealId: string;
  lotId: string;
  amount: string;
  reason: string;
  owner: string;
  href: string;
  action: string;
  docs: string;
  trip: string;
  quality: string;
  dispute: string;
}) {
  return (
    <section className='p7-mobile-focus' data-testid='p7-mobile-deal-focus'>
      <style>{`
        .p7-mobile-focus{display:none}
        @media(max-width:767px){
          .p7-mobile-focus{display:grid;gap:10px;margin:0 0 12px}
          .p7-mobile-focus__card{border:1px solid rgba(10,122,95,.16);border-radius:26px;background:linear-gradient(135deg,#fff,#f7fbf9 62%,#eef8f3);box-shadow:0 16px 38px rgba(15,23,42,.08);padding:17px;display:grid;gap:12px}
          .p7-mobile-focus__top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
          .p7-mobile-focus__kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#0a7a5f;font-weight:950}
          .p7-mobile-focus__title{margin:6px 0 0;color:#0f1419;font-size:28px;line-height:1.03;letter-spacing:-.05em;font-weight:950}
          .p7-mobile-focus__badge{min-height:30px;border-radius:999px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.16);color:#b91c1c;padding:0 10px;display:inline-flex;align-items:center;font-size:11px;font-weight:950;white-space:nowrap}
          .p7-mobile-focus__amount{border:1px solid rgba(37,99,235,.16);border-radius:20px;background:rgba(255,255,255,.9);padding:13px;display:grid;gap:5px}
          .p7-mobile-focus__label{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:900}
          .p7-mobile-focus__money{font-size:32px;line-height:1;font-weight:950;color:#0f1419;letter-spacing:-.045em}
          .p7-mobile-focus__reason{font-size:14px;line-height:1.38;color:#334155;font-weight:850;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .p7-mobile-focus__facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .p7-mobile-focus__fact{border:1px solid #e4e6ea;border-radius:15px;background:#fff;padding:10px;display:grid;gap:4px;min-width:0}
          .p7-mobile-focus__fact strong{font-size:13px;line-height:1.25;color:#0f1419;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .p7-mobile-focus__cta{min-height:54px;border-radius:18px;background:#007a5f;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 16px;font-size:16px;font-weight:950;box-shadow:0 14px 28px rgba(0,122,95,.2)}
          .p7-mobile-focus__micro{margin:0;color:#64748b;font-size:12px;line-height:1.35;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .p7-mobile-focus__chips{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .p7-mobile-focus__chip{border:1px solid #e4e6ea;border-radius:15px;background:#fff;padding:10px;display:grid;gap:3px;min-width:0;box-shadow:0 8px 18px rgba(15,23,42,.035)}
          .p7-mobile-focus__chip strong{font-size:13px;color:#0f1419;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .p7-mobile-focus__details{border:1px solid #e4e6ea;border-radius:18px;background:#fff;overflow:hidden}
          .p7-mobile-focus__summary{list-style:none;padding:14px 15px;font-size:14px;font-weight:950;color:#0f1419;display:flex;justify-content:space-between;cursor:pointer}
          .p7-mobile-focus__summary::-webkit-details-marker{display:none}
          .p7-mobile-focus__body{padding:0 15px 15px;color:#475569;font-size:13px;line-height:1.45}
        }
      `}</style>
      <div className='p7-mobile-focus__card'>
        <div className='p7-mobile-focus__top'><div><div className='p7-mobile-focus__kicker'>{props.dealId} · {props.lotId}</div><h1 className='p7-mobile-focus__title'>Один шаг сейчас</h1></div><span className='p7-mobile-focus__badge'>стоп</span></div>
        <div className='p7-mobile-focus__amount'><div className='p7-mobile-focus__label'>сумма под влиянием</div><div className='p7-mobile-focus__money'>{props.amount}</div><div className='p7-mobile-focus__reason'>{props.reason}</div></div>
        <div className='p7-mobile-focus__facts'><div className='p7-mobile-focus__fact'><span className='p7-mobile-focus__label'>Кто закрывает</span><strong>{props.owner}</strong></div><div className='p7-mobile-focus__fact'><span className='p7-mobile-focus__label'>После</span><strong>журнал + проверка</strong></div></div>
        <Link href={props.href} className='p7-mobile-focus__cta'>Открыть действие</Link>
        <p className='p7-mobile-focus__micro'>{props.action}</p>
      </div>
      <div className='p7-mobile-focus__chips'><Chip label='Документы' value={props.docs}/><Chip label='Рейс' value={props.trip}/><Chip label='Качество' value={props.quality}/><Chip label='Спор' value={props.dispute}/></div>
      <details className='p7-mobile-focus__details'><summary className='p7-mobile-focus__summary'>Почему остановлено <span>↓</span></summary><div className='p7-mobile-focus__body'>{props.reason}</div></details>
    </section>
  );
}
function Chip({label,value}:{label:string;value:string}){return <div className='p7-mobile-focus__chip'><span className='p7-mobile-focus__label'>{label}</span><strong>{value}</strong></div>}
