import {
  decodeFnsEgrulXml,
  isValidRussianOgrn,
  parseFnsEgrulXml,
} from './fns-egrul-feed.parser';
import { RoleEligibilityFnsEgrulIngestRepository } from '../role-eligibility-fns-egrul-ingest.repository';
import { sha256, stableJson } from '../role-eligibility-security';

describe('FNS EGRUL authorized feed parser', () => {
  it('validates OGRN control digit without treating it as existence evidence', () => {
    expect(isValidRussianOgrn('1027700132195')).toBe(true);
    expect(isValidRussianOgrn('1027700132194')).toBe(false);
    expect(isValidRussianOgrn('')).toBe(false);
  });

  it('parses bounded current EGRUL identity/activity facts and prefers 4.08 reported OKVED', () => {
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<EGRUL ДатаВыг="2026-09-05">
  <СвЮЛ ПолнНаимОПФ="ОБЩЕСТВО &quot;РОМАШКА&quot;" КПП="770101001" ИНН="7707083893" ДатаОГРН="2002-08-15" ОГРН="1027700132195" ДатаВып="2026-09-04">
    <СвНаимЮЛ НаимЮЛПолн="ОБЩЕСТВО &quot;РОМАШКА&quot;" />
    <СвОКВЭДОтч>
      <СвОКВЭДОтчОсн КодОКВЭД="46.21" />
      <СвОКВЭДОтчДоп КодОКВЭД="52.10" />
    </СвОКВЭДОтч>
    <СвОКВЭД>
      <СвОКВЭДОсн КодОКВЭД="01.11" />
      <СвОКВЭДДоп КодОКВЭД="49.41" />
    </СвОКВЭД>
    <СвВложенныйКонтекст><СвЮЛ ОГРН="1027700132195"><СвНаимЮЛ НаимЮЛПолн="ВЛОЖЕННАЯ ССЫЛКА" /></СвЮЛ></СвВложенныйКонтекст>
  </СвЮЛ>
  <СвЮЛ ПолнНаимОПФ="ООО ЛИКВИДИРОВАНО" КПП="781201001" ИНН="7812345675" ДатаОГРН="2004-01-01" ОГРН="1047796045770" ДатаВып="2026-09-04">
    <СвПрекрЮЛ ДатаПрекрЮЛ="2026-08-31" />
  </СвЮЛ>
</EGRUL>`;

    const result = parseFnsEgrulXml(xml, '4.08');
    expect(result.publishedAt.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      sourceRecordId: '1027700132195',
      subjectInn: '7707083893',
      subjectOgrn: '1027700132195',
      recordType: 'EGRUL_LEGAL_ENTITY',
      normalizedPayload: {
        legalName: 'ОБЩЕСТВО "РОМАШКА"',
        active: true,
        status: 'ACTIVE',
        primaryOkved: '46.21',
        additionalOkved: ['01.11', '49.41', '52.10'],
      },
    });
    expect(result.records[1].normalizedPayload.active).toBe(false);
    expect(result.records[1].normalizedPayload.status).toBe('TERMINATED');
    expect(result.records[1].validUntil?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('uses declared OKVED for transitional 4.07 data when reported OKVED is absent', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ДатаОГРН="2002-08-15" ПолнНаимОПФ="ООО РОМАШКА"><СвОКВЭД><СвОКВЭДОсн КодОКВЭД="01.11"/><СвОКВЭДДоп КодОКВЭД="52.10"/></СвОКВЭД></СвЮЛ></EGRUL>`;
    const [record] = parseFnsEgrulXml(xml, '4.07').records;
    expect(record.normalizedPayload.primaryOkved).toBe('01.11');
    expect(record.normalizedPayload.additionalOkved).toEqual(['52.10']);
  });

  it('decodes the official windows-1251 transport encoding', () => {
    expect(decodeFnsEgrulXml(Uint8Array.from([0xc0, 0xc1, 0xc2]))).toBe('АБВ');
  });

  it('fails closed on external entities, unsupported formats and invalid identifiers', () => {
    expect(() => parseFnsEgrulXml('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><EGRUL ДатаВыг="2026-09-05"></EGRUL>', '4.08'))
      .toThrow('FNS_EGRUL_XML_EXTERNAL_ENTITY_FORBIDDEN');
    expect(() => parseFnsEgrulXml('<EGRUL ДатаВыг="2026-09-05"></EGRUL>', '4.06' as '4.08'))
      .toThrow('FNS_EGRUL_FORMAT_UNSUPPORTED');
    expect(() => parseFnsEgrulXml('<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083892" ОГРН="1027700132195" ПолнНаимОПФ="X"></СвЮЛ></EGRUL>', '4.08'))
      .toThrow('FNS_EGRUL_INN_INVALID');
  });

  it('rejects truncated or structurally mismatched XML before accepting a partial generation', () => {
    const truncated = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"></СвЮЛ>';
    expect(() => parseFnsEgrulXml(truncated, '4.08')).toThrow('FNS_EGRUL_XML_STRUCTURE_INVALID');

    const mismatched = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СвОКВЭД></СвЮЛ></EGRUL>';
    expect(() => parseFnsEgrulXml(mismatched, '4.08')).toThrow('FNS_EGRUL_XML_STRUCTURE_INVALID');
  });

  it('rejects impossible publication, registration and termination calendar dates', () => {
    const invalidPublished = '<EGRUL ДатаВыг="2026-02-31"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"></СвЮЛ></EGRUL>';
    expect(() => parseFnsEgrulXml(invalidPublished, '4.08')).toThrow('FNS_EGRUL_PUBLICATION_DATE_INVALID');

    const invalidRegistered = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ДатаОГРН="2026-02-31" ПолнНаимОПФ="ООО РОМАШКА"></СвЮЛ></EGRUL>';
    expect(() => parseFnsEgrulXml(invalidRegistered, '4.08')).toThrow('FNS_EGRUL_REGISTRATION_DATE_INVALID');

    const invalidTerminated = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СвПрекрЮЛ ДатаПрекрЮЛ="2026-02-31"/></СвЮЛ></EGRUL>';
    expect(() => parseFnsEgrulXml(invalidTerminated, '4.08')).toThrow('FNS_EGRUL_TERMINATION_DATE_INVALID');
  });
});

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

describe('FNS EGRUL ingestion repository', () => {
  const publishedAt = new Date('2026-09-05T00:00:00.000Z');
  const input = {
    publishedAt,
    downloadedAt: new Date('2026-09-05T01:00:00.000Z'),
    contentSha256: 'a'.repeat(64),
    format: '4.08' as const,
    parserVersion: 'fns-egrul-v1',
    freshUntil: new Date('2026-09-06T00:00:00.000Z'),
  };
  const generationRow = {
    id: 'elg-test',
    source: 'FNS',
    status: 'STAGING',
    published_at: publishedAt,
    content_sha256: input.contentSha256,
    parser_version: input.parserVersion,
    schema_version: 'EGRUL_408',
  };
  const record = {
    sourceRecordId: '1027700132195',
    subjectInn: '7707083893',
    subjectOgrn: '1027700132195',
    recordType: 'EGRUL_LEGAL_ENTITY' as const,
    normalizedPayload: {
      inn: '7707083893',
      ogrn: '1027700132195',
      kpp: '770101001',
      legalName: 'ООО РОМАШКА',
      active: true,
      status: 'ACTIVE' as const,
      primaryOkved: '01.11',
      additionalOkved: [] as string[],
      strongContradiction: false as const,
    },
    validFrom: new Date('2002-08-15T00:00:00.000Z'),
    validUntil: null,
  };

  function createRepository(responses: unknown[][], executeRaw = jest.fn().mockResolvedValue(1)) {
    const queryRaw = jest.fn();
    for (const response of responses) queryRaw.mockResolvedValueOnce(response);
    const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };
    const transaction = jest.fn(async (task: (client: typeof tx) => Promise<unknown>) => task(tx));
    const registry = {
      validateAndActivate: jest.fn().mockResolvedValue({ generationId: 'elg-test' }),
      reject: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new RoleEligibilityFnsEgrulIngestRepository(
      { $transaction: transaction } as any,
      registry as any,
    );
    return { repository, queryRaw, executeRaw, transaction, registry };
  }

  it('serializes generation creation with a transaction advisory lock before reading state', async () => {
    const { repository, queryRaw, executeRaw, transaction } = createRepository([[{ locked: true }], []]);
    const result = await repository.begin(input);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlText(queryRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock(hashtextextended(?, 0))');
    expect((queryRaw.mock.calls[0][0] as { values?: unknown[] }).values).toEqual([result.id]);
    expect(sqlText(queryRaw.mock.calls[1][0])).toContain('FROM eligibility.registry_generations');
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('resumes an identical staged generation without inserting it again', async () => {
    const { repository, executeRaw } = createRepository([[{ locked: true }], [generationRow]]);
    await expect(repository.begin(input)).resolves.toMatchObject({ alreadyActive: false });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('propagates transactional generation-creation failures instead of continuing outside the transaction', async () => {
    const executeRaw = jest.fn().mockRejectedValue(new Error('insert-failed'));
    const { repository, transaction } = createRepository([[{ locked: true }], []], executeRaw);
    await expect(repository.begin(input)).rejects.toThrow('insert-failed');
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('serializes append with FOR UPDATE and treats an exact chunk replay as idempotent', async () => {
    const payloadSha256 = sha256(stableJson(record.normalizedPayload));
    const existing = {
      source_record_id: record.sourceRecordId,
      subject_ogrn: record.subjectOgrn,
      payload_sha256: payloadSha256,
      record_type: record.recordType,
    };
    const { repository, queryRaw, executeRaw } = createRepository([
      [generationRow],
      [],
      [generationRow],
      [existing],
    ]);

    await expect(repository.append(generationRow.id, [record])).resolves.toEqual({ inserted: 1, replayed: 0 });
    expect(sqlText(queryRaw.mock.calls[0][0])).toContain('FOR UPDATE');
    expect(executeRaw).toHaveBeenCalledTimes(2);

    await expect(repository.append(generationRow.id, [record])).resolves.toEqual({ inserted: 0, replayed: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('fails closed for non-staging generations, duplicate OGRNs and oversized chunks', async () => {
    const active = { ...generationRow, status: 'ACTIVE' };
    const activeRepo = createRepository([[active]]);
    await expect(activeRepo.repository.append(generationRow.id, [record]))
      .rejects.toThrow('FNS_EGRUL_GENERATION_NOT_STAGING');

    const duplicateRepo = createRepository([[generationRow]]);
    await expect(duplicateRepo.repository.append(generationRow.id, [record, record]))
      .rejects.toThrow('FNS_EGRUL_APPEND_DUPLICATE_OGRN');

    const oversizedRepo = createRepository([]);
    await expect(oversizedRepo.repository.append(generationRow.id, Array.from({ length: 501 }, () => record)))
      .rejects.toThrow('FNS_EGRUL_APPEND_SIZE_INVALID');
    expect(oversizedRepo.transaction).not.toHaveBeenCalled();
  });

  it('delegates activation and rejection to the canonical registry repository', async () => {
    const { repository, registry } = createRepository([]);
    await repository.activate(generationRow.id);
    await repository.reject(generationRow.id);
    expect(registry.validateAndActivate).toHaveBeenCalledWith(generationRow.id);
    expect(registry.reject).toHaveBeenCalledWith(generationRow.id);
  });
});