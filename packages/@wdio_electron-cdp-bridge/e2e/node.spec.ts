import { spawn } from 'node:child_process';

import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CdpBridge } from '../src/bridge.js';

const port = await getPort();

describe('E2E test for CdpBridge', () => {
  let child: ReturnType<typeof spawn>;
  let client: CdpBridge;

  beforeAll(() => {
    child = spawn('node', [
      `--inspect-brk=localhost:${port}`,
      '-e',
      `const obj = {
                    hello: "world",
                  };
                  debugger;
                  console.log("end");`,
    ]);
    client = new CdpBridge({
      port: port,
      timeout: 10000,
    });
  });

  afterAll(() => {
    client.close();
    child.kill();
  });

  it('should receive the event', async () => {
    let params: unknown;
    client.on('Runtime.executionContextCreated', (event) => {
      params = event;
    });

    await client.connect();

    await client.send('Runtime.enable');
    await client.send('Runtime.disable');
    expect(params).toBeTruthy();
  });

  it('should receive the return value', async () => {
    await client.connect();

    const result = await client.send('Runtime.evaluate', {
      expression: '1 + 2',
    });
    expect(result).toBeTruthy();
    expect(result.result.value).toBe(3);
  });
});
