import WebSocket from 'ws';
import http from 'node:http';
import log from '@wdio/electron-utils/log';
import waitPort from 'wait-port';

const getDebugWebSocketUrl = async (hostname: string, port: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path: '/json',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0 && json[0].webSocketDebuggerUrl) {
            resolve(json[0].webSocketDebuggerUrl as string);
          } else {
            reject(new Error('No WebSocket debugger URL found.'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
};

export class DebuggerClient {
  #idCounter;
  #ws: WebSocket | null;
  #hostname: string;
  #debugPort: number;
  #responseHandlers = new Map();
  #contextMessageId: number = 0;
  #contextId: number = 0;

  constructor(hostname: string, port: number) {
    this.#idCounter = 1;
    this.#hostname = hostname;
    this.#debugPort = port;
    this.#ws = null;
  }

  async waitDebugPort() {
    const DRIVER_WAIT_TIMEOUT = 10 * 1000; // 10s
    await waitPort({ port: this.#debugPort, output: 'silent', timeout: DRIVER_WAIT_TIMEOUT }).catch((e) => {
      throw new Error(`Timed out to connect to ${this.#debugPort}: ${e.message}`);
    });
    await this.#connect();
    await this.#initialiseContext();
  }

  async #connect(): Promise<void> {
    const wsUrl = await getDebugWebSocketUrl(this.#hostname, this.#debugPort);
    log.trace('Connecting to WebSocket URL:', wsUrl);

    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(wsUrl);
      this.#ws.on('open', () => {
        log.trace('Connected:', wsUrl);
        resolve();
      });

      this.#ws.on('message', (message) => {
        const messageString = message.toString();

        try {
          const messageJson = JSON.parse(messageString);

          if (messageJson.method === 'Runtime.executionContextCreated') {
            if (this.#responseHandlers.has(this.#contextMessageId)) {
              const handler = this.#responseHandlers.get(this.#contextMessageId);
              handler(messageJson);
              this.#responseHandlers.delete(this.#contextMessageId);
            }
          } else {
            log.trace(`Received [${messageJson.id}]`, messageString);
            if (messageJson.id && this.#responseHandlers.has(messageJson.id)) {
              const handler = this.#responseHandlers.get(messageJson.id);
              try {
                const result = messageJson.result.result.value;
                handler(result);
              } catch (_error) {
                handler(messageJson);
              }
              this.#responseHandlers.delete(messageJson.id);
            }
          }
        } catch (error) {
          console.error('Failed to parse JSON:', (error as unknown as Error).message);
        }
      });

      this.#ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        reject(error);
      });

      this.#ws.on('close', () => {
        log.trace('Connection closed');
        this.#ws = null;
      });
    });
  }

  async #initialiseContext() {
    const scripts = [
      // Add __name to the global object to work around issue with function serialization
      // This enables browser.execute to work with scripts which declare functions (affects TS specs only)
      // https://github.com/webdriverio-community/wdio-electron-service/issues/756
      // https://github.com/privatenumber/tsx/issues/113
      `globalThis.__name = globalThis.__name ?? ((func) => func);`,
      // Add electron to the global object
      `globalThis.electron = require('electron');`,
    ];

    await this.sendMethod('Runtime.evaluate', {
      expression: scripts.join('\n'),
      includeCommandLineAPI: true,
      replMode: true,
      // throwOnSideEffect: true,
    });

    const result = await this.sendMethod('Runtime.enable');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.#contextId = result.params.context.id as number;
    await this.sendMethod('Runtime.disable');
  }

  async sendMethod(method: string, params = {}) {
    log.trace(`trying to connect: ${this.#hostname}:${this.#debugPort}`);
    log.trace(`trying to execute: ${method}`);
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    log.trace(`connected to: ${this.#hostname}:${this.#debugPort}`);

    const message = {
      id: this.#idCounter++,
      method,
      params,
    };
    if (method === 'Runtime.enable') {
      this.#contextMessageId = message.id;
    }
    if (method === 'Runtime.callFunctionOn') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      message.params['executionContextId'] = this.#contextId;
    }

    const messageJson = JSON.stringify(message);

    log.trace(`Send [${message.id}]`, messageJson);
    // console.log('Sending:', message);
    return new Promise((resolve, reject) => {
      this.#responseHandlers.set(message.id, resolve);
      this.#ws!.send(messageJson);

      setTimeout(() => {
        if (this.#responseHandlers.has(message.id)) {
          this.#responseHandlers.delete(message.id); // タイムアウトしたら削除
          reject(new Error(`Timeout waiting for response to message ID ${message.id}`));
        }
      }, 5000); // 5秒タイムアウト
    });
  }

  close() {
    if (this.#ws) {
      this.#ws.close();
    }
  }
}
