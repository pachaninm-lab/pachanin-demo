import type { Metadata } from 'next';
import Link from 'next/link';
import { supportCategoryLabel, supportCreateDefaults, supportEntityLabel, supportPriorityLabel, supportRoleLabel } from '@/lib/platform-v7/support-center';

export const metadata: Metadata = {
  title: 'Новое обращение',
  description: 'Создание обращения по сделке, документу, рейсу, деньгам или спору.',
};

export default function PlatformV7SupportNewPage() {
  return (
    <main style={page}>
      <section style={hero}>
        <span style={micro}>создание обращения</span>
        <h1 style={h1}>Новая проблема по сделке</h1>
        <p style={lead}>Выберите объект, укажите блокер и следующий ожидаемый шаг. На этом этапе обращение фиксируется в интерфейсе как controlled-pilot support contour, без внешнего helpdesk и без обещания автоматического решения.</p>
      </section>
      <section style={panel}>
        <div style={formGrid}>
          <Field label='Категория' options={supportCreateDefaults.categories.map((item) => supportCategoryLabel[item])} />
          <Field label='Роль заявителя' options={supportCreateDefaults.requesterRoles.map((item) => supportRoleLabel[item])} />
          <Field label='Объект' options={supportCreateDefaults.relatedEntities.map((item) => supportEntityLabel[item])} />
          <Field label='Приоритет' options={Object.values(supportPriorityLabel)} />
          <TextBox label='ID сделки / рейса / документа' value='DL-9106' />
          <TextBox label='Что заблокировано' value='СДИЗ не оформлен' />
          <TextBox label='Деньги под влиянием' value='18 420 000 ₽' />
          <TextBox label='Следующий шаг' value='Назначить ответственного и закрыть документ' />
        </div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={label}>Описание</span>
          <textarea defaultValue='Опишите, что произошло, где это видно и какой документ/рейс/деньги затронуты.' style={textarea} />
        </label>
        <div style={hint}>AI может предложить категорию, приоритет и краткое описание, но не меняет статус сделки, не выпускает деньги и не закрывает спор.</div>
        <div style={actions}>
          <Link href='/platform-v7/support/SUP-2406-001' style={primary}>Создать обращение</Link>
          <Link href='/platform-v7/support' style={secondary}>Отмена</Link>
        </div>
      </section>
    </main>
  );
}

function Field({ label, options }: { label: string; options: string[] }) {
  return <label style={field}><span style={labelStyle}>{label}</span><select style={input}>{options.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function TextBox({ label, value }: { label: string; value: string }) {
  return <label style={field}><span style={labelStyle}>{label}</span><input defaultValue={value} style={input} /></label>;
}

const page = { display: 'grid', gap: 14, maxWidth: 1120, margin: '0 auto', paddingBottom: 28 } as const;
const hero = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12, boxShadow: 'var(--pc-shadow-sm)' } as const;
const panel = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55, maxWidth: 820 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 850, letterSpacing: '0.04em' } as const;
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 } as const;
const field = { display: 'grid', gap: 6 } as const;
const labelStyle = { color: '#334155', fontSize: 12, fontWeight: 850 } as const;
const label = { color: '#334155', fontSize: 12, fontWeight: 850 } as const;
const input = { minHeight: 42, borderRadius: 12, border: '1px solid #E4E6EA', padding: '9px 11px', fontSize: 14, color: '#0F1419', background: '#fff' } as const;
const textarea = { minHeight: 118, borderRadius: 14, border: '1px solid #E4E6EA', padding: 12, color: '#0F1419', fontSize: 14, lineHeight: 1.5 } as const;
const hint = { border: '1px solid rgba(37,99,235,0.16)', background: 'rgba(37,99,235,0.06)', color: '#1D4ED8', borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, fontWeight: 750 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12, padding: '10px 14px', background: '#0F172A', border: '1px solid #0F172A', color: '#fff', fontSize: 13, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA' } as const;
