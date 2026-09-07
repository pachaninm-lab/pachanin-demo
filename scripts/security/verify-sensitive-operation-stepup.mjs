#!/usr/bin/env node
/**
 * Повторная аутентификация перед особо чувствительными операциями (ASVS V7.5.3).
 *
 * Что считать особо чувствительным — суждение, и оно записано в реестре человеком.
 * Проверяемо здесь другое: для каждого названного контроллера КАЖДЫЙ изменяющий
 * маршрут обязан нести объявленный механизм повторной аутентификации, либо стоять
 * в списке исключений с причиной. Новый @Post без гейта роняет сборку, а не
 * обнаруживается через год.
 *
 * Разбор идёт по декораторам маршрута, а не по окну строк: @UseGuards стоит ПОСЛЕ
 * @Post, а не перед ним, и парсер, ожидавший обратного, объявил защищёнными нулём
 * восемь защищённых маршрутов.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const REGISTRY = 'docs/security/sensitive-operations-registry.json';

const MUTATING = /@(Post|Patch|Put|Delete)\('([^']*)'\)/u;

/**
 * Маршруты контроллера с их декораторами.
 *
 * Декораторы маршрута — это всё, что стоит между предыдущим объявлением метода и
 * заголовком текущего, поэтому @UseGuards ниже @Post попадает в тот же блок.
 */
export function controllerRoutes(source) {
  // Класс режется по границам членов, а не по строкам: многострочный декоратор
  // вроде @RateLimit({ ... }) содержит строки, которые не начинаются с @, и
  // построчный накопитель терял на них уже увиденный @Post. Первая версия этого
  // разбора именно так потеряла три маршрута из девяти, включая release.
  const body = source.slice(source.indexOf('{', source.indexOf('export class')));
  const chunks = body.split(/\n  \}\n/u);
  const routes = [];
  for (const chunk of chunks) {
    const match = chunk.match(MUTATING);
    if (!match) continue;
    routes.push({ verb: match[1], path: match[2], decorators: chunk });
  }
  return routes;
}

export function auditController(source, controller) {
  const routes = controllerRoutes(source);
  const exempt = new Map((controller.exemptRoutes || []).map((e) => [`${e.verb} ${e.path}`, e]));
  const problems = [];

  for (const route of routes) {
    const key = `${route.verb} ${route.path}`;
    const guarded = (controller.stepUpMarkers || []).some((marker) => route.decorators.includes(marker));
    const exemption = exempt.get(key);
    if (guarded && exemption) {
      problems.push({ kind: 'REDUNDANT_EXEMPTION', detail: `${controller.file} ${key} carries the step-up and is also exempted` });
      continue;
    }
    if (guarded) continue;
    if (!exemption) {
      problems.push({ kind: 'SENSITIVE_ROUTE_WITHOUT_STEP_UP', detail: `${controller.file} ${key} mutates without any declared further authentication` });
      continue;
    }
    if (String(exemption.because || '').trim().length < 30) {
      problems.push({ kind: 'EXEMPTION_WITHOUT_REASON', detail: `${controller.file} ${key} is exempted with no stated reason` });
    }
  }

  for (const key of exempt.keys()) {
    if (!routes.some((route) => `${route.verb} ${route.path}` === key)) {
      problems.push({ kind: 'EXEMPTION_FOR_MISSING_ROUTE', detail: `${controller.file} ${key} is exempted but no such route exists` });
    }
  }

  return { routes: routes.length, problems };
}

export function auditRegistry(registry, read = (p) => readFileSync(p, 'utf8')) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const problems = [];
  let routes = 0;
  let controllers = 0;

  for (const controller of registry.controllers || []) {
    if (!tracked.includes(controller.file)) {
      problems.push({ kind: 'CONTROLLER_GONE', detail: `${controller.file} is named by the registry but not in the tree` });
      continue;
    }
    if (String(controller.whySensitive || '').trim().length < 30) {
      problems.push({ kind: 'CONTROLLER_WITHOUT_JUDGEMENT', detail: `${controller.file} does not say why its operations are highly sensitive` });
    }
    if ((controller.stepUpMarkers || []).length === 0) {
      problems.push({ kind: 'CONTROLLER_WITHOUT_MARKER', detail: `${controller.file} declares no step-up marker, so nothing could ever satisfy it` });
      continue;
    }
    const result = auditController(read(controller.file), controller);
    problems.push(...result.problems);
    routes += result.routes;
    controllers += 1;
  }

  return { controllers, routes, problems, ok: problems.length === 0 };
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const result = auditRegistry(registry);
  console.log(`SENSITIVE_OPERATION_STEPUP: controllers=${result.controllers} mutatingRoutes=${result.routes} problems=${result.problems.length}`);
  if (result.ok) {
    console.log('Every mutating route on a highly sensitive surface requires further authentication, or is exempted with a stated reason.');
    return 0;
  }
  for (const problem of result.problems) console.error(`${problem.kind}: ${problem.detail}`);
  return 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main());
}
