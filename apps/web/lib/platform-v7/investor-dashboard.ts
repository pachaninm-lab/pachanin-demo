import { platformV7InvestorMetrics, type PlatformV7InvestorMetric } from './investor-metrics';
import { platformV7InvestorStory, type PlatformV7InvestorStoryBlock } from './investor-story';
import { platformV7InvestorRoadmap, platformV7InvestorRoadmapSummary, type PlatformV7InvestorRoadmapItem } from './investor-roadmap';

export interface PlatformV7InvestorDashboardModel {
  title: string;
  subtitle: string;
  disclosure: string;
  metrics: PlatformV7InvestorMetric[];
  story: PlatformV7InvestorStoryBlock[];
  roadmap: PlatformV7InvestorRoadmapItem[];
  roadmapSummary: ReturnType<typeof platformV7InvestorRoadmapSummary>;
  primaryCta: string;
  secondaryCta: string;
}

export function platformV7InvestorDashboardModel(): PlatformV7InvestorDashboardModel {
  return {
    title: 'Прозрачная Цена — контур исполнения зерновой сделки',
    subtitle: 'Investor-mode показывает механику сделки: цена и допуск → логистика → приёмка → документы → деньги → спор и доказательства.',
    disclosure: 'Данные investor-mode являются demo/controlled pilot-гипотезами и не должны трактоваться как production-ready показатели до подтверждения на реальных сделках.',
    metrics: platformV7InvestorMetrics(),
    story: platformV7InvestorStory(),
    roadmap: platformV7InvestorRoadmap(),
    roadmapSummary: platformV7InvestorRoadmapSummary(),
    primaryCta: 'Показать инвестору',
    secondaryCta: 'Открыть демо-сценарий',
  };
}

export function platformV7InvestorDashboardIsHonest(model = platformV7InvestorDashboardModel()): boolean {
  const hasDisclosure = model.disclosure.includes('demo') && model.disclosure.includes('controlled pilot');
  const metricsAreMarked = model.metrics.every((metric) => metric.note.startsWith('ГИПОТЕЗА'));
  const roadmapHasRisks = model.roadmap.every((item) => item.risk.length > 0 && item.evidence.length > 0);
  return hasDisclosure && metricsAreMarked && roadmapHasRisks;
}
