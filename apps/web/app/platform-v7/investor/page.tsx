'use client';

export default function InvestorPage() {
  return (
    <div style={{display:'grid',gap:20}}>
      <h1 style={{fontSize:22,fontWeight:800}}>Кабинет инвестора</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
        <Metric label="Оборот" value="118 млн ₽" />
        <Metric label="Сделок" value="31" />
        <Metric label="Средний чек" value="4.2 млн ₽" />
        <Metric label="Спорность" value="8%" />
      </div>
    </div>
  );
}

function Metric({label,value}:{label:string,value:string}){
 return <div style={{background:'#fff',border:'1px solid #E4E6EA',borderRadius:14,padding:14}}>
   <div style={{fontSize:11,color:'#6B778C'}}>{label}</div>
   <div style={{fontSize:22,fontWeight:800}}>{value}</div>
 </div>
}
