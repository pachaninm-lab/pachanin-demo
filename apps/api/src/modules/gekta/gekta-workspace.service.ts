import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GEKTA_CONVERSATION_TITLE_MAX,
  GEKTA_IMPORT_MAX_CONVERSATIONS,
  GEKTA_IMPORT_MAX_MESSAGES,
  GEKTA_MESSAGE_BODY_MAX,
  GEKTA_PROJECT_DESCRIPTION_MAX,
  GEKTA_PROJECT_NAME_MAX,
  type GektaMessageRole,
} from './gekta.contract';

/**
 * Проекты и история диалогов зарегистрированного пользователя.
 *
 * Каждая операция проверяет владение: диалог и проект принадлежат аккаунту, и
 * чужой идентификатор не открывает доступ к чужим данным.
 */

type Ownable = { accountId: string };

// Пределы объявлены один раз в gekta.contract.ts: DTO проверяет границу по
// тем же числам, которыми режет сервис.
const MAX_NAME = GEKTA_PROJECT_NAME_MAX;
const MAX_DESCRIPTION = GEKTA_PROJECT_DESCRIPTION_MAX;
const MAX_TITLE = GEKTA_CONVERSATION_TITLE_MAX;

function clean(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, limit);
}

@Injectable()
export class GektaWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOwned(row: Ownable | null, accountId: string): void {
    if (!row) throw new NotFoundException('not_found');
    if (row.accountId !== accountId) throw new ForbiddenException('not_owner');
  }

  async listProjects(accountId: string) {
    return this.prisma.gektaProject.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { conversations: true } } },
    });
  }

  async createProject(accountId: string, name: string, description: string, locale: string) {
    const cleanName = clean(name, MAX_NAME);
    if (!cleanName) throw new BadRequestException('project_name_required');
    return this.prisma.gektaProject.create({
      data: { accountId, name: cleanName, description: clean(description, MAX_DESCRIPTION), locale },
    });
  }

  async renameProject(accountId: string, projectId: string, name: string, description?: string) {
    const project = await this.prisma.gektaProject.findUnique({ where: { id: projectId } });
    this.assertOwned(project, accountId);
    const cleanName = clean(name, MAX_NAME);
    if (!cleanName) throw new BadRequestException('project_name_required');
    return this.prisma.gektaProject.update({
      where: { id: projectId },
      data: {
        name: cleanName,
        ...(description === undefined ? {} : { description: clean(description, MAX_DESCRIPTION) }),
      },
    });
  }

  /** Удаление проекта не удаляет диалоги: они возвращаются в общую историю. */
  async deleteProject(accountId: string, projectId: string, now: Date = new Date()) {
    const project = await this.prisma.gektaProject.findUnique({ where: { id: projectId } });
    this.assertOwned(project, accountId);
    return this.prisma.$transaction(async (tx) => {
      await tx.gektaConversation.updateMany({ where: { projectId, accountId }, data: { projectId: null } });
      return tx.gektaProject.update({ where: { id: projectId }, data: { deletedAt: now } });
    });
  }

  async listConversations(accountId: string, options?: { projectId?: string | null; search?: string }) {
    const search = options?.search?.trim();
    return this.prisma.gektaConversation.findMany({
      where: {
        accountId,
        deletedAt: null,
        ...(options?.projectId === undefined ? {} : { projectId: options.projectId }),
        ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async getConversation(accountId: string, conversationId: string) {
    const conversation = await this.prisma.gektaConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    this.assertOwned(conversation, accountId);
    return conversation;
  }

  async createConversation(accountId: string, title: string, locale: string, projectId?: string | null) {
    if (projectId) {
      const project = await this.prisma.gektaProject.findUnique({ where: { id: projectId } });
      this.assertOwned(project, accountId);
    }
    return this.prisma.gektaConversation.create({
      data: {
        accountId,
        title: clean(title, MAX_TITLE) || 'Новый диалог',
        locale,
        projectId: projectId ?? null,
      },
    });
  }

  async appendMessage(accountId: string, conversationId: string, message: {
    role: GektaMessageRole;
    body: string;
    citations?: unknown;
    attachments?: unknown;
  }) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertOwned(conversation, accountId);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.gektaMessage.create({
        data: {
          conversationId,
          role: message.role,
          body: message.body.slice(0, GEKTA_MESSAGE_BODY_MAX),
          citations: (message.citations ?? undefined) as never,
          attachments: (message.attachments ?? undefined) as never,
        },
      });
      await tx.gektaConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return created;
    });
  }

  async renameConversation(accountId: string, conversationId: string, title: string) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertOwned(conversation, accountId);
    const cleanTitle = clean(title, MAX_TITLE);
    if (!cleanTitle) throw new BadRequestException('conversation_title_required');
    return this.prisma.gektaConversation.update({
      where: { id: conversationId },
      data: { title: cleanTitle },
    });
  }

  async moveConversation(accountId: string, conversationId: string, projectId: string | null) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertOwned(conversation, accountId);
    if (projectId) {
      const project = await this.prisma.gektaProject.findUnique({ where: { id: projectId } });
      this.assertOwned(project, accountId);
    }
    return this.prisma.gektaConversation.update({ where: { id: conversationId }, data: { projectId } });
  }

  async deleteConversation(accountId: string, conversationId: string, now: Date = new Date()) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertOwned(conversation, accountId);
    return this.prisma.gektaConversation.update({ where: { id: conversationId }, data: { deletedAt: now } });
  }

  async clearHistory(accountId: string, now: Date = new Date()) {
    return this.prisma.gektaConversation.updateMany({
      where: { accountId, deletedAt: null },
      data: { deletedAt: now },
    });
  }

  /**
   * Импорт анонимной истории при регистрации. Импорт идемпотентен по заголовку:
   * повторный вызов с теми же диалогами не создаёт дублей, поэтому историю
   * нельзя ни потерять, ни размножить двойным нажатием.
   */
  async importAnonymousHistory(
    accountId: string,
    conversations: readonly {
      title: string;
      locale: string;
      createdAt?: string;
      messages: readonly { role: GektaMessageRole; body: string; createdAt?: string }[];
    }[],
    now: Date = new Date(),
  ) {
    const imported: string[] = [];
    for (const incoming of conversations.slice(0, GEKTA_IMPORT_MAX_CONVERSATIONS)) {
      const title = clean(incoming.title, MAX_TITLE);
      if (!title) continue;

      const existing = await this.prisma.gektaConversation.findFirst({
        where: { accountId, title, importedAt: { not: null } },
      });
      if (existing) continue;

      const created = await this.prisma.gektaConversation.create({
        data: {
          accountId,
          title,
          locale: incoming.locale,
          importedAt: now,
          createdAt: incoming.createdAt ? new Date(incoming.createdAt) : now,
          messages: {
            create: incoming.messages.slice(0, GEKTA_IMPORT_MAX_MESSAGES).map((message) => ({
              role: message.role,
              body: message.body.slice(0, GEKTA_MESSAGE_BODY_MAX),
              createdAt: message.createdAt ? new Date(message.createdAt) : now,
            })),
          },
        },
      });
      imported.push(created.id);
    }
    return { importedCount: imported.length, conversationIds: imported };
  }
}
