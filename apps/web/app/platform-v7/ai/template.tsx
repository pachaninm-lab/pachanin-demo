import Link from 'next/link';
import type * as React from 'react';

export default function PlatformV7DealAssistantTemplate(_props: { readonly children: React.ReactNode }) {
  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Помощник по сделке</div>
        <h1 style={h1}>Следующий шаг без потери контроля</h1>
        <p style={lead}>Экран помогает понять, что сейчас держит сделку: документы, рейс, приёмка, качество, удержание, спор или банковская проверка. Это подсказка в тестовом контуре, а не внешнее подтверждение.</p>
      </section>

      <section style={card}>
        <div style={micro}>Как читать сделку</div>
        <div style={grid3}>
          <Step title='Где деньги' text='Проверить резерв, удержание, спорную часть и причину остановки.' />
          <Step title='Где документы' text='Проверить обязательный пакет, ответственного и что документ блокирует.' />
          <Step title='Где исполнение' text='Проверить рейс, приёмку, вес, лабораторию и доказательства.' />
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Открыть дальше</div>
        <div style={grid3}>
          <Action href='/platform-v7/control-tower' title='Центр управления' text='Очередь, ответственные, причины остановки.' />
          <Action href='/platform-v7/deals/grain-release' title='Деньги и удержания' text='Проверка условий перед запросом в банк.' />
          <Action href='/platform-v7/disputes' title='Споры и доказательства' text='Пакет доказательств, сумма влияния и решение.' />
        </div>
      </section>
    </main>
  );
}

function Step({ title, text }: { readonly title: string; readonly text: string }) {
  return <div style={tile}><strong style={tileTitle}>{title}</strong><p style={tileText}>{text}</p></div>;
}

function Action({ href, title, text }: { readonly href: string; readonly title: string; readonly text: string }) {
  return <Link href={href} style={actionCard}><strong style={tileTitle}>{title}</strong><span style={tileText}>{text}</span></Link>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 12 } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 } as const;
const tile = { background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 } as const;
const actionCard = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 } as const;
const tileTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.25, fontWeight: 900 } as const;
const tileText = { margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.5 } as const;
