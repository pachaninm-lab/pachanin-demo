import {
  collectPublicOfficialEvidence,
  resetPublicOfficialEvidenceCacheForTests,
} from './public-official-evidence';

const NOW = new Date('2026-07-30T00:30:00.000Z');

describe('public official evidence', () => {
  beforeEach(() => {
    resetPublicOfficialEvidenceCacheForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not fetch changing data for a stable causal price question', async () => {
    const fetchMock = jest.fn();

    const bundle = await collectPublicOfficialEvidence(
      'Что влияет на цену зерна?',
      'ru',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle).toMatchObject({ requested: false, status: 'not_requested', sources: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('collects current Russian agro news with mandatory attribution metadata', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      '<html><body><h1>Новости</h1><article><time>29.07.2026</time><h2>Экспорт зерна вырос</h2><p>Российская Федерация. Официальный обзор рынка АПК.</p></article></body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    ));

    const bundle = await collectPublicOfficialEvidence(
      'Какие последние новости агробизнеса и экспорта зерна?',
      'ru',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle.status).toBe('available');
    expect(bundle.sources).toHaveLength(1);
    expect(bundle.sources[0]).toMatchObject({
      sourceId: 'official.specagro.news',
      title: 'Центр Агроаналитики — новости АПК',
      geography: 'Российская Федерация',
      publishedAt: '2026-07-29T00:00:00.000Z',
      retrievedAt: NOW.toISOString(),
      observationPeriod: { start: null, end: '2026-07-29', precision: 'publication_date' },
    });
    expect(bundle.sources[0].excerpt).toContain('Экспорт зерна вырос');
    expect(bundle.sources[0].contentSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(bundle.sources[0].excerptSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(String((fetchMock.mock.calls[0] as [URL])[0])).toBe('https://specagro.ru/news');
  });

  it('uses the same authority contract for a Chinese weather question', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      '<html><body><h1>ГИДРОМЕТЕОРОЛОГИЧЕСКИЙ БЮЛЛЕТЕНЬ</h1><p>29 июля 2026</p><p>ПРОГНОЗ: в Краснодарском крае сильный дождь и ветер.</p></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));

    const bundle = await collectPublicOfficialEvidence(
      '今天克拉斯诺达尔边疆区的天气预报是什么？',
      'zh',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle.requested).toBe(true);
    expect(bundle.status).toBe('available');
    expect(bundle.sources[0]).toMatchObject({
      sourceId: 'official.meteoinfo.weather-bulletin',
      publishedAt: '2026-07-29T00:00:00.000Z',
    });
    expect(bundle.sources[0].excerpt).toContain('Краснодарском крае');
  });

  it('selects the Bank of Russia for an English current key-rate question', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      '<html><body><h1>Ключевая ставка</h1><p>Дата: 25.07.2026</p><p>Банк России публикует историю решений.</p></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));

    const bundle = await collectPublicOfficialEvidence(
      'What is the current Bank of Russia key rate for agricultural credit?',
      'en',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle.status).toBe('available');
    expect(bundle.sources[0].sourceId).toBe('official.cbr.key-rate');
    expect(bundle.sources[0].topics).toContain('FINANCE_RATES');
  });

  it('fails closed when the official publication is stale', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      '<html><body><h1>ГИДРОМЕТЕОРОЛОГИЧЕСКИЙ БЮЛЛЕТЕНЬ</h1><p>01.07.2026</p><p>Старый прогноз погоды.</p></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));

    const bundle = await collectPublicOfficialEvidence(
      'Какая погода сегодня?',
      'ru',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle).toMatchObject({
      requested: true,
      status: 'unavailable',
      sources: [],
      unavailableSourceIds: ['official.meteoinfo.weather-bulletin'],
    });
  });

  it('rejects redirects outside the fixed HTTPS allowlist', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://evil.example.test/steal' },
    }));

    const bundle = await collectPublicOfficialEvidence(
      'Какие последние новости АПК?',
      'ru',
      { fetchImpl: fetchMock as typeof fetch, now: () => NOW },
    );

    expect(bundle.status).toBe('unavailable');
    expect(bundle.sources).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can be disabled without falling back to model memory', async () => {
    const fetchMock = jest.fn();

    const bundle = await collectPublicOfficialEvidence(
      'Какая текущая ключевая ставка?',
      'ru',
      {
        fetchImpl: fetchMock as typeof fetch,
        now: () => NOW,
        environment: { TAI_PUBLIC_LIVE_OFFICIAL_SOURCES_ENABLED: 'false' },
      },
    );

    expect(bundle.status).toBe('unavailable');
    expect(bundle.unavailableSourceIds).toEqual(['official.cbr.key-rate']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
