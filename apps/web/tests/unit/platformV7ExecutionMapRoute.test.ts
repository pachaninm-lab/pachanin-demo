import { PLATFORM_V7_EXECUTION_MAP_ROUTE } from '@/lib/platform-v7/routes';
import { PLATFORM_V7_COMMAND_SECTION_ITEMS } from '@/lib/platform-v7/command';

describe('platform-v7 execution map route contract', () => {
  it('keeps the execution map route stable', () => {
    expect(PLATFORM_V7_EXECUTION_MAP_ROUTE).toBe('/platform-v7/execution-map');
  });

  it('keeps the command entry pointed to the execution map route', () => {
    const command = PLATFORM_V7_COMMAND_SECTION_ITEMS.find((item) => item.id === 'sec-execution-map');
    expect(command).toBeTruthy();
    expect(command?.href).toBe(PLATFORM_V7_EXECUTION_MAP_ROUTE);
  });
});
