import { beforeEach, describe, it, expect, vi } from 'vitest';

import log from '@wdio/electron-utils/log';

import { CdpBridge } from '../src/bridge.js';
import { DevTool } from '../src/dev-tool.js';
import { ERROR_MESSAGE } from '../src/constants.js';

import type { WdioCdpBridge } from '../src/types.js';

vi.mock('@wdio/electron-utils/log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

const mockOn = vi.fn().mockImplementation((state, callback) => {
  if (state === 'on') {
    callback();
  } else if (state === 'open') {
    callback();
  }
});
const mockOnce = vi.fn();
vi.mock('ws', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ws')>();

  return {
    ...actual,
    default: class mockWebSocket {
      /** The connection is not yet open. */
      static CONNECTING = 0;
      /** The connection is open and ready to communicate. */
      static OPEN = 1;
      /** The connection is in the process of closing. */
      static CLOSING = 2;
      /** The connection is closed. */
      static CLOSED = 3;
      readyState = 1;
      cons = vi.fn();
      send = vi.fn();
      close = vi.fn();
      on = mockOn;
      once = mockOnce;
    },
  };
});

let debuggerList: { webSocketDebuggerUrl: string }[] | undefined = undefined;
vi.mock('../src/dev-tool', () => {
  return {
    DevTool: vi.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const executeEventCallback = (calls: any[][], eventName: string, ...args: any[]) => {
  const callback = calls.filter(([event]) => event === eventName)[0][1];
  callback(...args);
};

describe('CdpBridge', () => {
  beforeEach(() => {
    vi.mocked(DevTool).mockImplementation(
      () =>
        ({
          list: vi.fn(async () => debuggerList),
        }) as unknown as DevTool,
    );
  });

  describe('connect', () => {
    it('should connect successfully without errors', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await expect(client.connect()).resolves.toBeUndefined();
      await expect(client.connect()).resolves.toBeUndefined();
    });

    it('should connect successfully without errors after retry', async () => {
      let retry: number = 0;
      vi.mocked(DevTool).mockImplementation(() => {
        retry++;
        if (retry < 3) {
          throw Error('Dummy Error');
        }
        return {
          list: vi.fn(async () => [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }] as WdioCdpBridge.DebuggerList),
        } as unknown as DevTool;
      });
      const client = new CdpBridge({ waitInterval: 10 });

      await expect(client.connect()).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith('Connection attempt 1 failed: Dummy Error');
      expect(log.warn).toHaveBeenCalledWith('Retry 1/3 to connect after 10ms...');
      expect(log.warn).toHaveBeenCalledWith('Connection attempt 2 failed: Dummy Error');
      expect(log.warn).toHaveBeenCalledWith('Retry 2/3 to connect after 10ms...');
    });

    it('should warn when multiple debuggers are detected', async () => {
      debuggerList = [
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
      ];
      const client = new CdpBridge();
      await expect(client.connect()).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenLastCalledWith(ERROR_MESSAGE.DEBUGGER_FOUND_MULTIPLE);
    });

    it('should throw error when no debugger is detected', async () => {
      debuggerList = [];
      const client = new CdpBridge({ waitInterval: 5 });
      await expect(() => client.connect()).rejects.toThrowError(ERROR_MESSAGE.DEBUGGER_NOT_FOUND);
    });
  });

  describe('send', () => {
    it('should send message and receive response successfully', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      const message = JSON.stringify({
        id: 1,
        result: { result: undefined },
      });

      executeEventCallback(mockOn.mock.calls, 'message', message);
      expect(await result).toStrictEqual({});
      // nothing is happen when same id is received
      expect(() => executeEventCallback(mockOn.mock.calls, 'message', message)).not.toThrowError();
    });

    it('should handle event messages correctly', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      client.send('Runtime.enable');
      let param;
      client.on('Runtime.executionContextCreated', (_param) => {
        param = _param;
      });

      executeEventCallback(
        mockOn.mock.calls,
        'message',
        Buffer.from(
          JSON.stringify({
            method: 'Runtime.executionContextCreated',
            params: {
              type: 'log',
            },
          }),
        ),
      );

      expect(param).toStrictEqual({
        type: 'log',
      });
    });

    it('should reject when response contains error object', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      executeEventCallback(
        mockOn.mock.calls,
        'message',
        Buffer.from(
          JSON.stringify({
            id: 1,
            error: { message: 'Test error message' },
          }),
        ),
      );
      await expect(() => result).rejects.toThrowError('Test error message');
    });

    it('should reject when response is not valid JSON', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      executeEventCallback(mockOn.mock.calls, 'message', 'not formatted with JSON');
      executeEventCallback(mockOn.mock.calls, 'close'); // emulate close event
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.ERROR_PARSE_JSON);
    });

    it('should reject when request times out', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge({ timeout: 10 });
      await client.connect();
      const result = client.send('Runtime.enable'); // not call event callback, to emulate the timeout
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_CONNECTION);
    });

    it('should reject when send is called before connect', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.send('Runtime.enable');
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.NOT_CONNECTED);
    });

    it('should reject when protocol-related error occurs', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      const errorMessage = 'Some error happen.';
      executeEventCallback(mockOn.mock.calls, 'error', new Error(errorMessage));
      executeEventCallback(mockOn.mock.calls, 'close'); // emulate close event
      await expect(() => result).rejects.toThrowError(`${ERROR_MESSAGE.ERROR_INTERNAL} ${errorMessage}`);
    });
  });

  describe('close', () => {
    it('should disconnect successfully', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.close();
      executeEventCallback(mockOnce.mock.calls, 'close'); // emulate close event
      await expect(result).resolves.not.toThrowError();
    });

    it('should handle close before connect gracefully', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });

  describe('on', () => {
    it('should return correct ready state after connect', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      expect(client.state).toBe(1);
    });

    it('should return undefined state before connect', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      expect(client.state).toBe(undefined);
    });

    it('should handle close before connect gracefully', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });
});
