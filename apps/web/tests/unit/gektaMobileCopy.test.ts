import { describe, expect, it } from 'vitest';
import { getGektaMobileHeroCopy } from '../../lib/gekta/mobile-copy';

describe('Gekta approved mobile hero copy', () => {
  it('uses the approved compact Russian positioning', () => {
    expect(getGektaMobileHeroCopy('ru')).toEqual({
      eyebrow: 'ГЕКТА · АГРАРНЫЙ ИНТЕЛЛЕКТ',
      h1: 'Гекта — аграрный ИИ для хозяйства и агробизнеса',
      lead: 'Задай вопрос по полю, животным, технике, документам или экономике хозяйства. Гекта удерживает контекст, показывает риски и следующий шаг.',
    });
  });

  it('has complete non-Russian copies without residual Cyrillic', () => {
    for (const locale of ['en', 'zh'] as const) {
      const copy = getGektaMobileHeroCopy(locale);
      expect(copy.eyebrow).toBeTruthy();
      expect(copy.h1).toBeTruthy();
      expect(copy.lead).toBeTruthy();
      expect(`${copy.eyebrow} ${copy.h1} ${copy.lead}`).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
});
