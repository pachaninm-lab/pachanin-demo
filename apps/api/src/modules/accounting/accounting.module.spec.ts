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
