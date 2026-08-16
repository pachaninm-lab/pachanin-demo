import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';
import { WorkTaskDeriver } from './work-task.deriver';
import { AudienceView, projectFor } from './work-task-projection.policy';
import { WorkTaskStatus } from './work-task.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * The minimum surface the accounting contour needs to be reachable.
 *
 * Two routes, both taking the actor from the request rather than the body.
 * Nothing here re-checks tenancy or membership: the repositories run inside
 * `withTrustedContext`, and the row policies already refuse what this actor
 * must not see. A second check in the controller would be the weaker copy that
 * drifts — the mistake the whole contour was built to avoid.
 *
 * `documentDate` is not accepted from the caller. A date chosen by the client
 * selects which tax profile, contract version and regulatory rule govern the
 * document, which would let somebody pick the rules their document is judged
 * by. The server uses its own clock.
 */
@UseGuards(RolesGuard)
@Roles('ADMIN', 'FARMER', 'BUYER', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER')
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly snapshots: AccountingSourceSnapshotRepository,
    private readonly versions: AccountingDocumentVersionRepository,
    private readonly tasks: WorkTaskRepository,
    private readonly deriver: WorkTaskDeriver,
  ) {}

  /**
   * What the platform would put in a document for this deal right now, and
   * which sources are missing if it cannot.
   *
   * A read, so it answers with the gaps rather than an error: knowing that the
   * quality passport is the one thing outstanding is what lets somebody act.
   */
  @Get('deals/:dealId/source-snapshot')
  snapshot(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.snapshots.assemble(user, { dealId, at: new Date() });
  }

  /**
   * Render a new immutable version of a draft document.
   *
   * The outcome is returned rather than thrown, including the refusals, so the
   * caller sees every reason at once instead of one per attempt.
   */
  @Post('documents/:documentId/versions')
  createVersion(
    @Param('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.versions.create(user, { documentId, at: new Date() });
  }

  /**
   * What is outstanding for this organization, most urgent first.
   *
   * Serialised by hand because a task carries a bigint version and JSON has no
   * bigint. Letting the default serialiser reach it would throw at runtime on
   * the first task ever listed.
   */
  @Get('tasks')
  async listTasks(@CurrentUser() user: RequestUser) {
    const tasks = await this.tasks.listOpen(user);
    return tasks.map((task) => ({ ...task, version: task.version.toString() }));
  }

  /**
   * Move a task, carrying the version the caller read.
   *
   * The version is required. Two people working one task from two screens is
   * ordinary in an accounting department, and without it the later write
   * silently discards the earlier decision.
   */
  @Post('tasks/:taskId/transition')
  transition(
    @Param('taskId') taskId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      to: WorkTaskStatus;
      expectedVersion: string;
      resolutionEventId?: string | null;
      assignedMembershipId?: string | null;
    },
  ) {
    return this.tasks.transition(user, {
      taskId,
      to: body.to,
      expectedVersion: BigInt(body.expectedVersion),
      resolutionEventId: body.resolutionEventId ?? null,
      assignedMembershipId: body.assignedMembershipId ?? null,
      // Neither the capabilities nor whether the condition still holds are
      // taken from the body. Both are facts the server can read, and a caller
      // who could state either would be deciding the question being asked of
      // them.
    });
  }

  /**
   * Raise tasks for whatever is outstanding right now.
   *
   * Idempotent: a condition already raised stays one task.
   */
  @Post('tasks/derive')
  derive(@CurrentUser() user: RequestUser) {
    return this.deriver.deriveUnsignedDocuments(user);
  }

  /**
   * The same tasks, shaped for who is reading them.
   *
   * A farmer gets one sentence, a director gets the decisions with the
   * counterparty and the amount, a bookkeeper gets the queue. Not three
   * filters over one table: three different questions.
   */
  @Get('tasks/projection')
  async projection(
    @CurrentUser() user: RequestUser,
    @Query('view') view?: string,
  ) {
    const requested =
      view === AudienceView.DECISION_QUEUE || view === AudienceView.WORK_QUEUE
        ? view
        : AudienceView.PRINCIPAL_SUMMARY;

    const tasks = await this.tasks.listOpen(user);
    const viewer = await this.tasks.describeViewer(user);
    const projected = projectFor(tasks, viewer, requested);

    // bigint again: the amounts have to cross JSON, and they are kopecks.
    return JSON.parse(
      JSON.stringify(projected, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }
}
