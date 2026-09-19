import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import {
  AddCommentDto,
  AssignTicketDto,
  CreateTicketDto,
  EscalateTicketDto,
  ResolveTicketDto,
} from './support.dto';
import { TICKET_PRIORITIES } from '../support.priorities';

/**
 * V2.2.1 / V2.2.2 — тела поддержки.
 *
 * Пайп берётся ровно той же конфигурации, что в main.ts.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const через = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

const TICKET = { subject: 'Тема', description: 'Описание', category: 'BILLING' };

describe('Приоритет тикета: union наконец существует во время выполнения', () => {
  it('произвольная строка отклоняется, а не опускается в конец очереди', async () => {
    // Замерено до правки: 'СРОЧНО!!!' сохранялось как есть, а listQueue
    // сортирует по priorityOrder[p] ?? 3 — то есть неизвестный приоритет
    // получал НИЗШИЙ ранг. Отправитель пометил тикет срочным, а очередь
    // молча отправила его вниз.
    await expect(через(CreateTicketDto)({ ...TICKET, priority: 'СРОЧНО!!!' })).rejects.toThrow();
  });

  it.each(TICKET_PRIORITIES.map((p) => [p]))('«%s» принимается', async (priority) => {
    await expect(через(CreateTicketDto)({ ...TICKET, priority })).resolves.toMatchObject({ priority });
  });

  it('регистр значим: lowercase не проходит', async () => {
    await expect(через(CreateTicketDto)({ ...TICKET, priority: 'critical' })).rejects.toThrow();
  });

  it('приоритет остаётся необязательным', async () => {
    // Обратная сторона: сервис подставляет MEDIUM по умолчанию, и требовать
    // поле значило бы отказывать вызывающим, которые работали до сих пор.
    await expect(через(CreateTicketDto)(TICKET)).resolves.toEqual(TICKET);
  });
});

describe('Длины полей ограничены', () => {
  it('тема в 50 000 символов отклоняется', async () => {
    // Замерено до правки: принималась и сохранялась целиком.
    await expect(через(CreateTicketDto)({ ...TICKET, subject: 'x'.repeat(50_000) })).rejects.toThrow();
  });

  it.each([
    ['subject', ''],
    ['description', ''],
    ['category', ''],
  ])('пустой %s отклоняется', async (field, value) => {
    await expect(через(CreateTicketDto)({ ...TICKET, [field]: value })).rejects.toThrow();
  });

  it('обычный тикет проходит целиком', async () => {
    const body = { ...TICKET, priority: 'HIGH', dealId: 'deal-1', organizationId: 'org-1' };
    await expect(через(CreateTicketDto)(body)).resolves.toEqual(body);
  });
});

describe('Остальные четыре тела', () => {
  it('assigneeId обязателен и ограничен', async () => {
    await expect(через(AssignTicketDto)({})).rejects.toThrow();
    await expect(через(AssignTicketDto)({ assigneeId: 'x'.repeat(500) })).rejects.toThrow();
    await expect(через(AssignTicketDto)({ assigneeId: 'u-7' })).resolves.toEqual({ assigneeId: 'u-7' });
  });

  it('resolution обязателен', async () => {
    await expect(через(ResolveTicketDto)({})).rejects.toThrow();
    await expect(через(ResolveTicketDto)({ resolution: 'Решено' })).resolves.toEqual({ resolution: 'Решено' });
  });

  it('reason обязателен', async () => {
    await expect(через(EscalateTicketDto)({})).rejects.toThrow();
    await expect(через(EscalateTicketDto)({ reason: 'Нет ответа сутки' })).resolves.toBeDefined();
  });

  it('isInternal обязан быть булевым, а не строкой', async () => {
    // Решение о внутреннем комментарии принимает сервис по роли; границе
    // незачем передавать ему значение другого типа.
    await expect(через(AddCommentDto)({ text: 'т', isInternal: 'true' })).rejects.toThrow();
    await expect(через(AddCommentDto)({ text: 'т', isInternal: 1 })).rejects.toThrow();
    await expect(через(AddCommentDto)({ text: 'т', isInternal: true })).resolves.toEqual({ text: 'т', isInternal: true });
  });

  it('текст комментария обязателен и ограничен', async () => {
    await expect(через(AddCommentDto)({ text: '' })).rejects.toThrow();
    await expect(через(AddCommentDto)({ text: 'x'.repeat(20_000) })).rejects.toThrow();
  });

  it('лишнее поле срезается, а не доходит до сервиса', async () => {
    const result = await через(AddCommentDto)({ text: 'т', smuggled: 'x' });
    expect(result).not.toHaveProperty('smuggled');
  });
});
