import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';

export default function PlatformV7RootPage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <QuietIntelligenceHint
        problem='3 стоп-блокера держат 15,89 млн ₽ · СДИЗ, ЭТрН, акт расхождения.'
        action='Откройте Deal 360 или кабинет ответственной роли чтобы устранить блокер.'
        outcome='После закрытия всех блокеров деньги продолжат движение к выплате.'
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <TrustDot state='test' size='sm' label='Тестовый контур · Реальные интеграции требуют договоров' />
      </div>
      <SmartSectionSummary
        label='Платформа · сводка'
        items={[
          { text: 'DL-9106 · СДИЗ не подтверждён, ЭТрН ждёт подписи · 9,65 млн ₽ заблокировано', tone: 'block' },
          { text: 'DL-9102 · Удержание 624 тыс. ₽ · спорная часть по весу', tone: 'warn' },
        ]}
      />
      <PlatformCommandCenterHub />
    </div>
  );
}
