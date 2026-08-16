import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';

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
}
