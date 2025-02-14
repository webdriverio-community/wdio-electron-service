import { describe, it, expect, vi } from 'vitest';

import log from '@wdio/electron-utils/log';

import { CdpBridge } from '../src/bridge';
import { ERROR_MESSAGE } from '../src/constants';

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
    DevTool: vi.fn().mockImplementation(() => ({
      list: vi.fn(async () => debuggerList),
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const executeEventCallback = (calls: any[][], eventName: string, ...args: any[]) => {
  const callback = calls.filter(([event]) => event === eventName)[0][1];
  callback(...args);
};

describe('CdpBridge', () => {
  describe('connect', () => {
    it('should not throw the error when connect normally', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      expect(() => client.connect()).not.toThrowError();
      expect(() => client.connect()).not.toThrowError(); // nothing will happen when multiple call
    });

    it('should happen the warning when detect multi debugger', async () => {
      debuggerList = [
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
      ];
      const client = new CdpBridge();
      await expect(() => client.connect()).not.toThrowError();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenLastCalledWith(ERROR_MESSAGE.DEBUGGER_FOUND_MULTIPLE);
    });

    it('should throw the error when detect no debugger', async () => {
      debuggerList = [];
      const client = new CdpBridge();
      await expect(() => client.connect()).rejects.toThrowError(ERROR_MESSAGE.DEBUGGER_NOT_FOUND);
    });
  });

  describe('send', () => {
    it('should send the message and receive the response', async () => {
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

    it('should receive the event message', async () => {
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

    it('should rejected when the response has `error` object', async () => {
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

    it('should rejected when the response does not have JSON data', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      executeEventCallback(mockOn.mock.calls, 'message', 'not formatted with JSON');
      executeEventCallback(mockOn.mock.calls, 'close'); // emulate close event
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.ERROR_PARSE_JSON);
    });

    it('should rejected when request timeout', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge({ timeout: 10 });
      await client.connect();
      const result = client.send('Runtime.enable'); // not call event callback, to emulate the timeout
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_CONNECTION);
    });

    it('should rejected when call send method before connect', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.send('Runtime.enable');
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.NOT_CONNECTED);
    });

    it('should rejected when some error which is related protocol happen', async () => {
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
    it('should resolved when disconnected', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.close();
      executeEventCallback(mockOnce.mock.calls, 'close'); // emulate close event
      await expect(result).resolves.not.toThrowError();
    });
    it('should resolved when call `close` before `connect`', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });
  describe('on', () => {
    it('should return ready state', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      expect(client.state).toBe(1);
    });
    it('should resolved when call `close` before `connect`', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });
});
