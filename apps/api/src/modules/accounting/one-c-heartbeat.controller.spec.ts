import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator';
import { ONE_C_PROTOCOL_VERSION } from './one-c-connector.protocol';
import { OneCHeartbeatHealth } from './one-c-heartbeat.contract';
import {
  OneCConnectorHeartbeatController,
  OneCHeartbeatManagementController,
} from './one-c-heartbeat.controller';
import { OneCHeartbeatRepository } from './one-c-heartbeat.repository';

const MACHINE = `11111111-2222-4333-8444-555555555555.${'a'.repeat(43)}`;

describe('1C heartbeat HTTP boundary', () => {
  function fixture() {
    const repository = { record: jest.fn(), describe: jest.fn() } as unknown as OneCHeartbeatRepository;
    return {
      repository,
      machine: new OneCConnectorHeartbeatController(repository),
      human: new OneCHeartbeatManagementController(repository),
    };
  }

  it('is framework-public only at the machine handler and still requires the bearer', async () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE, OneCConnectorHeartbeatController.prototype.heartbeat)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE, OneCHeartbeatManagementController.prototype.describe)).not.toBe(true);
    const test = fixture();
    await expect(test.machine.heartbeat(undefined, {}, 'corr-1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(test.repository.record).not.toHaveBeenCalled();
  });

  it('refuses free-text or extra diagnostics before persistence', async () => {
    const test = fixture();
    await expect(test.machine.heartbeat(`Bearer ${MACHINE}`, {
      protocolVersion: ONE_C_PROTOCOL_VERSION,
      connectorVersion: '1.0.0',
      platformVersion: '8.3.27',
      configurationVersion: '3.0.170',
      health: OneCHeartbeatHealth.BLOCKED,
      diagnosticCodes: ['password=secret'],
    }, 'corr-2')).rejects.toBeInstanceOf(BadRequestException);
    expect(test.repository.record).not.toHaveBeenCalled();
  });
});
