import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ASVS 5.0 V15.3.2 (исходящие запросы не следуют за редиректом),
 * V4.1.4 (явный список HTTP-методов) и V13.4.6 (подробности сборки не
 * отдаются анонимно).
 *
 * Проверки текстовые по исходникам, и это осознанно: предмет требований —
 * конфигурация вызова, а не результат работы функции. Тест, поднимающий
 * настоящий редирект, проверял бы поведение fetch, а не то, что каждый вызов в
 * этом репозитории настроен правильно.
 */

const REPO = join(__dirname, '..', '..', '..', '..', '..');

function tracked(pattern: string): string[] {
  return execFileSync('git', ['ls-files', pattern], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => !/\.spec\.[a-z]+$/u.test(file));
}

function read(file: string): string {
  return readFileSync(join(REPO, file), 'utf8');
}

describe('V15.3.2: исходящий запрос не идёт за редиректом молча', () => {
  const sites: Array<{ file: string; line: number; window: string }> = [];

  beforeAll(() => {
    for (const file of tracked('apps/api/src/**/*.ts')) {
      const lines = read(file).split('\n');
      lines.forEach((line, index) => {
        if (!/\bawait fetch\(/u.test(line)) return;
        sites.push({
          file,
          line: index + 1,
          window: lines.slice(index, index + 25).join('\n').split('});')[0],
        });
      });
    }
  });

  it('находит все вызовы, иначе проверка ничего не значит', () => {
    expect(sites.length).toBeGreaterThanOrEqual(12);
  });

  it('каждый вызов задаёт redirect: error', () => {
    const unguarded = sites
      .filter((site) => !/redirect:\s*'error'/u.test(site.window))
      .map((site) => `${site.file}:${site.line}`);
    expect(unguarded).toEqual([]);
  });

  it('запросы, несущие учётные данные, закрыты в том числе', () => {
    // Именно здесь вред конкретен: переход по редиректу переслал бы
    // Authorization и X-Vault-Token на адрес, выбранный отвечающей стороной.
    const credentialed = sites.filter((site) => /Authorization|X-Vault-Token/u.test(site.window));
    expect(credentialed.length).toBeGreaterThan(0);
    const leaking = credentialed
      .filter((site) => !/redirect:\s*'error'/u.test(site.window))
      .map((site) => `${site.file}:${site.line}`);
    expect(leaking).toEqual([]);
  });
});

describe('V4.1.4: список HTTP-методов задан явно', () => {
  const main = () => read('apps/api/src/main.ts');

  it('enableCors перечисляет методы, а не полагается на умолчание', () => {
    expect(main()).toMatch(/methods:\s*\['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'\]/u);
  });

  it('список покрывает каждый метод, который контроллеры объявляют', () => {
    const declared = new Set<string>();
    for (const file of tracked('apps/api/src/**/*.controller.ts')) {
      for (const match of read(file).matchAll(/@(Get|Post|Put|Patch|Delete|Head|All)\(/gu)) {
        declared.add(match[1].toUpperCase());
      }
    }
    const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    const missing = [...declared].filter((method) => !allowed.has(method));
    expect(missing).toEqual([]);
  });
});

describe('V13.4.6: подробности сборки не отдаются анонимно', () => {
  const controller = () => read('apps/api/src/health.controller.ts');

  it('маршрут version больше не помечен @Public', () => {
    const text = controller();
    const at = text.indexOf("@Get('version')");
    expect(at).toBeGreaterThan(0);
    // Смотрим ровно предшествующие декораторы, а не файл целиком: слова
    // "@Public()" встречаются и в пояснении рядом.
    const before = text.slice(Math.max(0, at - 200), at);
    expect(before).not.toMatch(/^\s*@Public\(\)\s*$/mu);
  });

  it('пробы живости остаются публичными', () => {
    const text = controller();
    for (const route of ["@Get('health')", "@Get('ready')"]) {
      const at = text.indexOf(route);
      expect(text.slice(Math.max(0, at - 120), at)).toMatch(/@Public\(\)/u);
    }
  });

  it('ни одна проба Kubernetes не ходит на /version', () => {
    const paths = new Set<string>();
    for (const file of tracked('infra/**/*.y*ml')) {
      for (const match of read(file).matchAll(/path:\s*(\S+)/gu)) paths.add(match[1]);
    }
    expect([...paths].filter((p) => p.includes('version'))).toEqual([]);
  });

  it('спецификация объявляет маршрут закрытым', () => {
    const spec = read('apps/web/public/platform-v7/openapi.yaml');
    const block = spec.slice(spec.indexOf('  /version:'), spec.indexOf('  /version:') + 400);
    expect(block).toContain('security: [{ bearerAuth: [] }]');
    expect(block).toContain("'401'");
  });
});
