import { describe, expect, it } from 'vitest';
import { WORK_LINKS } from '@/components/platform-v7/WorkRouteNav';

const allowedLabels = ['Центр', 'Сделки', 'Лоты/RFQ', 'Рейсы', 'Деньги', 'Документы', 'Споры'];
const allowedNotes = ['блокеры', 'исполнение', 'запросы', 'груз', 'банк', 'основания', 'удержания'];
const forbiddenLabels = ['Партии', 'Предложения', 'Подключения', 'Поддержка'];

describe('platform-v7 compact work nav copy', () => {
  it('keeps only the high-signal execution sections in the work nav', () => {
    expect(WORK_LINKS.map((item) => item.label)).toEqual(allowedLabels);
  });

  it('keeps operational notes short and tied to execution logic', () => {
    expect(WORK_LINKS.map((item) => item.note)).toEqual(allowedNotes);
  });

  it('does not bring lower-priority modules back into the above-cockpit work nav', () => {
    const labels = WORK_LINKS.map((item) => item.label);

    for (const label of forbiddenLabels) {
      expect(labels).not.toContain(label);
    }
  });
});
