import { deduplicateCbrAuthorityRecords, parseCbrAuthorityRow } from './cbr-registry.adapter';

describe('CBR Role Eligibility authority row parsing', () => {
  it('skips official legacy liquidated rows that have no OGRN', () => {
    expect(parseCbrAuthorityRow([
      '1015',
      '',
      '1117',
      '',
      'Крестьянский Земельный Банк (КЗБ)',
      'ТОО (Паевое)',
      '07.12.1990',
      'Ликвидация',
      '',
    ])).toBeNull();
  });

  it('still fails closed when a non-empty OGRN is malformed', () => {
    expect(() => parseCbrAuthorityRow([
      '1',
      '',
      '2659',
      '12345',
      'ООО КБ "Тест"',
      'ООО (Паевое)',
      '21.01.1994',
      'Действующая',
      'Москва',
    ])).toThrow('CBR_ROW_IDENTITY_SCHEMA_CHANGED');
  });

  it('keeps a valid current credit organization as authoritative evidence', () => {
    expect(parseCbrAuthorityRow([
      '1',
      '',
      '2659',
      '1022200531484',
      'ООО КБ "Алтайкапиталбанк"',
      'ООО (Паевое)',
      '21.01.1994',
      'Действующая',
      '656043, Алтайский край',
    ])).toMatchObject({
      sourceRecordId: '2659:1022200531484',
      subjectOgrn: '1022200531484',
      recordType: 'CREDIT_ORGANIZATION',
      normalizedPayload: {
        registrationNumber: '2659',
        ogrn: '1022200531484',
        active: true,
        licenseValid: true,
      },
    });
  });

  it('collapses repeated official rows only when normalized authority evidence is identical', () => {
    const first = parseCbrAuthorityRow([
      '1',
      '',
      '2659',
      '1022200531484',
      'ООО КБ "Алтайкапиталбанк"',
      'ООО (Паевое)',
      '21.01.1994',
      'Действующая',
      '656043, Алтайский край',
    ]);
    const repeated = parseCbrAuthorityRow([
      '2',
      '',
      '2659',
      '1022200531484',
      'ООО КБ "Алтайкапиталбанк"',
      'ООО (Паевое)',
      '21.01.1994',
      'Действующая',
      '656043, Алтайский край',
    ]);

    expect(first).not.toBeNull();
    expect(repeated).not.toBeNull();
    expect(deduplicateCbrAuthorityRecords([first!, repeated!])).toEqual([first]);
  });

  it('fails closed when the same CBR source identity carries conflicting authority evidence', () => {
    const active = parseCbrAuthorityRow([
      '1',
      '',
      '2659',
      '1022200531484',
      'ООО КБ "Алтайкапиталбанк"',
      'ООО (Паевое)',
      '21.01.1994',
      'Действующая',
      '656043, Алтайский край',
    ]);
    const revoked = parseCbrAuthorityRow([
      '2',
      '',
      '2659',
      '1022200531484',
      'ООО КБ "Алтайкапиталбанк"',
      'ООО (Паевое)',
      '21.01.1994',
      'Отозванная',
      '656043, Алтайский край',
    ]);

    expect(active).not.toBeNull();
    expect(revoked).not.toBeNull();
    expect(() => deduplicateCbrAuthorityRecords([active!, revoked!])).toThrow('CBR_DUPLICATE_SOURCE_RECORD_CONFLICT');
  });
});
