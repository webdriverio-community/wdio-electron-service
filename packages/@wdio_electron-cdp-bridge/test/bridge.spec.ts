import { createLogger } from '@wdio/electron-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CdpBridge } from '../src/bridge.js';
import { ERROR_MESSAGE } from '../src/constants.js';
import { DevTool } from '../src/devTool.js';

import type { DebuggerList } from '../src/types.js';

vi.mock('@wdio/electron-utils', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };
  return {
    createLogger: vi.fn(() => mockLogger),
  };
});

let mockWebSocketInstance: any;

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
      #eventHandlers = new Map();
      #onceHandlers = new Map();

      send = vi.fn();
      close = vi.fn();

      constructor() {
        mockWebSocketInstance = this;
        // Simulate successful connection immediately
        // Use nextTick to ensure handlers are registered first
        process.nextTick(() => {
          this.#emit('open');
        });
      }

      on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (!this.#eventHandlers.has(event)) {
          this.#eventHandlers.set(event, []);
        }
        this.#eventHandlers.get(event).push(callback);
      });

      once = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (!this.#onceHandlers.has(event)) {
          this.#onceHandlers.set(event, []);
        }
        this.#onceHandlers.get(event).push(callback);
      });

      #emit(event: string, ...args: any[]) {
        // Handle regular event handlers
        if (this.#eventHandlers.has(event)) {
          this.#eventHandlers.get(event).forEach((callback: (...args: unknown[]) => void) => {
            callback(...args);
          });
        }

        // Handle once handlers
        if (this.#onceHandlers.has(event)) {
          const handlers = this.#onceHandlers.get(event);
          handlers.forEach((callback: (...args: unknown[]) => void) => {
            callback(...args);
          });
          this.#onceHandlers.set(event, []); // Clear once handlers after execution
        }
      }

      // Method to trigger events from tests
      triggerEvent = (event: string, ...args: unknown[]) => {
        this.#emit(event, ...args);
      };
    },
  };
});

let debuggerList: { webSocketDebuggerUrl: string }[] | undefined;
vi.mock('../src/devTool', () => {
  return {
    DevTool: vi.fn(),
  };
});

const triggerWebSocketEvent = (eventName: string, ...args: unknown[]) => {
  if (mockWebSocketInstance?.triggerEvent) {
    mockWebSocketInstance.triggerEvent(eventName, ...args);
  }
};

describe('CdpBridge', () => {
  beforeEach(() => {
    // Reset WebSocket instance
    mockWebSocketInstance = null;

    vi.mocked(DevTool).mockImplementation(
      () =>
        ({
          list: vi.fn(async () => debuggerList),
        }) as unknown as DevTool,
    );
  });

  describe('connect', () => {
    it('should establish a connection successfully on first attempt', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await expect(client.connect()).resolves.toBeUndefined();
      await expect(client.connect()).resolves.toBeUndefined();
    });

    it('should establish a connection successfully after retrying', async () => {
      let retry: number = 0;
      vi.mocked(DevTool).mockImplementation(() => {
        retry++;
        if (retry < 3) {
          throw Error('Dummy Error');
        }
        return {
          list: vi.fn(async () => [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }] as DebuggerList),
        } as unknown as DevTool;
      });
      const client = new CdpBridge({ waitInterval: 10 });

      await expect(client.connect()).resolves.toBeUndefined();
      const mockLogger = vi.mocked(createLogger)();
      expect(mockLogger.warn).toHaveBeenCalledWith('Connection attempt 1 failed: Dummy Error');
      expect(mockLogger.debug).toHaveBeenCalledWith('Retry 1/3 in 10ms');
      expect(mockLogger.warn).toHaveBeenCalledWith('Connection attempt 2 failed: Dummy Error');
      expect(mockLogger.debug).toHaveBeenCalledWith('Retry 2/3 in 10ms');
    });

    it('should log a warning when multiple debugger instances are detected', async () => {
      debuggerList = [
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
        { webSocketDebuggerUrl: 'ws://localhost:123/uuid' },
      ];
      const client = new CdpBridge();
      await expect(client.connect()).resolves.toBeUndefined();
      const mockLogger = vi.mocked(createLogger)();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenLastCalledWith(ERROR_MESSAGE.DEBUGGER_FOUND_MULTIPLE);
    });

    it('should throw an error when no debugger instances are found', async () => {
      debuggerList = [];
      const client = new CdpBridge({ waitInterval: 5 });
      await expect(() => client.connect()).rejects.toThrowError(ERROR_MESSAGE.DEBUGGER_NOT_FOUND);
    });
  });

  describe('send', () => {
    it('should successfully send a message and receive the response', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      const message = JSON.stringify({
        id: 1,
        result: { result: undefined },
      });

      // Wait a tick to ensure promise is registered before triggering the message
      await new Promise((resolve) => process.nextTick(resolve));
      triggerWebSocketEvent('message', message);
      expect(await result).toStrictEqual({});
      // nothing is happen when same id is received
      expect(() => triggerWebSocketEvent('message', message)).not.toThrowError();
    });

    it('should properly handle CDP event messages', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      client.send('Runtime.enable');
      let param: any;
      client.on('Runtime.executionContextCreated', (_param) => {
        param = _param;
      });

      triggerWebSocketEvent(
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

    it('should reject the promise when response contains an error object', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      // Wait a tick to ensure promise is registered before triggering the message
      await new Promise((resolve) => process.nextTick(resolve));
      triggerWebSocketEvent(
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

    it('should reject the promise when response contains invalid JSON', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      triggerWebSocketEvent('message', 'not formatted with JSON');
      triggerWebSocketEvent('close'); // emulate close event
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.ERROR_PARSE_JSON);
    });

    it('should reject the promise when request times out', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge({ timeout: 10 });
      await client.connect();
      const result = client.send('Runtime.enable'); // not call event callback, to emulate the timeout
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_CONNECTION);
    });

    it('should reject the promise when send is called before connect', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.send('Runtime.enable');
      await expect(() => result).rejects.toThrowError(ERROR_MESSAGE.NOT_CONNECTED);
    });

    it('should reject the promise when a protocol-related error occurs', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.send('Runtime.enable');
      const errorMessage = 'Some error happen.';
      triggerWebSocketEvent('error', new Error(errorMessage));
      triggerWebSocketEvent('close'); // emulate close event
      await expect(() => result).rejects.toThrowError(`${ERROR_MESSAGE.ERROR_INTERNAL} ${errorMessage}`);
    });
  });

  describe('close', () => {
    it('should close the connection successfully', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      const result = client.close();
      triggerWebSocketEvent('close'); // emulate close event
      await expect(result).resolves.not.toThrowError();
    });

    it('should handle calling close before connect without errors', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });

  describe('state', () => {
    it('should return the correct WebSocket ready state after connecting', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      await client.connect();
      expect(client.state).toBe(1);
    });

    it('should return undefined state when not connected', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      expect(client.state).toBe(undefined);
    });

    it('should handle close operations gracefully before connection', async () => {
      debuggerList = [{ webSocketDebuggerUrl: 'ws://localhost:123/uuid' }];
      const client = new CdpBridge();
      const result = client.close();
      await expect(result).resolves.not.toThrowError();
    });
  });
});
