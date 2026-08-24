import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Headers,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import {
  OneCProtocolValidationError,
  type OneCCommand,
  type OneCDiscoveryOrganization,
  type OneCSelfDiscovery,
} from './one-c-connector.protocol';
import {
  OneCRuntimeRepository,
  OneCRuntimeRepositoryError,
} from './one-c-runtime.repository';

/**
 * Connector-facing bootstrap surface.
 *
 * Pairing is the one unauthenticated connector operation: possession of the
 * high-entropy, short-lived one-time code is the bootstrap credential. It is
 * IP-rate-limited and returns a machine bearer once. Every later connector
 * operation requires that bearer and lives in the dedicated heartbeat/job
 * controllers; events and mappings remain closed.
 */
@Controller('connector/v1')
export class OneCConnectorController {
  constructor(private readonly runtime: OneCRuntimeRepository) {}

  @Public()
  @Post('pair')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'one_c_connector_pair',
    scope: 'ip',
    limit: 8,
    windowSeconds: 300,
  })
  async pair(
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const body = parsePairingBody(rawBody);
    try {
      return await this.runtime.consumePairing({
        pairingCode: body.code,
        discovery: body.discovery,
        correlationId: safeCorrelationId(correlationId),
      });
    } catch (error) {
      if (error instanceof OneCRuntimeRepositoryError) {
        throw new BadRequestException({ code: error.code });
      }
      if (error instanceof OneCProtocolValidationError) {
        throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
      }
      throw error;
    }
  }
}

function parsePairingBody(raw: unknown): {
  code: string;
  discovery: OneCSelfDiscovery;
} {
  const body = record(raw, 'ONE_C_PAIRING_BODY_INVALID');
  exactKeys(body, ['code', 'discovery'], 'ONE_C_PAIRING_BODY_INVALID');

  const code = requiredString(body, 'code', 'ONE_C_PAIRING_CODE_INVALID');
  if (code.length < 16 || code.length > 256) {
    throw new BadRequestException({ code: 'ONE_C_PAIRING_CODE_INVALID' });
  }

  const discovery = record(body.discovery, 'ONE_C_PAIRING_DISCOVERY_INVALID');
  exactKeys(
    discovery,
    [
      'platformVersion',
      'configurationName',
      'configurationVersion',
      'databaseInstanceId',
      'organizations',
      'capabilities',
      'connectorVersion',
      'protocolVersion',
    ],
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );

  const platformVersion = requiredString(
    discovery,
    'platformVersion',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );
  const configurationName = requiredString(
    discovery,
    'configurationName',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );
  const configurationVersion = requiredString(
    discovery,
    'configurationVersion',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );
  const databaseInstanceId = requiredString(
    discovery,
    'databaseInstanceId',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );
  const connectorVersion = requiredString(
    discovery,
    'connectorVersion',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );
  const protocolVersion = requiredString(
    discovery,
    'protocolVersion',
    'ONE_C_PAIRING_DISCOVERY_INVALID',
  );

  if (!Array.isArray(discovery.organizations) || !Array.isArray(discovery.capabilities)) {
    throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
  }

  const organizations: OneCDiscoveryOrganization[] = discovery.organizations.map((rawOrg) => {
    const organization = record(rawOrg, 'ONE_C_PAIRING_DISCOVERY_INVALID');
    exactKeys(
      organization,
      ['guid', 'inn', 'kpp', 'name'],
      'ONE_C_PAIRING_DISCOVERY_INVALID',
      true,
    );
    const guid = requiredString(organization, 'guid', 'ONE_C_PAIRING_DISCOVERY_INVALID');
    const inn = requiredString(organization, 'inn', 'ONE_C_PAIRING_DISCOVERY_INVALID');
    const name = requiredString(organization, 'name', 'ONE_C_PAIRING_DISCOVERY_INVALID');
    const rawKpp = organization.kpp;
    if (rawKpp !== undefined && rawKpp !== null && typeof rawKpp !== 'string') {
      throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
    }
    const kpp: string | null = typeof rawKpp === 'string' ? rawKpp : null;
    return { guid, inn, kpp, name };
  });

  if (discovery.capabilities.some((value) => typeof value !== 'string')) {
    throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
  }
  const capabilities = discovery.capabilities as OneCCommand[];

  return {
    code,
    discovery: {
      platformVersion,
      configurationName,
      configurationVersion,
      databaseInstanceId,
      organizations,
      capabilities,
      connectorVersion,
      protocolVersion,
    },
  };
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code });
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  code: string,
): string {
  const candidate = value[key];
  if (typeof candidate !== 'string') throw new BadRequestException({ code });
  return candidate;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: string,
  optionalKpp = false,
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new BadRequestException({ code });
  }
  for (const key of allowed) {
    if (optionalKpp && key === 'kpp') continue;
    if (!(key in value)) throw new BadRequestException({ code });
  }
}

function safeCorrelationId(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  return /^[A-Za-z0-9:_.@-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}
