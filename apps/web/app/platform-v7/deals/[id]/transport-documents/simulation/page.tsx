import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { getDealById } from '@/lib/v7r/data';
import {
  getTransportPackByDealId,
  getTransportSimulationScenario,
  moneyImpactLabel,
  transportPackStatusLabel,
  transportReleaseStateLabel,
} from '@/lib/v7r/transport-docs';

function tone(kind: string) {
  if (['allowed', 'release_allowed', 'completed'].includes(kind)) return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (['blocked', 'blocks_release', 'manual_review', 'danger', 'error'].includes(kind)) return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export default function TransportSimulationPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  if (!deal) return notFound();

  const pack = getTransportPackByDealId(deal.id);
  const scenario = getTransportSimulationScenario(deal.id);
  if (!pack || !scenario) return notFound();

  const visibleWebhooks = scenario.webhooks.filter((item) => item.visibleFromStep <= scenario.currentStepIndex + 1);
  const visibleActions = scenario.actions.filter((item) => item.visibleFromStep <= scenario.currentStepIndex + 1);
  const visibleAudit = scenario.audit.filter((item) => item.visibleFromStep <= scenario.currentStepIndex + 1);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Симуляция контура СберКорус · {deal.id}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Полная логическая имитация: как внешний транспортный документный провайдер двигает сделку от пакета документов до банкового решения по выпуску денег.
            </div>
          </div>
          <SberKorusBadge subtitle='Юридически значимый контур перевозочных документов' />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Metric title='Пакет' value={pack.id} note={`Provider pack: ${pack.providerPackId}`} />
          <Metric title='Текущий статус' value={transportPackStatusLabel(pack.status)} note={scenario.headline} />
          <Metric title='Влияние на деньги' value={moneyImpactLabel(pack.moneyImpactStatus)} note='Этот статус платформа докладывает в банковый контур.' />
          <Metric title='Цель сценария' value='Снять transport gate' note={scenario.objective} />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Сценарий по шагам</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {scenario.steps.map((step, index) => {
              const active = index === scenario.currentStepIndex;
              const done = index < scenario.currentStepIndex;
              const palette = done ? tone('allowed') : active ? tone(step.releaseState) : { bg: '#F8FAFB', border: '#E4E6EA', color: '#334155' };
              return (
                <article key={step.id} style={{ border: `1px solid ${palette.border}`, background: palette.bg, borderRadius: 16, padding: 16, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ width: 26, height: 26, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: done ? '#0A7A5F' : active ? palette.color : '#CBD5E1', color: done || active ? '#fff' : '#0F1419', fontSize: 12, fontWeight: 900 }}>{index + 1}</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{step.label}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: active || done ? '#fff' : '#F1F5F9', border: '1px solid rgba(15,20,25,0.08)', color: done ? '#0A7A5F' : active ? palette.color : '#64748B', fontSize: 11, fontWeight: 800 }}>
                      {transportReleaseStateLabel(step.releaseState)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>Владелец шага: <strong style={{ color: '#0F1419' }}>{step.owner}</strong></div>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}><strong style={{ color: '#0F1419' }}>{step.event}.</strong> {step.detail}</div>
                  <div style={{ fontSize: 12, color: active ? palette.color : '#6B778C', fontWeight: 700 }}>Почему это важно для денег: {step.releaseReason}</div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16 }}>
          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Webhook-имитация</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleWebhooks.map((hook) => {
                const palette = tone(hook.status === 'ok' ? 'allowed' : hook.status === 'error' ? 'error' : 'review');
                return (
                  <div key={hook.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{hook.id}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 11, fontWeight: 800 }}>{hook.status === 'ok' ? 'Принят' : hook.status === 'error' ? 'Ошибка' : 'Ожидается'}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{hook.direction === 'outbound' ? 'Исходящий' : 'Входящий'} · {hook.topic}</div>
                    <div style={{ fontSize: 12, color: '#6B778C' }}>{hook.endpoint}</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{hook.summary}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Следующие действия</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleActions.map((action) => (
                <div key={action.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{action.title}</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>Роль: {action.role}</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{action.note}</div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Журнал имитации</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleAudit.map((item) => {
            const palette = tone(item.tone === 'success' ? 'allowed' : item.tone === 'danger' ? 'error' : 'review');
            return (
              <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{item.action}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 11, fontWeight: 800 }}>{new Date(item.ts).toLocaleString('ru-RU')}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{item.actor}</div>
                <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{item.detail}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${deal.id}/transport-documents`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Вернуться к пакету
        </Link>
        <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Открыть банковый контур
        </Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}
