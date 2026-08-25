import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ONE_C_COMMANDS } from './one-c-connector.protocol';

const sourceDir = join(__dirname, 'one-c-extension-source');
const http = readFileSync(join(sourceDir, 'TransparentPriceConnectorHttp.bsl'), 'utf8');
const commands = readFileSync(
  join(sourceDir, 'TransparentPriceConnectorCommands.bsl'),
  'utf8',
);
const adapter = readFileSync(
  join(sourceDir, 'TransparentPriceConfigurationAdapter.bsl'),
  'utf8',
);
const jobRepository = readFileSync(
  join(__dirname, 'one-c-job-runtime.repository.ts'),
  'utf8',
);

function withoutLineComments(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n');
}

const httpCode = withoutLineComments(http);
const commandCode = withoutLineComments(commands);
const adapterCode = withoutLineComments(adapter);

describe('1C extension outbound transport source', () => {
  it('pins one production host and makes only HTTPS with OS CA validation representable', () => {
    expect(httpCode).toContain(
      'СерверПлатформы = "xn----8sbjf4befbjgs9b.xn--p1ai"',
    );
    expect(httpCode).toContain('БазовыйПуть = "/connector/v1"');
    expect(httpCode).toContain('Новый СертификатыУдостоверяющихЦентровОС');
    expect(httpCode).toContain('Новый ЗащищенноеСоединениеOpenSSL');
    expect(httpCode).toContain('443');
    expect(httpCode.toLowerCase()).not.toContain('http://');
  });

  it('requires either the exact /connector/v1 base or its slash-delimited child path', () => {
    expect(httpCode).toContain('Путь <> БазовыйПуть');
    expect(httpCode).toContain(
      'Лев(Путь, СтрДлина(БазовыйПуть) + 1) <> БазовыйПуть + "/"',
    );
    expect(httpCode).toContain('СтрНайти(Путь, "://")');
    expect(httpCode).toContain('СтрНайти(Путь, "..")');
    expect(httpCode).toContain('PATH_REFUSED');
  });

  it('gates path, correlation, machine bearer and lease bearer before headers', () => {
    const pathGate = httpCode.indexOf('Если Не ДопустимыйПуть(Путь) Тогда');
    const correlationGate = httpCode.indexOf('БезопасныйCorrelation = БезопасныйCorrelationId');
    const bearerGate = httpCode.indexOf('БезопасныйBearer = БезопасныйMachineBearer');
    const leaseGate = httpCode.indexOf('БезопасныйLease = БезопасныйLeaseBearer');
    const authHeader = httpCode.indexOf(
      '"Authorization", "Bearer " + БезопасныйBearer',
    );
    const leaseHeader = httpCode.indexOf(
      '"X-One-C-Job-Lease", "Bearer " + БезопасныйLease',
    );
    expect(pathGate).toBeGreaterThanOrEqual(0);
    expect(correlationGate).toBeGreaterThan(pathGate);
    expect(bearerGate).toBeGreaterThan(correlationGate);
    expect(leaseGate).toBeGreaterThan(bearerGate);
    expect(authHeader).toBeGreaterThan(leaseGate);
    expect(leaseHeader).toBeGreaterThan(authHeader);
    expect(httpCode).toContain('CORRELATION_ID_REFUSED');
    expect(httpCode).toContain('BEARER_REFUSED');
    expect(httpCode).toContain('LEASE_BEARER_REFUSED');
  });

  it('pins exact UUID.secret bearer shape and bounded safe header alphabets', () => {
    expect(httpCode).toContain('Функция БезопасныйCorrelationId');
    expect(httpCode).toContain('БезопасныйИдентификатор(CorrelationId, 128)');
    expect(httpCode).toContain(
      'Допустимые = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:_.@-"',
    );

    expect(httpCode).toContain('Функция БезопасныйBearerФормат');
    expect(httpCode).toContain('СтрДлина(Bearer) <> 80');
    expect(httpCode).toContain('Сред(Bearer, 37, 1) <> "."');
    expect(httpCode).toContain(
      'ДопустимыеBase64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"',
    );
  });

  it('refuses redirects instead of allowing bearer forwarding', () => {
    expect(httpCode).toContain('КодHTTP >= 300 И КодHTTP < 400');
    expect(httpCode).toContain('REDIRECT_REFUSED');
    expect(httpCode).not.toContain('Location');
  });

  it('bounds methods, response size and ambiguous POST network failure', () => {
    expect(httpCode).toContain('МетодВерх <> "GET" И МетодВерх <> "POST"');
    expect(httpCode).toContain('RESPONSE_TOO_LARGE');
    expect(httpCode).toContain('СтрДлина(ТелоОтвета) > 2097152');
    expect(httpCode).toContain('NETWORK_AMBIGUOUS');
    expect(httpCode).toContain('UNKNOWN_RESULT');
  });

  it('implements every connector/v1 transport verb without inventing another endpoint family', () => {
    for (const fragment of [
      'БазовыйПуть + "/pair"',
      'БазовыйПуть + "/heartbeat"',
      'БазовыйПуть + "/jobs"',
      '"/ack"',
      '"/result"',
      '"/fail"',
    ]) {
      expect(httpCode).toContain(fragment);
    }
    expect(httpCode).not.toContain('/connector/v2');
  });

  it('never records a bearer, pairing code or provider body through a BSL log call', () => {
    for (const source of [httpCode, commandCode, adapterCode]) {
      expect(source).not.toMatch(/ЗаписьЖурналаРегистрации\s*\(/u);
      expect(source).not.toMatch(/Сообщить\s*\(/u);
    }
  });

  it('refuses unsafe job ids rather than interpolating arbitrary path input', () => {
    expect(httpCode).toContain('БезопасныйИдентификаторURL');
    expect(httpCode).toContain('JOB_ID_REFUSED');
    expect(httpCode).not.toContain('КодироватьСтроку(JobId');
  });

  it('bounds pairing codes and terminal metadata instead of accepting arbitrary strings', () => {
    expect(httpCode).toContain('СтрДлина(СокрЛП(ОдноразовыйКод)) > 256');
    expect(httpCode).toContain('БезопасныйМашинныйКод(ResultCode)');
    expect(httpCode).toContain('RESULT_CODE_REFUSED');
    expect(httpCode).toContain('СтрДлина(Идентификатор) > 240');
  });

  it('sends exact durable-runtime receipt bodies and lease header', () => {
    expect(httpCode).toContain('Тело.Вставить("idempotencyKey"');
    expect(httpCode).toContain('Тело.Вставить("payloadHash"');
    expect(httpCode).toContain('Тело.Вставить("revision"');
    expect(httpCode).toContain('Тело.Вставить("attempt"');
    expect(httpCode).toContain('Тело.Вставить("resultState"');
    expect(httpCode).toContain('Тело.Вставить("externalEvidenceId"');
    expect(httpCode).toContain('Тело.Вставить("failureClass"');
    expect(httpCode).toContain('Тело.Вставить("effectState"');
    expect(httpCode).not.toContain('Тело.Вставить("lease"');
    expect(httpCode).not.toContain('Тело.Вставить("outcome"');
  });

  it('validates receipt hash and counters against the server bounds', () => {
    expect(httpCode).toContain('СтрДлина(PayloadHash) <> 64');
    expect(httpCode).toContain('БезопасноеЦелое(Revision, 9007199254740991)');
    expect(httpCode).toContain('БезопасноеЦелое(Attempt, 100)');
  });

  it('does not persist or define plaintext credential storage in the transport source', () => {
    expect(httpCode).not.toMatch(/Констант[аы].*Bearer/iu);
    expect(httpCode).not.toMatch(/РегистрСведений.*Bearer/iu);
    expect(httpCode).not.toMatch(/ХранилищеЗначения.*Bearer/iu);
  });
});

describe('1C extension typed command dispatcher', () => {
  it('dispatches exactly the same seven commands as the server protocol', () => {
    const bslCommands = [
      ...commandCode.matchAll(/Команды\.Добавить\("([A-Z_]+)"\)/gu),
    ].map((match) => match[1]);
    expect(bslCommands).toEqual(ONE_C_COMMANDS);
  });

  it('does not expose arbitrary SQL/code/dump or dynamic execution primitives', () => {
    expect(commandCode).not.toMatch(/Вычислить\s*\(/u);
    expect(commandCode).not.toMatch(/Выполнить\s*\(/u);
    expect(commandCode).not.toMatch(/DROP\s+TABLE/iu);
    expect(commandCode).not.toMatch(/SELECT\s+\*/iu);
    expect(commandCode).not.toMatch(/DATABASE_DUMP/iu);
    expect(commandCode).not.toMatch(/RUN_SQL/iu);
  });

  it('requires the exact leased job envelope needed for durable receipts', () => {
    for (const field of [
      'id',
      'command',
      'payload',
      'payloadHash',
      'idempotencyKey',
      'correlationId',
      'organizationId',
      'connectionId',
      'revision',
      'attempt',
      'leaseBearer',
      'leaseExpiresAt',
    ]) {
      expect(commandCode).toContain(`Обязательные.Добавить("${field}")`);
    }
  });

  it('derives stable per-lease ACK/result/fail idempotency keys', () => {
    expect(commandCode).toContain('Функция КлючКвитанции');
    expect(commandCode).toContain('Лев(БезопасныйLease, 36)');
    for (const suffix of ['ack', 'result', 'fail']) {
      expect(commandCode).toContain(`КлючКвитанции(LeaseBearer, "${suffix}")`);
    }
  });

  it('ACKs a valid lease before the configuration adapter is allowed to execute', () => {
    const ack = commandCode.indexOf('TransparentPriceConnectorHttp.ПодтвердитьЗадание');
    const execute = commandCode.indexOf('ВыполнитьТипизированнуюКоманду(Job)', ack);
    expect(ack).toBeGreaterThanOrEqual(0);
    expect(execute).toBeGreaterThan(ack);
  });

  it('requires adapter-origin external evidence before reporting connector success', () => {
    expect(commandCode).toContain('EXTERNAL_EVIDENCE_MISSING');
    expect(commandCode).toContain('ОтправитьРезультатЗадания');
    expect(httpCode).toContain('EXTERNAL_EVIDENCE_REQUIRED');
    expect(commandCode).toContain('RESULT_STATE_MISSING');
    expect(httpCode).toContain('ResultState <> "CREATED_IN_1C"');
  });

  it('returns payloadHash in every server lease so the client can echo it', () => {
    expect(jobRepository).toContain('readonly payloadHash: string;');
    expect(jobRepository).toContain('payloadHash: row.payloadHash');
  });

  it('keeps the reference configuration adapter fail-closed until a profile is accepted', () => {
    expect(adapterCode).toContain('CONFIGURATION_ADAPTER_NOT_IMPLEMENTED');
    expect(adapterCode).toContain('"outcome", "UNKNOWN_RESULT"');
    expect(adapterCode).not.toContain('"outcome", "REPORTED_SUCCESS"');

    for (const method of [
      'ОбновитьКонтрагента',
      'СоздатьЧерновикПродажи',
      'СоздатьЧерновикПокупки',
      'СоздатьЧерновикИсправления',
      'ПолучитьСтатусДокумента',
      'ПередатьСтатусОплаты',
      'ПолучитьКандидатовСправочника',
    ]) {
      expect(adapterCode).toContain(`Функция ${method}(Payload) Экспорт`);
    }
  });
});
