'use client';

export default function LogisticsPage(){
 return (
  <div style={{display:'grid',gap:16}}>
    <h1 style={{fontSize:22,fontWeight:800}}>Логистика</h1>
    <div style={{fontSize:13,color:'#6B778C'}}>Активные рейсы и контроль доставки</div>
    <div style={{background:'#fff',border:'1px solid #E4E6EA',borderRadius:16,padding:16}}>
      ТМБ-14 · В пути · ETA 14:28
    </div>
    <div style={{background:'#fff',border:'1px solid #E4E6EA',borderRadius:16,padding:16}}>
      ВРЖ-08 · Прибыл · Ожидает приёмку
    </div>
  </div>
 );
}
