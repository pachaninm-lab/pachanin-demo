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
 * operation will require that bearer and is intentionally absent from this
 * controller until the job/heartbeat runtime slice is accepted.
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

  const code = body.code;
  if (typeof code !== 'string' || code.length < 16 || code.length > 256) {
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

  for (const key of [
    'platformVersion',
    'configurationName',
    'configurationVersion',
    'databaseInstanceId',
    'connectorVersion',
    'protocolVersion',
  ] as const) {
    if (typeof discovery[key] !== 'string') {
      throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
    }
  }

  if (!Array.isArray(discovery.organizations) || !Array.isArray(discovery.capabilities)) {
    throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
  }

  const organizations: OneCDiscoveryOrganization[] = discovery.organizations.map((rawOrg) => {
    const organization = record(rawOrg, 'ONE_C_PAIRING_DISCOVERY_INVALID');
    exactKeys(organization, ['guid', 'inn', 'kpp', 'name'], 'ONE_C_PAIRING_DISCOVERY_INVALID', true);
    if (
      typeof organization.guid !== 'string'
      || typeof organization.inn !== 'string'
      || typeof organization.name !== 'string'
      || !(
        organization.kpp === undefined
        || organization.kpp === null
        || typeof organization.kpp === 'string'
      )
    ) {
      throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
    }
    return {
      guid: organization.guid,
      inn: organization.inn,
      kpp: organization.kpp ?? null,
      name: organization.name,
    };
  });

  if (discovery.capabilities.some((value) => typeof value !== 'string')) {
    throw new BadRequestException({ code: 'ONE_C_PAIRING_DISCOVERY_INVALID' });
  }

  return {
    code,
    discovery: {
      platformVersion: discovery.platformVersion,
      configurationName: discovery.configurationName,
      configurationVersion: discovery.configurationVersion,
      databaseInstanceId: discovery.databaseInstanceId,
      organizations,
      capabilities: discovery.capabilities as OneCSelfDiscovery['capabilities'],
      connectorVersion: discovery.connectorVersion,
      protocolVersion: discovery.protocolVersion,
    },
  };
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code });
  }
  return value as Record<string, unknown>;
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
