import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingController } from './accounting.controller';
import { AccountingModule } from './accounting.module';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';

/**
 * That the module actually resolves.
 *
 * A module can typecheck and still fail to instantiate — a missing provider, a
 * dependency the imported module does not export, a circular import. Those
 * surface at boot, which in production means the whole API fails to start. A
 * compiling module is not a wired one, so this instantiates it.
 */
describe('AccountingModule', () => {
  it('resolves both repositories and the controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AccountingModule],
    })
      // The real PrismaService opens a connection on init; the wiring under
      // test is the module graph, not the driver.
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    expect(moduleRef.get(AccountingSourceSnapshotRepository)).toBeInstanceOf(
      AccountingSourceSnapshotRepository,
    );
    expect(moduleRef.get(AccountingDocumentVersionRepository)).toBeInstanceOf(
      AccountingDocumentVersionRepository,
    );
    expect(moduleRef.get(AccountingController)).toBeInstanceOf(
      AccountingController,
    );

    await moduleRef.close();
  });

  it('gives the version repository the snapshot repository it depends on', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AccountingModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    const versions = moduleRef.get(AccountingDocumentVersionRepository);
    // Without this the version repository would resolve and then fail at the
    // first call, which is the failure mode a boot check exists to catch.
    expect(
      (versions as unknown as { snapshots: unknown }).snapshots,
    ).toBeInstanceOf(AccountingSourceSnapshotRepository);

    await moduleRef.close();
  });
});

/**
 * That the routes are actually declared.
 *
 * The tests above prove the controller resolves from the module graph. They do
 * not prove it still carries the paths it is supposed to — and it did not: the
 * manual-task route was lost in an edit, the module kept resolving, every test
 * kept passing, and the repository method behind it became unreachable while
 * looking present. A boot check that only asks "does it resolve" answers the
 * easier question.
 */
describe('the accounting routes the controller declares', () => {
  const EXPECTED: readonly string[] = [
    'GET deals/:dealId/source-snapshot',
    'POST documents/:documentId/versions',
    'GET tasks',
    'POST tasks',
    'POST tasks/:taskId/transition',
    'POST tasks/derive',
    'GET tasks/projection',
    'GET periods',
    'POST periods',
    'POST periods/:periodId/advance',
    'POST periods/derive',
    'GET documents/versions/:versionId/transmission-readiness',
    'GET deals/:dealId/advances',
    'POST advances',
    'POST advances/:advanceId/offsets',
    'GET deals/:dealId/services',
    'POST services',
    'POST services/:serviceId/decision',
    'POST services/:serviceId/reversal',
    'GET deals/:dealId/payments',
    'POST payments',
    'POST payments/:paymentId/allocations',
    'GET deals/:dealId/reconciliations',
    'GET deals/:dealId/reconciliations/preview',
    'POST reconciliations',
    'POST reconciliations/:reconciliationId/answer',
    'GET connections',
    'GET connections/attestations',
    'POST connections/attestations/subjects',
    'POST connections/attestations/:subjectId',
  ];

  it('declares every route the contour is meant to expose, and no others', () => {
    const prototype = AccountingController.prototype as unknown as Record<string, unknown>;
    const declared = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const handler = prototype[name] as object;
        // The same metadata Nest's router explorer reads to register a path.
        const path = Reflect.getMetadata('path', handler);
        const method = Reflect.getMetadata('method', handler);
        const verb = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'][
          method as number
        ];
        return path === undefined ? null : `${verb} ${path}`;
      })
      .filter((entry): entry is string => entry !== null);

    expect(declared.sort()).toEqual([...EXPECTED].sort());
  });
});
