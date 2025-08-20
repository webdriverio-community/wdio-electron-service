import EventEmitter from 'node:events';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('bridge');

import type { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping.js';
import WebSocket from 'ws';
import {
  DEFAULT_HOSTNAME,
  DEFAULT_MAX_RETRY_COUNT,
  DEFAULT_PORT,
  DEFAULT_RETRY_INTERVAL,
  ERROR_MESSAGE,
  REQUEST_TIMEOUT,
} from './constants.js';
import { DevTool, type DevToolOptions } from './devTool.js';

type Methods = keyof ProtocolMapping.Commands;

type Events = keyof ProtocolMapping.Events;

type MethodPrams<T extends Methods> = ProtocolMapping.Commands[T]['paramsType'];

type MethodReturn<T extends Methods> = ProtocolMapping.Commands[T]['returnType'];

type SendParams<T extends Methods> = MethodPrams<T> extends [] ? [] : [MethodPrams<T>[number]];

type PromiseHandlers = {
  // biome-ignore lint/suspicious/noExplicitAny: resolve callback needs flexible type
  resolve: (value?: any) => void;
  reject: (reason?: unknown) => void;
};

type EventValue = {
  method: string;
  params: unknown;
  sessionId?: string;
};

type MethodReturnValue = {
  id: number;
  result?: {
    result: unknown;
  };
  error?: {
    message: string;
  };
};

export type CdpBridgeOptions = DevToolOptions & {
  waitInterval?: number;
  connectionRetryCount?: number;
};

const CONNECT_PROMISE_ID = 0;

export class CdpBridge extends EventEmitter {
  protected options: Required<CdpBridgeOptions>;
  #wsUrl: string | undefined = undefined;
  #ws: WebSocket | null = null;
  #promises = new Map<number, PromiseHandlers>();
  #commandId = CONNECT_PROMISE_ID;

  constructor(options?: CdpBridgeOptions) {
    super();
    this.options = Object.assign(
      {
        host: DEFAULT_HOSTNAME,
        port: DEFAULT_PORT,
        timeout: REQUEST_TIMEOUT,
        waitInterval: DEFAULT_RETRY_INTERVAL,
        connectionRetryCount: DEFAULT_MAX_RETRY_COUNT,
      },
      options,
    );
  }

  async connect(): Promise<void> {
    let retries = 0;
    const maxRetryCount = this.options.connectionRetryCount;
    const waitInterval = this.options.waitInterval;

    while (retries <= maxRetryCount) {
      try {
        await this.#connect();
        return;
      } catch (error) {
        const lastError = error as Error;
        log.warn(`Connection attempt ${retries + 1} failed: ${lastError.message}`);

        if (retries >= maxRetryCount) {
          log.error(`Failed to connect after ${retries + 1} attempts`);
          throw lastError;
        }

        retries++;
        log.debug(`Retry ${retries}/${maxRetryCount} in ${waitInterval}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitInterval));
      }
    }
  }
  async #connect(): Promise<void> {
    this.#wsUrl = await this.#getWsUrl();
    return new Promise((resolve, reject) => {
      if (!this.#wsUrl) {
        reject(new Error(ERROR_MESSAGE.DEBUGGER_NOT_FOUND));
        return;
      }
      if (this.#ws) {
        resolve();
        return;
      }

      log.debug(`Connecting: ${this.#wsUrl}`);
      this.#ws = new WebSocket(this.#wsUrl, [], {
        maxPayload: 256 * 1024 * 1024, // Extend 256Mib
        perMessageDeflate: false,
        followRedirects: true,
        handshakeTimeout: this.options.timeout,
      });

      this.#promises.set(CONNECT_PROMISE_ID, { resolve, reject });
      this.#setHandlers(this.#ws);
    });
  }

  get state() {
    return !this.#ws ? undefined : this.#ws.readyState;
  }

  on<T extends Events>(event: T, listener: (param: ProtocolMapping.Events[T][number]) => void): this {
    return super.on(event, listener);
  }

  send<T extends Methods>(method: T, ...params: SendParams<T>): Promise<MethodReturn<T>> {
    this.#commandId = this.#commandId + 1;
    const messageId = this.#commandId;
    const message = {
      id: messageId,
      method: method,
      params: params[0] || {},
    };
    log.trace(`[${message.id}] Trying to send the method: ${method}`);
    return new Promise((resolve, reject) => {
      if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
        reject(new Error(ERROR_MESSAGE.NOT_CONNECTED));
        return;
      }
      const messageJson = JSON.stringify(message);
      log.trace(`[${message.id}] Send`, messageJson);
      this.#promises.set(message.id, { resolve, reject });
      this.#ws.send(messageJson);

      setTimeout(() => {
        if (this.#promises.has(message.id)) {
          this.#promises.delete(message.id);
          reject(new Error(`${ERROR_MESSAGE.TIMEOUT_CONNECTION} ${message.id}`));
        }
      }, this.options.timeout);
    });
  }

  close() {
    return this.#close();
  }

  #setHandlers(ws: WebSocket) {
    ws.on('open', () => {
      log.debug(`Connected to ${this.#wsUrl}`);
      this.#promises.get(CONNECT_PROMISE_ID)?.resolve();
      this.#promises.delete(CONNECT_PROMISE_ID);
    });

    ws.on('message', async (rowMessage) => {
      try {
        this.#messageHandler(rowMessage.toString());
      } catch (error) {
        log.error('Message handling error');
        return await this.#errorHandler(error);
      }
    });

    ws.on('error', async (error) => {
      log.error('WebSocket error');
      return await this.#errorHandler(error);
    });

    ws.on('close', () => {
      log.trace(ERROR_MESSAGE.CONNECTION_CLOSED);
      this.#rejectAllPromises();
      this.#ws = null;
    });
  }

  #messageHandler(strMessage: string) {
    const message = parseJson(strMessage);

    if (message.id) {
      log.trace(`[${message.id}] Received response: `, strMessage);
      this.#responseHandler(message);
    } else if (message.method) {
      log.trace(`Received event: `, strMessage);
      this.#eventHandler(message);
    }
  }

  #responseHandler(message: MethodReturnValue) {
    if (!this.#promises.has(message.id)) {
      return;
    }
    const handler = this.#promises.get(message.id);
    if (handler) {
      if (message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve(message.result);
      }
      this.#promises.delete(message.id);
    }
  }

  #eventHandler(message: EventValue) {
    const { method, params, sessionId } = message;
    this.emit(method, params, sessionId);
  }

  async #errorHandler(error: unknown) {
    log.error((error as Error).message);
    return await this.#close(error);
  }

  async #getWsUrl() {
    const devtool = new DevTool(this.options);
    const list = await devtool.list();
    if (list.length < 1) {
      log.error(ERROR_MESSAGE.DEBUGGER_NOT_FOUND);
      return undefined;
    } else if (list.length > 1) {
      log.warn(ERROR_MESSAGE.DEBUGGER_FOUND_MULTIPLE);
    }
    log.debug(`Detected debugger URL: ${list[0].webSocketDebuggerUrl}`);
    return list[0].webSocketDebuggerUrl;
  }

  #close(error?: unknown) {
    if (error) {
      this.#rejectAllPromises(error as Error);
    }
    return new Promise<void>((resolve) => {
      if (this.#ws && this.#ws.readyState !== WebSocket.CLOSED) {
        log.trace(`Closing connection: ${this.#wsUrl}`);
        this.#ws.once('close', () => {
          this.#ws = null;
          resolve();
        });
        this.#ws.close();
      } else {
        this.#ws = null;
        resolve();
      }
    });
  }

  #rejectAllPromises(error?: Error) {
    const message = error ? `${ERROR_MESSAGE.ERROR_INTERNAL} ${error.message}` : ERROR_MESSAGE.CONNECTION_CLOSED;
    const reason = new Error(message);
    this.#promises.forEach((handler) => {
      handler.reject(reason);
    });
    this.#promises.clear();
  }
}

const parseJson = (strJson: string) => {
  try {
    return JSON.parse(strJson);
  } catch (error) {
    throw new Error(`${ERROR_MESSAGE.ERROR_PARSE_JSON} ${(error as Error).message}`);
  }
};
