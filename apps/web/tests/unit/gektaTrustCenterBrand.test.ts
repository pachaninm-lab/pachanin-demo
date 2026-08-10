import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const trust = readFileSync(resolve(process.cwd(), 'app/trust/page.tsx'), 'utf8');
const platformTrust = readFileSync(resolve(process.cwd(), 'app/platform-v7/trust/page.tsx'), 'utf8');
const publicTrustSources = `${trust}\n${platformTrust}`;

describe('Gekta Trust Center brand contract', () => {
  it('uses the canonical Gekta identity in RU, EN and ZH', () => {
    expect(trust).toContain("metadataDescription: 'Публичные правила полномочий, доказательств, обработки данных, доступности и использования Гекты");
    expect(trust).toContain("nav: { controls: 'Контроль', data: 'Данные', ai: 'Гекта'");
    expect(trust).toContain("title: 'Граница использования Гекты'");
    expect(trust).toContain("title: 'Gekta usage boundary'");
    expect(trust).toContain("title: 'Gekta 使用边界'");
    expect(platformTrust).toContain('использования Гекты в платформе Прозрачная Цена');
    expect(platformTrust).toContain('availability and Gekta boundaries');
    expect(platformTrust).toContain('可用性与 Gekta 边界');
  });

  it('does not expose the retired TAI product identity', () => {
    expect(publicTrustSources).not.toMatch(/\bTAI\b/u);
    expect(publicTrustSources).not.toContain('Transparent Agro Intelligence');
    expect(publicTrustSources).not.toContain('Гекто');
    expect(publicTrustSources).not.toContain('Gekto');
    expect(publicTrustSources).not.toContain('Hekta');
    expect(publicTrustSources).not.toContain('Gecta');
  });

  it('preserves human authority and fail-closed product boundaries', () => {
    expect(trust).toContain('Критические решения подтверждает уполномоченный участник.');
    expect(trust).toContain('У Гекты нет самостоятельного права менять Сделку, переводить деньги или подтверждать критическое действие.');
    expect(trust).toContain('Gekta has no independent authority to change a Deal, move money or confirm a critical action.');
    expect(trust).toContain('Gekta 无权独立修改交易、转移资金或确认关键操作。');
    expect(trust).toContain('Публичные страницы не открывают данные частного кабинета или чужих организаций.');
  });

  it('preserves evidence requirements for certifications and external integrations', () => {
    expect(trust).toContain('Сертификаты, внешняя доступность и подключение конкретного провайдера не заявляются без отдельного доказательства.');
    expect(trust).toContain('Подключение конкретного банка, государственного сервиса, ЭДО или LIMS — без подтверждённого production-обмена.');
    expect(trust).toContain('A live bank, government, EDI or LIMS connection without confirmed production exchange.');
    expect(trust).toContain('没有确认的生产交换时，不声明银行、政府、电子文件或 LIMS 已上线连接。');
  });

  it('removes the obsolete runtime copy transformer', () => {
    expect(platformTrust).not.toContain('clarifyTaiAuthority');
    expect(platformTrust).not.toContain('cloneElement');
    expect(platformTrust).toContain('const page = await BaseTrustCenterPage();');
  });
});
