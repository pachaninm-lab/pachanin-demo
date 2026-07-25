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

  it('keeps the execution proposition and external-system functions explicit in RU EN ZH', () => {
    expect(copy).toContain('Платформа не заканчивается после выбора цены');
    expect(copy).toContain('Критические действия имеют проверяемое основание');
    expect(copy).toContain('Партия и прослеживаемость');
    expect(copy).toContain('Подписание и обмен документами');

    expect(copy).toContain('The platform does not stop after price selection');
    expect(copy).toContain('Critical actions require verifiable evidence');
    expect(copy).toContain('Lot identity and traceability');
    expect(copy).toContain('Document signing and exchange');

    expect(copy).toContain('平台不会在确定价格后结束');
    expect(copy).toContain('关键操作必须具有可核验依据');
    expect(copy).toContain('批次与追溯');
    expect(copy).toContain('签署与文件交换');
  });

  it('keeps money, evidence and role control inside one Deal narrative', () => {
    expect(copy).toContain('Выплата опирается на подтверждённые события');
    expect(copy).toContain('История доказательств');
    expect(copy).toContain('Каждый участник видит свой контекст и доступные ему действия');
    expect(copy).toContain('Payout follows confirmed events');
    expect(copy).toContain('Evidence history');
    expect(copy).toContain('付款依据已确认事件');
    expect(copy).toContain('证据历史');
  });

  it('does not claim verified external connectivity', () => {
    const forbiddenClaims = [
      'банк подключён',
      'ФГИС подключён',
      'ЭДО подключён',
      'bank is connected',
      'FGIS is connected',
      'EDI is connected',
      '银行已连接',
      '监管系统已连接',
    ];

    for (const claim of forbiddenClaims) expect(copy.toLowerCase()).not.toContain(claim.toLowerCase());
  });
});
