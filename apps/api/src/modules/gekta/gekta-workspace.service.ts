import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stableJson } from '../auth/auth-crypto';
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

type Ownable = { accountId: string; deletedAt?: Date | null };

type ImportedConversation = {
  sourceId?: string;
  title: string;
  locale: string;
  createdAt?: string;
  messages: readonly { role: GektaMessageRole; body: string; createdAt?: string }[];
};

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

  private async lockHistory(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM public.gekta_accounts WHERE id = ${accountId} FOR UPDATE
    `);
    if (rows.length !== 1) throw new NotFoundException('not_found');
  }

  /** Old clients did not send an identity; never persist their content as a receipt. */
  private legacyImportKey(accountId: string, incoming: Pick<ImportedConversation, 'title' | 'locale' | 'messages'>): string {
    const messages = incoming.messages.slice(0, GEKTA_IMPORT_MAX_MESSAGES)
      .map(m => [m.role, m.body.slice(0, GEKTA_MESSAGE_BODY_MAX)])
      .sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
    return `legacy-v1:${createHash('sha256').update(`gekta-history-import-legacy-v1:${stableJson({
      accountId, title: clean(incoming.title, MAX_TITLE), locale: incoming.locale, messages,
    })}`).digest('hex')}`;
  }

  private async retainImportReceipts(tx: Prisma.TransactionClient, accountId: string, conversationId?: string): Promise<void> {
    const rows = await tx.gektaConversation.findMany({
      where: { accountId, ...(conversationId ? { id: conversationId } : {}), importedAt: { not: null } },
      include: { messages: true },
    });
    for (const row of rows) {
      // Backfill old stable-only receipts before either form of purge.
      const importKey = this.legacyImportKey(accountId, {
        title: row.title, locale: row.locale,
        messages: row.messages.map(m => ({ role: m.role as GektaMessageRole, body: m.body })),
      });
      await tx.gektaHistoryImportReceipt.createMany({
        data: [{ accountId, importKey, payloadHash: importKey.split(':')[1], conversationId: row.id }], skipDuplicates: true,
      });
    }
  }

  private assertOwned(row: Ownable | null, accountId: string): void {
    if (!row) throw new NotFoundException('not_found');
    if (row.accountId !== accountId) throw new ForbiddenException('not_owner');
  }

  private assertActiveOwned(row: Ownable | null, accountId: string): void {
    this.assertOwned(row, accountId);
    if (row?.deletedAt) throw new NotFoundException('not_found');
  }

  private async retainActiveProject(tx: Prisma.TransactionClient, accountId: string, projectId: string): Promise<void> {
    const project = await tx.gektaProject.findUnique({ where: { id: projectId } });
    this.assertActiveOwned(project, accountId);
    // The conditional UPDATE serializes assignment with project deletion.
    const updated = await tx.gektaProject.updateMany({
      where: { id: projectId, accountId, deletedAt: null },
      data: { updatedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('not_found');
  }

  private async updateActiveConversation(
    tx: Prisma.TransactionClient, accountId: string, conversationId: string,
    data: Prisma.GektaConversationUpdateManyMutationInput,
  ): Promise<void> {
    // This row lock is held through message creation/return; deletion cannot
    // commit between the active check and the transaction's write.
    const updated = await tx.gektaConversation.updateMany({
      where: { id: conversationId, accountId, deletedAt: null },
      data,
    });
    if (updated.count !== 1) throw new NotFoundException('not_found');
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
    this.assertActiveOwned(project, accountId);
    const cleanName = clean(name, MAX_NAME);
    if (!cleanName) throw new BadRequestException('project_name_required');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gektaProject.updateMany({
        where: { id: projectId, accountId, deletedAt: null },
        data: { name: cleanName, ...(description === undefined ? {} : { description: clean(description, MAX_DESCRIPTION) }) },
      });
      if (updated.count !== 1) throw new NotFoundException('not_found');
      return tx.gektaProject.findUniqueOrThrow({ where: { id: projectId } });
    });
  }

  /** Удаление проекта не удаляет диалоги: они возвращаются в общую историю. */
  async deleteProject(accountId: string, projectId: string, now: Date = new Date()) {
    const project = await this.prisma.gektaProject.findUnique({ where: { id: projectId } });
    this.assertOwned(project, accountId);
    if (project!.deletedAt) return project;
    return this.prisma.$transaction(async (tx) => {
      // Lock the project before its conversations, as create/move do.
      const deleted = await tx.gektaProject.updateMany({
        where: { id: projectId, accountId, deletedAt: null }, data: { deletedAt: now },
      });
      if (deleted.count === 1) {
        await tx.gektaConversation.updateMany({ where: { projectId, accountId }, data: { projectId: null } });
      }
      return tx.gektaProject.findUniqueOrThrow({ where: { id: projectId } });
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
    this.assertActiveOwned(conversation, accountId);
    return conversation;
  }

  async createConversation(accountId: string, title: string, locale: string, projectId?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockHistory(tx, accountId);
      if (projectId) await this.retainActiveProject(tx, accountId, projectId);
      return tx.gektaConversation.create({
        data: { accountId, title: clean(title, MAX_TITLE) || 'Новый диалог', locale, projectId: projectId ?? null },
      });
    });
  }

  async appendMessage(accountId: string, conversationId: string, message: {
    role: GektaMessageRole;
    body: string;
    citations?: unknown;
    attachments?: unknown;
  }) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertActiveOwned(conversation, accountId);
    return this.prisma.$transaction(async (tx) => {
      await this.updateActiveConversation(tx, accountId, conversationId, { updatedAt: new Date() });
      const created = await tx.gektaMessage.create({
        data: {
          conversationId,
          role: message.role,
          body: message.body.slice(0, GEKTA_MESSAGE_BODY_MAX),
          citations: (message.citations ?? undefined) as never,
          attachments: (message.attachments ?? undefined) as never,
        },
      });
      return created;
    });
  }

  async renameConversation(accountId: string, conversationId: string, title: string) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertActiveOwned(conversation, accountId);
    const cleanTitle = clean(title, MAX_TITLE);
    if (!cleanTitle) throw new BadRequestException('conversation_title_required');
    return this.prisma.$transaction(async (tx) => {
      await this.updateActiveConversation(tx, accountId, conversationId, { title: cleanTitle });
      return tx.gektaConversation.findUniqueOrThrow({ where: { id: conversationId } });
    });
  }

  async moveConversation(accountId: string, conversationId: string, projectId: string | null) {
    const conversation = await this.prisma.gektaConversation.findUnique({ where: { id: conversationId } });
    this.assertActiveOwned(conversation, accountId);
    return this.prisma.$transaction(async (tx) => {
      if (projectId) await this.retainActiveProject(tx, accountId, projectId);
      const moved = await tx.gektaConversation.updateMany({
        where: { id: conversationId, accountId, deletedAt: null }, data: { projectId },
      });
      if (moved.count !== 1) throw new NotFoundException('not_found');
      return tx.gektaConversation.findUniqueOrThrow({ where: { id: conversationId } });
    });
  }

  async deleteConversation(accountId: string, conversationId: string, _now: Date = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockHistory(tx, accountId);
      const conversation = await tx.gektaConversation.findUnique({ where: { id: conversationId } });
      if (conversation) this.assertOwned(conversation, accountId);
      await this.retainImportReceipts(tx, accountId, conversationId);
      await tx.$queryRaw(Prisma.sql`SELECT public.purge_gekta_history(${accountId}, ${conversationId})`);
      return { deleted: true };
    });
  }

  async clearHistory(accountId: string, _now: Date = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockHistory(tx, accountId);
      await this.retainImportReceipts(tx, accountId);
      const rows = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT public.purge_gekta_history(${accountId}, NULL::text) AS count
      `);
      return { count: Number(rows[0].count) };
    });
  }

  /**
   * Импорт и физическое удаление сериализуются строкой существующего аккаунта.
   * Стабильный локальный sourceId различает одноимённые и одинаковые диалоги.
   * Квитанция и вложенные сообщения коммитятся вместе; удаление оставляет
   * только техническую квитанцию, поэтому повтор не восстанавливает историю.
   * У старых клиентов без sourceId остаётся content-based совместимость:
   * их одинаковые тексты/заголовки не различимы, порядок/даты не являются ID.
   */
  async importAnonymousHistory(
    accountId: string,
    conversations: readonly ImportedConversation[],
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockHistory(tx, accountId);
      const imported: string[] = [];
      for (const incoming of conversations.slice(0, GEKTA_IMPORT_MAX_CONVERSATIONS)) {
        const title = clean(incoming.title, MAX_TITLE);
        if (!title) continue;
        if (incoming.sourceId !== undefined && (typeof incoming.sourceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(incoming.sourceId))) {
          throw new BadRequestException('import_identity_invalid');
        }
        const legacyKey = this.legacyImportKey(accountId, incoming);
        const importKey = incoming.sourceId === undefined ? legacyKey
          : `id-v1:${createHash('sha256').update(`gekta-history-import-id-v1:${stableJson({ accountId, sourceId: incoming.sourceId })}`).digest('hex')}`;
        const payloadHash = incoming.sourceId === undefined ? legacyKey.split(':')[1]
          : createHash('sha256').update(`gekta-history-import-payload-v1:${stableJson({
            accountId, title, locale: incoming.locale, createdAt: incoming.createdAt ?? null,
            messages: incoming.messages.slice(0, GEKTA_IMPORT_MAX_MESSAGES).map(m => ({
              role: m.role, body: m.body.slice(0, GEKTA_MESSAGE_BODY_MAX), createdAt: m.createdAt ?? null,
            })),
          })}`).digest('hex');
        const received = await tx.gektaHistoryImportReceipt.findUnique({
          where: { accountId_importKey: { accountId, importKey } },
        });
        if (received) {
          if (received.payloadHash !== payloadHash) {
            throw new ConflictException('import_identity_conflict');
          }
          if (importKey !== legacyKey) await tx.gektaHistoryImportReceipt.createMany({
            data: [{ accountId, importKey: legacyKey, payloadHash: legacyKey.split(':')[1], conversationId: received.conversationId, importedAt: now }], skipDuplicates: true,
          });
          continue;
        }
        if (importKey !== legacyKey) {
          const legacyReceipt = await tx.gektaHistoryImportReceipt.findUnique({
            where: { accountId_importKey: { accountId, importKey: legacyKey } },
          });
          // A stable import's legacy alias suppresses old-client replay, but
          // must never coalesce different stable IDs with identical content.
          if (legacyReceipt && !await tx.gektaHistoryImportReceipt.findFirst({
            where: { accountId, conversationId: legacyReceipt.conversationId, importKey: { startsWith: 'id-v1:' } },
          })) {
            await tx.gektaHistoryImportReceipt.create({ data: { accountId, importKey, payloadHash, conversationId: legacyReceipt.conversationId, importedAt: now } });
            continue;
          }
        }

        // Adopt a legacy row/soft-delete only when it has no stable receipt and
        // its actual content matches. Title alone never identifies an import.
        const legacyRows = await tx.gektaConversation.findMany({
          where: { accountId, title, importedAt: { not: null } }, include: { messages: true },
        });
        let existingId: string | undefined;
        for (const row of legacyRows) {
          if (await tx.gektaHistoryImportReceipt.findFirst({ where: { accountId, conversationId: row.id } })) continue;
          const rowKey = this.legacyImportKey(accountId, {
            title: row.title, locale: row.locale,
            messages: row.messages.map(m => ({ role: m.role as GektaMessageRole, body: m.body })),
          });
          if (rowKey === legacyKey) { existingId = row.id; break; }
        }
        const created = existingId ? { id: existingId } : await tx.gektaConversation.create({
          data: {
            accountId, title, locale: incoming.locale, importedAt: now,
            createdAt: incoming.createdAt ? new Date(incoming.createdAt) : now,
            messages: {
              create: incoming.messages.slice(0, GEKTA_IMPORT_MAX_MESSAGES).map(message => ({
                role: message.role, body: message.body.slice(0, GEKTA_MESSAGE_BODY_MAX),
                createdAt: message.createdAt ? new Date(message.createdAt) : now,
              })),
            },
          },
        });
        await tx.gektaHistoryImportReceipt.create({ data: { accountId, importKey, payloadHash, conversationId: created.id, importedAt: now } });
        if (importKey !== legacyKey) await tx.gektaHistoryImportReceipt.createMany({
          data: [{ accountId, importKey: legacyKey, payloadHash: legacyKey.split(':')[1], conversationId: created.id, importedAt: now }], skipDuplicates: true,
        });
        if (!existingId) imported.push(created.id);
      }
      return { importedCount: imported.length, conversationIds: imported };
    }, { maxWait: 5_000, timeout: 30_000 });
  }
}
