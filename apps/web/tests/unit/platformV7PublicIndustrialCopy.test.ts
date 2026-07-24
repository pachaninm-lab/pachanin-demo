import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const copy = readFileSync(join(process.cwd(), 'i18n/platform-v7-home-v3.ts'), 'utf8');

describe('platform-v7 public industrial copy', () => {
  it('presents capabilities without development-stage or maturity messaging', () => {
    const forbidden = [
      'В реализации',
      'Архитектурно предусмотрено',
      'Требует отраслевой настройки',
      'Требует партнёрской интеграции',
      'Техническая готовность',
      'Партнёрская зависимость',
      'Не подтверждено',
      'Честный статус зрелости',
      'массовая эксплуатация ещё не подтверждена',
      'production-покрытие',
      'In implementation',
      'Architecturally supported',
      'Requires sector configuration',
      'Requires partner integration',
      'Technical readiness',
      'Partner-dependent',
      'Not confirmed',
      'Truthful maturity status',
      'mass operation is not yet confirmed',
      '实施中',
      '架构已支持',
      '需要行业配置',
      '需要合作伙伴集成',
      '技术就绪',
      '依赖合作伙伴',
      '未确认',
      '真实成熟度状态',
      '尚未确认大规模运行',
    ];

    for (const phrase of forbidden) expect(copy).not.toContain(phrase);
  });

  it('keeps the industrial value proposition and external-system functions explicit in RU EN ZH', () => {
    expect(copy).toContain('Вся агросделка — от цены до закрытия');
    expect(copy).toContain('Платформа рассчитана на промышленную эксплуатацию');
    expect(copy).toContain('Партия и прослеживаемость');
    expect(copy).toContain('The whole agricultural deal, from price to closure');
    expect(copy).toContain('Built for industrial operation');
    expect(copy).toContain('Lot and traceability');
    expect(copy).toContain('贯通农业交易从定价到关闭的全过程');
    expect(copy).toContain('面向工业化运行设计');
    expect(copy).toContain('批次与追溯');
  });

  it('does not claim verified external connectivity', () => {
    const forbiddenClaims = [
      'банк подключён',
      'ФГИС подключён',
      'ЭДО подключён',
      'bank is connected',
      'FGIS is connected',
      'EDI is connected',
    ];

    for (const claim of forbiddenClaims) expect(copy.toLowerCase()).not.toContain(claim.toLowerCase());
  });
});
