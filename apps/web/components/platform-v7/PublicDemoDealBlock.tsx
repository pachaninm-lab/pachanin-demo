import { Building2, FileCheck2, FlaskConical, Landmark, Truck, Wheat, type LucideIcon } from 'lucide-react';

type Stage = {
  title: string;
  owner: string;
  status: string;
  text: string;
  Icon: LucideIcon;
  active?: boolean;
};

const stages: Stage[] = [
  { title: 'Условия', owner: 'Стороны сделки', status: 'выполнено', text: 'Цена, объём и базис поставки согласованы.', Icon: Wheat },
  { title: 'Рейс', owner: 'Логистика', status: 'выполнено', text: 'Назначены маршрут, транспорт и водитель.', Icon: Truck },
  { title: 'Приёмка', owner: 'Элеватор', status: 'выполнено', text: 'Фиксируются вес и факт поставки.', Icon: Building2 },
  { title: 'Качество', owner: 'Лаборатория', status: 'на проверке', text: 'Ожидается подтверждение показателей качества.', Icon: FlaskConical, active: true },
  { title: 'Документы', owner: 'Стороны сделки', status: 'ожидает', text: 'Комплект документов должен соответствовать событиям сделки.', Icon: FileCheck2 },
  { title: 'Расчёт', owner: 'Банк', status: 'ожидает', text: 'Основание для оплаты формируется после проверки.', Icon: Landmark },
];

export function PublicDemoDealBlock() {
  return (
    <section id='demo-deal' className='entry-demo-section' aria-labelledby='entry-demo-title'>
      <style>{css}</style>
      <div className='entry-demo-head'>
        <span>Демонстрационный режим</span>
        <h2 id='entry-demo-title'>Пример сделки: что должно быть подтверждено до расчёта</h2>
        <p>Демонстрационный блок встроен в главный экран. Он показывает одну условную сделку и её текущий статус без открытия рабочих кабинетов.</p>
      </div>
      <div className='entry-demo-board'>
        <aside className='entry-demo-summary' aria-label='Параметры демонстрационной сделки'>
          <span>DL-DEMO-001</span>
          <h3>Пшеница 4 класс · 240 т</h3>
          <dl>
            <div><dt>Сумма сделки</dt><dd>2 964 000 ₽</dd></div>
            <div><dt>Маршрут</dt><dd>Хозяйство → элеватор → покупатель</dd></div>
            <div><dt>Текущий статус</dt><dd>ожидается подтверждение качества и документов</dd></div>
          </dl>
        </aside>
        <div className='entry-demo-stages'>
          {stages.map((stage, index) => <DemoStageTile key={stage.title} stage={stage} index={index} />)}
        </div>
      </div>
    </section>
  );
}

function DemoStageTile({ stage, index }: { stage: Stage; index: number }) {
  const Icon = stage.Icon;
  return (
    <article className={stage.active ? 'entry-demo-stage active' : 'entry-demo-stage'}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <Icon size={21} />
      <strong>{stage.title}</strong>
      <p>{stage.text}</p>
      <small>{stage.owner} · {stage.status}</small>
    </article>
  );
}

const css = `
.entry-demo-section{margin:18px clamp(18px,4vw,56px);padding:clamp(22px,3vw,34px);border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.86);box-shadow:0 18px 48px rgba(7,22,17,.065)}
.entry-demo-head span{display:inline-flex;width:fit-content;margin-bottom:12px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}
.entry-demo-head h2{margin:0;font-size:clamp(26px,3.1vw,44px);line-height:1.05;letter-spacing:-.045em}
.entry-demo-head p{margin:12px 0 0;max-width:820px;color:#5c6962;font-size:15.5px;line-height:1.45;font-weight:650}
.entry-demo-board{display:grid;grid-template-columns:minmax(280px,.36fr) minmax(0,.64fr);gap:16px;margin-top:20px}
.entry-demo-summary{padding:20px;border-radius:24px;background:#071611;color:#fff;display:grid;align-content:start;gap:14px}
.entry-demo-summary>span{width:fit-content;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:#a9d9bd;font-size:11px;font-weight:950;letter-spacing:.07em}
.entry-demo-summary h3{margin:0;font-size:28px;line-height:1.05;letter-spacing:-.045em}
.entry-demo-summary dl{display:grid;gap:10px;margin:0}
.entry-demo-summary div{padding:12px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.entry-demo-summary dt{font-size:11px;font-weight:950;color:#a9d9bd;text-transform:uppercase;letter-spacing:.06em}
.entry-demo-summary dd{margin:5px 0 0;font-size:14px;font-weight:850;color:#fff}
.entry-demo-stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.entry-demo-stage{min-height:174px;padding:16px;border-radius:22px;border:1px solid rgba(7,22,17,.08);background:#fff;display:grid;gap:8px;align-content:start}
.entry-demo-stage span{color:#087a3b;font-size:12px;font-weight:950}.entry-demo-stage svg{color:#087a3b}.entry-demo-stage strong{font-size:16px;font-weight:950;letter-spacing:-.03em}
.entry-demo-stage p{margin:0;color:#5d6862;font-size:12.5px;line-height:1.35;font-weight:650}.entry-demo-stage small{margin-top:auto;color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.045em}
.entry-demo-stage.active{border-color:rgba(0,122,47,.28);box-shadow:0 18px 36px rgba(0,122,47,.12)}
@media(max-width:980px){.entry-demo-section{margin:14px;padding:20px;border-radius:26px}.entry-demo-board{grid-template-columns:1fr}.entry-demo-stages{grid-template-columns:1fr}.entry-demo-head h2{font-size:clamp(27px,8vw,36px)}}
@media(max-width:420px){.entry-demo-section{margin-left:0;margin-right:0}.entry-demo-summary h3{font-size:24px}}
`;
