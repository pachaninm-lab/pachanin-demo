import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('restricted public Qwen transport cancellation contract', () => {
  const source = readFileSync(join(__dirname, 'restricted-public-qwen.controller.ts'), 'utf8');

  it('binds cancellation to the client socket rather than normal request completion', () => {
    expect(source).toContain("request.socket.on('close', onClientDisconnect)");
    expect(source).toContain("request.socket.off('close', onClientDisconnect)");
    expect(source).not.toContain("request.on('close'");
  });

  it('still aborts the model and abandons the public stream on a real transport loss', () => {
    expect(source).toContain('const onClientDisconnect = () => {');
    expect(source).toContain('aborter.abort();');
    expect(source).toContain('writer.abandon();');
  });
});
