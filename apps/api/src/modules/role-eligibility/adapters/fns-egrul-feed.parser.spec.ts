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
    <СвПрекрЮЛ ДатаПрекрЮЛ="2026-08-31">
      <СпПрекрЮЛ КодСпПрекрЮЛ="407" НаимСпПрекрЮЛ="ЛИКВИДАЦИЯ ЮРИДИЧЕСКОГО ЛИЦА" />
      <СвРегОрг КодНО="7701" НаимНО="МЕЖРАЙОННАЯ ИФНС РОССИИ № 46 ПО Г. МОСКВЕ" />
      <ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-31" />
    </СвПрекрЮЛ>
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
        statusEnvelope: {
          classification: 'NO_VISIBLE_SPECIAL_STATUS',
        },
      },
    });
    expect(result.records[1].normalizedPayload.active).toBe(false);
    expect(result.records[1].normalizedPayload.status).toBe('TERMINATED');
    expect(result.records[1].normalizedPayload.statusEnvelope).toMatchObject({
      classification: 'TERMINATED',
      termination: {
        methodCode: '407',
        grn: '1234567890123',
        recordedAt: '2026-08-31',
      },
    });
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

  it('ignores fake record markup inside comments and CDATA', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05">
      <!-- <СвЮЛ ИНН="7812345675" ОГРН="1047796045770" ПолнНаимОПФ="FAKE"/> -->
      <![CDATA[<СвЮЛ ИНН="7812345675" ОГРН="1047796045770" PолнНаимОПФ="FAKE"/>]]>
      <СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"/>
    </EGRUL>`;
    const result = parseFnsEgrulXml(xml, '4.08');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].subjectOgrn).toBe('1027700132195');
  });

  it('never lets a nested referenced subject terminate or rename its parent', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05">
      <СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">
        <СвНаимЮЛ НаимЮЛПолн="ООО РОМАШКА"/>
        <СвВложенныйКонтекст>
          <СвЮЛ ИНН="7812345675" ОГРН="1047796045770" ПолнНаимОПФ="ЧУЖОЕ ЮЛ">
            <СвНаимЮЛ НаимЮЛПолн="ЧУЖОЕ ЮЛ"/>
            <СвПрекрЮЛ ДатаПрекрЮЛ="2026-08-31"/>
          </СвЮЛ>
        </СвВложенныйКонтекст>
      </СвЮЛ>
    </EGRUL>`;
    const [record] = parseFnsEgrulXml(xml, '4.08').records;
    expect(record.normalizedPayload.legalName).toBe('ООО РОМАШКА');
    expect(record.normalizedPayload.active).toBe(true);
    expect(record.normalizedPayload.statusEnvelope?.classification).toBe('NO_VISIBLE_SPECIAL_STATUS');
  });

  it('rejects duplicate/unquoted attributes and unsupported or XML-invalid entities', () => {
    const duplicate = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="X"/></EGRUL>';
    expect(() => parseFnsEgrulXml(duplicate, '4.08')).toThrow('FNS_EGRUL_XML_DUPLICATE_ATTRIBUTE');

    const unquoted = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН=7707083893 ОГРН="1027700132195" ПолнНаимОПФ="X"/></EGRUL>';
    expect(() => parseFnsEgrulXml(unquoted, '4.08')).toThrow('FNS_EGRUL_XML_ATTRIBUTE_SYNTAX_INVALID');

    const unsupported = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="A &copy; B"/></EGRUL>';
    expect(() => parseFnsEgrulXml(unsupported, '4.08')).toThrow('FNS_EGRUL_XML_ENTITY_UNSUPPORTED');

    const invalidNumeric = '<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="A &#0; B"/></EGRUL>';
    expect(() => parseFnsEgrulXml(invalidNumeric, '4.08')).toThrow('FNS_EGRUL_XML_ENTITY_INVALID');
  });

  it('rejects a transport declaration that contradicts windows-1251', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="X"/></EGRUL>';
    expect(() => parseFnsEgrulXml(xml, '4.08')).toThrow('FNS_EGRUL_XML_ENCODING_MISMATCH');
  });

  it('normalizes visible status, exclusion decision and PII-free reliability facts with provenance', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05">
      <СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">
        <СвСтатус>
          <СвСтатус КодСтатусЮЛ="105" НаимСтатусЮЛ="ПРИНЯТО РЕШЕНИЕ О ПРЕДСТОЯЩЕМ ИСКЛЮЧЕНИИ"/>
          <СвРешИсклЮЛ ДатаРеш="2026-08-01" НомерРеш="42" ДатаПубликации="2026-08-05"/>
          <ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-01"/>
        </СвСтатус>
        <СвАдресЮЛ>
          <СвНедАдресЮЛ ПризнНедАдресЮЛ="3" ГРН="1234567890124" ДатаЗап="2026-07-01"/>
        </СвАдресЮЛ>
        <СвУпрОрг>
          <СвНедДанУпрОрг ПризнНедДанУпрОрг="2">
            <ГРНДата ГРН="1234567890125" ДатаЗаписи="2026-07-02"/>
          </СвНедДанУпрОрг>
        </СвУпрОрг>
        <СведДолжнФЛ>
          <СвНедДанДолжнФЛ ПризнНедДанДолжнФЛ="1">
            <ГРНДата ДатаЗаписи="2026-07-03"/>
          </СвНедДанДолжнФЛ>
        </СведДолжнФЛ>
        <СвУчредит><УчрФЛ>
          <СвНедДанУчр ПризнНедДанУчр="1">
            <ГРНДата ДатаЗаписи="2026-07-04"/>
          </СвНедДанУчр>
        </УчрФЛ></СвУчредит>
      </СвЮЛ>
    </EGRUL>`;
    const [record] = parseFnsEgrulXml(xml, '4.08').records;
    expect(record.normalizedPayload.status).toBe('REVIEW_REQUIRED');
    expect(record.normalizedPayload.statusEnvelope).toMatchObject({
      classification: 'SPECIAL_STATUS',
      visibleStatuses: [{ code: '105', grn: '1234567890123', recordedAt: '2026-08-01' }],
      exclusionDecisions: [{ decisionDate: '2026-08-01', decisionNumber: '42' }],
      reliability: [
        { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ', grn: '1234567890124', recordedAt: '2026-07-01' },
        { area: 'MANAGEMENT', basisCode: '1', sourceTag: 'СвНедДанДолжнФЛ', grn: null, recordedAt: '2026-07-03' },
        { area: 'MANAGEMENT', basisCode: '2', sourceTag: 'СвНедДанУпрОрг', grn: '1234567890125', recordedAt: '2026-07-02' },
        { area: 'PARTICIPANT', basisCode: '1', sourceTag: 'СвНедДанУчр', grn: null, recordedAt: '2026-07-04' },
      ],
    });
  });

  it('makes reliability-only adverse EGRUL facts review-required', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СвАдресЮЛ><СвНедАдресЮЛ ПризнНедАдресЮЛ="2" ДатаЗап="2026-07-01"/></СвАдресЮЛ></СвЮЛ></EGRUL>`;
    const [record] = parseFnsEgrulXml(xml, '4.08').records;
    expect(record.normalizedPayload.active).toBe(false);
    expect(record.normalizedPayload.status).toBe('REVIEW_REQUIRED');
    expect(record.normalizedPayload.statusEnvelope).toMatchObject({
      classification: 'ADVERSE_RELIABILITY',
      reliability: [{ area: 'ADDRESS', basisCode: '2', grn: null, recordedAt: '2026-07-01' }],
    });
  });

  it('fails closed on visible management access restrictions and validates their provenance', () => {
    const valid = `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СведДолжнФЛ><ОгрДосСв ОгрДосСв="1"><ГРНДата ДатаЗаписи="2026-07-03"/></ОгрДосСв></СведДолжнФЛ></СвЮЛ></EGRUL>`;
    const [record] = parseFnsEgrulXml(valid, '4.08').records;
    expect(record.normalizedPayload.active).toBe(false);
    expect(record.normalizedPayload.statusEnvelope?.classification).toBe('RESTRICTED_OR_UNKNOWN');

    const malformed = `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СведДолжнФЛ><ОгрДосСв ОгрДосСв="1"/></СведДолжнФЛ></СвЮЛ></EGRUL>`;
    expect(() => parseFnsEgrulXml(malformed, '4.08')).toThrow('FNS_EGRUL_MANAGEMENT_RESTRICTION_INVALID');
  });

  it('enforces the 4.07-only liquidation-deadline restriction without rejecting valid 4.08 data', () => {
    const wrap = (status: string) => `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СвСтатус>${status}<ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-09-01"/></СвСтатус></СвЮЛ></EGRUL>`;
    const liquidation = '<СвСтатус КодСтатусЮЛ="101" НаимСтатусЮЛ="НАХОДИТСЯ В СТАДИИ ЛИКВИДАЦИИ" СрокЛиквООО="2026-12-01"/>';
    const other = '<СвСтатус КодСтатусЮЛ="105" НаимСтатусЮЛ="ПРИНЯТО РЕШЕНИЕ О ПРЕДСТОЯЩЕМ ИСКЛЮЧЕНИИ" СрокЛиквООО="2026-12-01"/>';

    expect(parseFnsEgrulXml(wrap(liquidation), '4.07').records[0].normalizedPayload.statusEnvelope?.visibleStatuses[0].liquidationDeadline)
      .toBe('2026-12-01');
    expect(parseFnsEgrulXml(wrap(liquidation), '4.08').records[0].normalizedPayload.statusEnvelope?.visibleStatuses[0].liquidationDeadline)
      .toBe('2026-12-01');
    expect(() => parseFnsEgrulXml(wrap(other), '4.07'))
      .toThrow('FNS_EGRUL_STATUS_LIQUIDATION_DEADLINE_NOT_ALLOWED');
  });

  it('rejects duplicate singular exclusion-decision blocks', () => {
    const decision = '<СвРешИсклЮЛ ДатаРеш="2026-08-01" НомерРеш="42"/>';
    const xml = `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА"><СвСтатус><СвСтатус КодСтатусЮЛ="105" НаимСтатусЮЛ="ПРИНЯТО РЕШЕНИЕ О ПРЕДСТОЯЩЕМ ИСКЛЮЧЕНИИ"/>${decision}${decision}<ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-01"/></СвСтатус></СвЮЛ></EGRUL>`;
    expect(() => parseFnsEgrulXml(xml, '4.08')).toThrow('FNS_EGRUL_DUPLICATE_СвРешИсклЮЛ');
  });

  it('fails closed on missing, duplicate, or ambiguous status-container provenance while allowing an omitted GRN', () => {
    const wrap = (statusBlock: string) => `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">${statusBlock}</СвЮЛ></EGRUL>`;
    const status = '<СвСтатус КодСтатусЮЛ="101" НаимСтатусЮЛ="НАХОДИТСЯ В СТАДИИ ЛИКВИДАЦИИ"/>';
    const grnDate = '<ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-09-01"/>';

    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус>${grnDate}</СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_CONTAINER_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус>${status}${status}${grnDate}</СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_CONTAINER_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус КодСтатусЮЛ="101">${status}${grnDate}</СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_CONTAINER_AMBIGUOUS');
    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус>${status}</СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус>${status}${grnDate}${grnDate}</СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвСтатус>${status}<ГРНДата ГРН="1234567890123"/></СвСтатус>`), '4.08'))
      .toThrow('FNS_EGRUL_STATUS_PROVENANCE_INVALID');

    const [withoutGrn] = parseFnsEgrulXml(
      wrap(`<СвСтатус>${status}<ГРНДата ДатаЗаписи="2026-09-01"/></СвСтатус>`),
      '4.08',
    ).records;
    expect(withoutGrn.normalizedPayload.statusEnvelope?.visibleStatuses[0]).toMatchObject({
      grn: null,
      recordedAt: '2026-09-01',
    });
  });

  it('preserves repeatable reorganization status and source provenance, including date-only GRNДата', () => {
    const xml = `<EGRUL ДатаВыг="2026-09-05">
      <СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">
        <СвРеорг>
          <СвСтатус КодСтатусЮЛ="121" НаимСтатусЮЛ="НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ"/>
          <ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-20"/>
          <СвРеоргЮЛ ОГРН="1047796045770" ИНН="7812345675" НаимЮЛПолн="УЧАСТНИК"/>
        </СвРеорг>
        <СвРеорг>
          <СвСтатус КодСтатусЮЛ="122" НаимСтатусЮЛ="РЕОРГАНИЗАЦИЯ В ФОРМЕ ПРИСОЕДИНЕНИЯ"/>
          <ГРНДата ДатаЗаписи="2026-08-21"/>
        </СвРеорг>
      </СвЮЛ>
    </EGRUL>`;
    const [record] = parseFnsEgrulXml(xml, '4.08').records;
    expect(record.normalizedPayload.active).toBe(false);
    expect(record.normalizedPayload.status).toBe('REVIEW_REQUIRED');
    expect(record.normalizedPayload.statusEnvelope).toMatchObject({
      classification: 'SPECIAL_STATUS',
      reorganizationPresent: true,
      reorganizations: [
        { code: '121', grn: '1234567890123', recordedAt: '2026-08-20', accessRestricted: false },
        { code: '122', grn: null, recordedAt: '2026-08-21', accessRestricted: false },
      ],
    });
  });

  it('rejects malformed reorganization blocks instead of reducing them to presence-only evidence', () => {
    const wrap = (reorganization: string) => `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">${reorganization}</СвЮЛ></EGRUL>`;
    const status = '<СвСтатус КодСтатусЮЛ="121" НаимСтатусЮЛ="НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ"/>';
    const grnDate = '<ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-20"/>';

    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${grnDate}</СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_STATUS_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${status}</СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${status}${status}${grnDate}</СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_STATUS_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${status}${grnDate}${grnDate}</СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${status}<ГРНДата ГРН="1234567890123"/></СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`<СвРеорг>${status}<ГРНДата ГРН="123" ДатаЗаписи="2026-08-20"/></СвРеорг>`), '4.08'))
      .toThrow('FNS_EGRUL_REORGANIZATION_PROVENANCE_INVALID');
  });

  it('requires complete termination method, registrar and record provenance while allowing an omitted GRN', () => {
    const wrap = (termination: string) => `<EGRUL ДатаВыг="2026-09-05"><СвЮЛ ИНН="7707083893" ОГРН="1027700132195" ПолнНаимОПФ="ООО РОМАШКА">${termination}</СвЮЛ></EGRUL>`;
    const method = '<СпПрекрЮЛ КодСпПрекрЮЛ="407" НаимСпПрекрЮЛ="ЛИКВИДАЦИЯ ЮРИДИЧЕСКОГО ЛИЦА"/>';
    const registrar = '<СвРегОрг КодНО="7701" НаимНО="МЕЖРАЙОННАЯ ИФНС РОССИИ № 46 ПО Г. МОСКВЕ"/>';
    const grnDate = '<ГРНДата ГРН="1234567890123" ДатаЗаписи="2026-08-31"/>';
    const start = '<СвПрекрЮЛ ДатаПрекрЮЛ="2026-08-31">';
    const end = '</СвПрекрЮЛ>';

    expect(() => parseFnsEgrulXml(wrap(`${start}${registrar}${grnDate}${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_METHOD_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`${start}${method}${grnDate}${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_REGISTRAR_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`${start}${method}${registrar}${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`${start}${method}${registrar}${grnDate}${grnDate}${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`${start}${method}${registrar}<ГРНДата ГРН="1234567890123"/>${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_PROVENANCE_INVALID');
    expect(() => parseFnsEgrulXml(wrap(`${start}${method}<СвРегОрг КодНО="77" НаимНО="КОРОТКО"/>${grnDate}${end}`), '4.08'))
      .toThrow('FNS_EGRUL_TERMINATION_REGISTRAR_INVALID');

    const [withoutGrn] = parseFnsEgrulXml(
      wrap(`${start}${method}${registrar}<ГРНДата ДатаЗаписи="2026-08-31"/>${end}`),
      '4.08',
    ).records;
    expect(withoutGrn.normalizedPayload.statusEnvelope?.termination).toMatchObject({
      grn: null,
      recordedAt: '2026-08-31',
      methodCode: '407',
    });
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
