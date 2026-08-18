import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ONE_C_COMMANDS } from './one-c-connector.protocol';

const sourceDir = join(__dirname, 'one-c-extension-source');
const discovery = readFileSync(
  join(sourceDir, 'TransparentPriceConnectorDiscovery.bsl'),
  'utf8',
);
const adapter = readFileSync(
  join(sourceDir, 'TransparentPriceConfigurationAdapter.bsl'),
  'utf8',
);

function withoutComments(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n');
}

const discoveryCode = withoutComments(discovery);
const adapterCode = withoutComments(adapter);

describe('1C connector self-discovery source', () => {
  it('builds the exact server discovery field vocabulary', () => {
    for (const field of [
      'platformVersion',
      'configurationName',
      'configurationVersion',
      'databaseInstanceId',
      'organizations',
      'capabilities',
      'connectorVersion',
      'protocolVersion',
    ]) {
      expect(discoveryCode).toContain(`Discovery.Вставить("${field}"`);
    }
  });

  it('gets platform version from SystemInformation and does not send a connection string', () => {
    expect(discoveryCode).toContain('Новый СистемнаяИнформация');
    expect(discoveryCode).toContain('СистемнаяИнформация.ВерсияПриложения');
    expect(discoveryCode).not.toContain('СтрокаСоединенияИнформационнойБазы');
    expect(discoveryCode).not.toContain('ConnectionString');
    expect(discoveryCode).not.toContain('connectionString');
  });

  it('requires configuration-specific discovery instead of assuming one universal Organizations object', () => {
    expect(discoveryCode).toContain(
      'TransparentPriceConfigurationAdapter.ПолучитьПрофильDiscovery()',
    );
    expect(adapterCode).toContain('Функция ПолучитьПрофильDiscovery() Экспорт');
    expect(adapterCode).toContain('"ready", Ложь');
    expect(adapterCode).toContain('CONFIGURATION_DISCOVERY_NOT_IMPLEMENTED');
  });

  it('requires at least one bounded legal entity and unique GUIDs', () => {
    expect(discoveryCode).toContain('ORGANIZATIONS_EMPTY');
    expect(discoveryCode).toContain('ORGANIZATIONS_LIMIT_EXCEEDED');
    expect(discoveryCode).toContain('Организации.Количество() > 500');
    expect(discoveryCode).toContain('ORGANIZATION_GUID_DUPLICATE');
    expect(discoveryCode).toContain('УникальныеGUID');
  });

  it('requires bounded opaque database identity and structured organization facts', () => {
    expect(discoveryCode).toContain('DATABASE_INSTANCE_ID_INVALID');
    expect(discoveryCode).toContain(
      'TransparentPriceConnectorHttp.БезопасныйИдентификаторURL',
    );
    expect(discoveryCode).toContain('ORGANIZATION_INN_INVALID');
    expect(discoveryCode).toContain('ORGANIZATION_KPP_INVALID');
    expect(discoveryCode).toContain('ORGANIZATION_NAME_INVALID');
  });

  it('uses the exact seven server commands as discovery capabilities', () => {
    expect(discoveryCode).toContain(
      'TransparentPriceConnectorCommands.РазрешенныеКоманды()',
    );
    // The actual equality is already pinned by one-c-extension-source.contract;
    // this additionally prevents discovery from maintaining a second list.
    expect(ONE_C_COMMANDS).toHaveLength(7);
    expect(discoveryCode).not.toMatch(/capabilities.*RUN_SQL/iu);
  });

  it('pins connector/protocol version and blocks pairing until discovery is ready', () => {
    expect(discoveryCode).toContain('ВерсияКоннектора = "1.0.0"');
    expect(discoveryCode).toContain('ВерсияПротокола = "1"');
    const collect = discoveryCode.indexOf('DiscoveryResult = СобратьDiscovery()');
    const readyGate = discoveryCode.indexOf(
      'Если DiscoveryResult.ready <> Истина Тогда',
      collect,
    );
    const pairing = discoveryCode.indexOf(
      'TransparentPriceConnectorHttp.ВыполнитьPairing',
      collect,
    );
    expect(collect).toBeGreaterThanOrEqual(0);
    expect(readyGate).toBeGreaterThan(collect);
    expect(pairing).toBeGreaterThan(readyGate);
  });

  it('keeps discovery free of passwords, OAuth tokens, secrets and broad database reads', () => {
    expect(discoveryCode).not.toMatch(/password|парол/iu);
    expect(discoveryCode).not.toMatch(/oauth|refresh.?token|client.?secret/iu);
    expect(discoveryCode).not.toMatch(/SELECT\s+\*/iu);
    expect(discoveryCode).not.toMatch(/Выполнить\s*\(/u);
    expect(discoveryCode).not.toMatch(/Вычислить\s*\(/u);
  });
});
