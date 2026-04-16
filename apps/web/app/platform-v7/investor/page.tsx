import Link from 'next/link';

export default function InvestorPage() {
  return (
    <div style={{display:'grid',gap:20}}>
      <h1 style={{fontSize:28,fontWeight:800}}>Инвесторский режим</h1>
      <p style={{color:'#6B778C'}}>Демонстрация полного контура сделки в усиленном виде.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <Link href="/platform-v7/investor/deals/DL-9103" style={{padding:12,border:'1px solid #E4E6EA',borderRadius:10}}>Открыть сделку (пример)</Link>
        <Link href="/platform-v7/lots" style={{padding:12,border:'1px solid #E4E6EA',borderRadius:10}}>Лоты</Link>
      </div>
    </div>
  );
}
