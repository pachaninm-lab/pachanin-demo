import { describe, expect, it } from 'vitest';
import { countPhraseRu, countRu, pluralRu } from '../../lib/format/plural';
import { daysLeftFrom, rebaseFixtureIso } from '../../lib/v7r/fixture-clock';

describe('русское склонение при числительных', () => {
  it('выбирает форму one/few/many по правилу CLDR', () => {
    const forms: [string, string, string] = ['рейс', 'рейса', 'рейсов'];
    expect(pluralRu(1, ...forms)).toBe('рейс');
    expect(pluralRu(2, ...forms)).toBe('рейса');
    expect(pluralRu(5, ...forms)).toBe('рейсов');
    expect(pluralRu(11, ...forms)).toBe('рейсов');
    expect(pluralRu(21, ...forms)).toBe('рейс');
    expect(pluralRu(22, ...forms)).toBe('рейса');
    expect(pluralRu(112, ...forms)).toBe('рейсов');
    expect(pluralRu(0, ...forms)).toBe('рейсов');
  });

  it('склоняет фразу целиком — «2 активных рейса», а не «2 активных рейсов»', () => {
    expect(countPhraseRu(2, 'activeShipments')).toBe('2 активных рейса');
    expect(countPhraseRu(1, 'activeShipments')).toBe('1 активный рейс');
    expect(countPhraseRu(7, 'activeShipments')).toBe('7 активных рейсов');
    expect(countRu(3, 'протокол ожидает', 'протокола ожидают', 'протоколов ожидают')).toBe('3 протокола ожидают');
  });
});

describe('ребейз дат демо-фикстур', () => {
  const fixtureNow = Date.parse('2026-04-17T10:00:00Z');

  it('в момент авторинга даты не сдвигаются', () => {
    expect(rebaseFixtureIso('2026-04-19', fixtureNow)).toBe('2026-04-19');
    expect(rebaseFixtureIso('2026-04-01T09:00:00Z', fixtureNow)).toBe('2026-04-01T09:00:00.000Z');
  });

  it('сдвигает даты целыми сутками, сохраняя время суток и интервалы', () => {
    const later = fixtureNow + 77 * 86_400_000; // +77 дней
    expect(rebaseFixtureIso('2026-04-19', later)).toBe('2026-07-05');
    expect(rebaseFixtureIso('2026-04-01T14:22:00Z', later)).toBe('2026-06-17T14:22:00.000Z');
  });

  it('дедлайн впереди остаётся впереди в любой реальный день', () => {
    const anyDay = Date.parse('2026-07-03T15:00:00Z');
    const rebased = rebaseFixtureIso('2026-04-19', anyDay);
    expect(daysLeftFrom(rebased, anyDay)).toBeGreaterThan(0);
  });

  it('null и мусор проходят насквозь без исключений', () => {
    expect(rebaseFixtureIso(null)).toBeNull();
    expect(rebaseFixtureIso('не дата')).toBe('не дата');
    expect(daysLeftFrom(null)).toBeNull();
  });
});
