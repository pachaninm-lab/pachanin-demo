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
    expect(copy).toContain('Единая цифровая инфраструктура исполнения агросделки');
    expect(copy).toContain('Промышленные принципы платформы');
    expect(copy).toContain('Прослеживаемость партии');
    expect(copy).toContain('Unified digital infrastructure for agricultural transaction execution');
    expect(copy).toContain('Industrial platform principles');
    expect(copy).toContain('Lot traceability');
    expect(copy).toContain('农业交易执行的一体化数字基础设施');
    expect(copy).toContain('工业级平台原则');
    expect(copy).toContain('批次追溯');
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
