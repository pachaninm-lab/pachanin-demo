import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SupportService } from './support.service';
import { TICKET_PRIORITIES } from './support.priorities';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Ранг в очереди берётся из канонического массива, а не из второго списка.
 *
 * Найдено ревью: пока список приоритетов один, а порядок задавался отдельным
 * объектом `{ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }` с падением на `?? 3`,
 * добавление нового значения в `TICKET_PRIORITIES` прошло бы проверку на
 * границе и тут же провалилось бы в `?? 3` — то есть вернуло бы ровно то
 * молчаливое понижение, ради устранения которого правка и делалась.
 */

const reporter: RequestUser = { id: 'u-1', orgId: 'o-1', role: Role.FARMER, email: 'a@b.c', tenantId: 't-1' };
const staff: RequestUser = { ...reporter, id: 'u-2', role: Role.SUPPORT_MANAGER };

const make = () => new SupportService(undefined as never);

describe('порядок очереди поддержки', () => {
  it('тикеты выстраиваются в порядке канонического массива', () => {
    const s = make();
    // Создаём в обратном порядке, чтобы сортировка была видна.
    for (const priority of [...TICKET_PRIORITIES].reverse()) {
      s.createTicket({ subject: priority, description: 'd', category: 'C', priority }, reporter);
    }

    expect(s.listQueue(staff).map((t) => t.priority)).toEqual([...TICKET_PRIORITIES]);
  });

  it('ранг выводится из массива, а не из второго перечня', () => {
    // Прямое следствие: позиция в очереди совпадает с позицией в массиве для
    // КАЖДОГО значения, включая те, что появятся позже.
    const s = make();
    for (const priority of TICKET_PRIORITIES) {
      s.createTicket({ subject: priority, description: 'd', category: 'C', priority }, reporter);
    }

    const queue = s.listQueue(staff);
    queue.forEach((ticket, position) => {
      expect(TICKET_PRIORITIES.indexOf(ticket.priority)).toBe(position);
    });
  });

  it('второго перечня приоритетов в сервисе больше нет', () => {
    // Проверка по исходнику, и это осознанно. Замерено: при нынешних ЧЕТЫРЁХ
    // приоритетах возврат жёстко заданного объекта `{ CRITICAL: 0, ... }` не
    // роняет ни один поведенческий тест — оба списка дают один и тот же
    // порядок. Дефект проявился бы только с добавлением пятого значения, то
    // есть ровно тогда, когда его уже поздно замечать.
    //
    // Тесты выше параметризованы массивом и станут несущими сами собой, как
    // только список вырастет. Этот — делает инвариант «список один»
    // наблюдаемым уже сейчас.
    const source = readFileSync(join(__dirname, 'support.service.ts'), 'utf8');
    // Комментарии вырезаются: первая версия этой проверки срабатывала на
    // собственном пояснении в `priorityRank`, которое ЦИТИРУЕТ старый объект.
    // Ложное срабатывание своей же проверки — тоже дефект.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^\s*\/\/.*$/gmu, '');

    expect(code).toContain('priorityRank(');
    expect(code).not.toMatch(/CRITICAL:\s*0/u);
  });

  it('фильтр по приоритету по-прежнему работает', () => {
    // Обратная сторона: сортировка не должна ломать выборку.
    const s = make();
    s.createTicket({ subject: 'a', description: 'd', category: 'C', priority: 'LOW' }, reporter);
    s.createTicket({ subject: 'b', description: 'd', category: 'C', priority: 'CRITICAL' }, reporter);

    expect(s.listQueue(staff, { priority: 'CRITICAL' }).map((t) => t.subject)).toEqual(['b']);
  });
});
