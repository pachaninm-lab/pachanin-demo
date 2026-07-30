from pathlib import Path

path = Path('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts')
source = path.read_text()
for required in [
    'correlationId: string;',
    'requestReference: string;',
    'const authorization = await this.lockAuthorization',
    'const replay = await this.findReplay',
    "reasonCode: 'AUTHORIZATION_NOT_ATTESTED'",
    "reasonCode: 'AUTHORIZATION_OR_ATTESTATION_EXPIRED'",
    "reasonCode: 'OPERATION_NOT_AUTHORIZED'",
    'denial: null',
    'if (preflight.denial)',
    'row.correlationId !== input.correlationId',
    'row.requestReference !== input.requestReference',
    '"requestReference", "requestSha256", "decision"',
]:
    if required not in source:
        raise SystemExit(f'repository hardening missing: {required}')
if source.find('const authorization = await this.lockAuthorization') > source.find('const replay = await this.findReplay'):
    raise SystemExit('replay can bypass current authorization version')
path.write_text(source)
