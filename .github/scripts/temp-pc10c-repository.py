from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return source.replace(old, new)


path = Path('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts')
source = path.read_text()
old = """type AuditRow = Readonly<{
  id: string;
  authorizationId: string;
  operationCode: string;
  requestSha256: string;
  decision: string;"""
new = """type AuditRow = Readonly<{
  id: string;
  authorizationId: string;
  operationCode: string;
  correlationId: string;
  requestReference: string;
  requestSha256: string;
  decision: string;"""
if old in source:
    source = replace_once(source, old, new, 'AuditRow replay binding')
elif 'correlationId: string;\n  requestReference: string;\n  requestSha256: string;' not in source:
    raise SystemExit('AuditRow replay fields missing')

old = """        const replay = await this.findReplay(tx, context, input.idempotencyKey);
        if (replay) return { replay, context, authorization: null, configuration: null } as const;
        const authorization = await this.lockAuthorization(tx, context, input.authorizationId);
        if (authorization.version !== BigInt(input.authorizationVersion)) {
          throw new PreconditionFailedException('Authorization version changed');
        }"""
new = """        const authorization = await this.lockAuthorization(tx, context, input.authorizationId);
        if (authorization.version !== BigInt(input.authorizationVersion)) {
          throw new PreconditionFailedException('Authorization version changed');
        }
        const replay = await this.findReplay(tx, context, input.idempotencyKey);
        if (replay) {
          return {
            replay,
            context,
            authorization: null,
            configuration: null,
            denial: null,
          } as const;
        }"""
if old in source:
    source = replace_once(source, old, new, 'replay authorization order')
elif 'denial: null' not in source or source.find('lockAuthorization') > source.find('findReplay'):
    raise SystemExit('replay authorization order missing')

old = """        if (authorization.status !== 'READ_ONLY_ATTESTED') {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'AUTHORIZATION_NOT_ATTESTED',
          });
          throw new ForbiddenException('FGIS Grain read authorization is not externally attested');
        }"""
new = """        if (authorization.status !== 'READ_ONLY_ATTESTED') {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'AUTHORIZATION_NOT_ATTESTED',
          });
          return {
            replay: null,
            context,
            authorization: null,
            configuration: null,
            denial: 'FGIS Grain read authorization is not externally attested',
          } as const;
        }"""
if old in source:
    source = replace_once(source, old, new, 'status denial commit')
elif "denial: 'FGIS Grain read authorization is not externally attested'" not in source:
    raise SystemExit('status denial commit patch missing')

old = """        if (
          authorization.validUntil.getTime() <= Date.now()
          || !authorization.attestationValidUntil
          || authorization.attestationValidUntil.getTime() <= Date.now()
        ) {
          throw new ForbiddenException('FGIS Grain read authorization or attestation expired');
        }"""
new = """        if (
          authorization.validUntil.getTime() <= Date.now()
          || !authorization.attestationValidUntil
          || authorization.attestationValidUntil.getTime() <= Date.now()
        ) {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'AUTHORIZATION_OR_ATTESTATION_EXPIRED',
          });
          return {
            replay: null,
            context,
            authorization: null,
            configuration: null,
            denial: 'FGIS Grain read authorization or attestation expired',
          } as const;
        }"""
if old in source:
    source = replace_once(source, old, new, 'expiry denial evidence')
elif 'AUTHORIZATION_OR_ATTESTATION_EXPIRED' not in source:
    raise SystemExit('expiry denial evidence patch missing')

old = """        if (!authorization.allowedOperations.includes(input.operationCode)) {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'OPERATION_NOT_AUTHORIZED',
          });
          throw new ForbiddenException('Operation is outside tenant authorization');
        }"""
new = """        if (!authorization.allowedOperations.includes(input.operationCode)) {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'OPERATION_NOT_AUTHORIZED',
          });
          return {
            replay: null,
            context,
            authorization: null,
            configuration: null,
            denial: 'Operation is outside tenant authorization',
          } as const;
        }"""
if old in source:
    source = replace_once(source, old, new, 'operation denial commit')
elif "denial: 'Operation is outside tenant authorization'" not in source:
    raise SystemExit('operation denial commit patch missing')

old = '        return { replay: null, context, authorization, configuration } as const;'
new = """        return {
          replay: null,
          context,
          authorization,
          configuration,
          denial: null,
        } as const;"""
if old in source:
    source = replace_once(source, old, new, 'preflight success shape')
elif 'configuration,\n          denial: null' not in source:
    raise SystemExit('preflight success shape missing')

old = """    if (preflight.replay) return this.replayReceipt(preflight.replay, input);
    if (!preflight.authorization || !preflight.configuration) {"""
new = """    if (preflight.replay) return this.replayReceipt(preflight.replay, input);
    if (preflight.denial) throw new ForbiddenException(preflight.denial);
    if (!preflight.authorization || !preflight.configuration) {"""
if old in source:
    source = replace_once(source, old, new, 'post-commit denial throw')
elif 'if (preflight.denial)' not in source:
    raise SystemExit('post-commit denial throw missing')

old = """      row.authorizationId !== input.authorizationId
      || row.operationCode !== input.operationCode
      || row.requestSha256 !== input.requestSha256"""
new = """      row.authorizationId !== input.authorizationId
      || row.operationCode !== input.operationCode
      || row.correlationId !== input.correlationId
      || row.requestReference !== input.requestReference
      || row.requestSha256 !== input.requestSha256"""
if old in source:
    source = replace_once(source, old, new, 'replay exact command binding')
elif 'row.correlationId !== input.correlationId' not in source:
    raise SystemExit('replay exact command binding missing')

old = """      SELECT "id", "authorizationId", "operationCode", "requestSha256",
             "decision", "providerRequestId", "responseReference","""
new = """      SELECT "id", "authorizationId", "operationCode", "correlationId",
             "requestReference", "requestSha256", "decision", "providerRequestId", "responseReference","""
if old in source:
    source = replace_once(source, old, new, 'replay SELECT binding')
elif '"requestReference", "requestSha256", "decision"' not in source:
    raise SystemExit('replay SELECT binding missing')

path.write_text(source)
