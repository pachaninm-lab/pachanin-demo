import { platformV7DemoTourDurationMs, platformV7DemoTourSteps, type PlatformV7DemoTourStep } from './demo-tour';
import { PLATFORM_V7_DEMO_TOUR_INITIAL_STATE, platformV7DemoTourView, type PlatformV7DemoTourRuntimeView } from './demo-tour-runtime';

export interface PlatformV7DemoDashboardModel {
  title: string;
  subtitle: string;
  disclosure: string;
  durationMs: number;
  steps: PlatformV7DemoTourStep[];
  initialView: PlatformV7DemoTourRuntimeView;
  controls: string[];
}

export function platformV7DemoDashboardModel(): PlatformV7DemoDashboardModel {
  return {
    title: 'Маршрут исполнения сделки',
    subtitle: 'Показ за 2–3 минуты: лот → RFQ → логистика → приёмка → качество → деньги.',
    disclosure: 'Маршрут показывает механику исполнения и не является подтверждением внешних подключений без договоров, доступов и проверки на реальных сделках.',
    durationMs: platformV7DemoTourDurationMs(),
    steps: platformV7DemoTourSteps(),
    initialView: platformV7DemoTourView(PLATFORM_V7_DEMO_TOUR_INITIAL_STATE),
    controls: ['Старт', 'Пауза', 'Назад', 'Вперёд', 'Перейти к шагу'],
  };
}

export function platformV7DemoDashboardIsReady(model = platformV7DemoDashboardModel()): boolean {
  return (
    model.durationMs >= 120000 &&
    model.durationMs <= 180000 &&
    model.steps.length === 5 &&
    model.controls.includes('Пауза') &&
    model.disclosure.includes('внешних подключений')
  );
}
