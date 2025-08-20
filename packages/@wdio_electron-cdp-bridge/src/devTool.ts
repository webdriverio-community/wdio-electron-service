import http, { type ClientRequest, type RequestOptions } from 'node:http';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('bridge');

import waitPort from 'wait-port';
import { DEFAULT_HOSTNAME, DEFAULT_PORT, ERROR_MESSAGE, REQUEST_TIMEOUT } from './constants.js';

import type { DebuggerList, Version } from './types.js';

export type DevToolOptions = {
  host?: string;
  port?: number;
  timeout?: number;
};

type DevToolRequestOptions = RequestOptions & {
  path: string;
};

type VersionReturnValue = {
  Browser: string;
  'Protocol-Version': string;
};

type WaitOptions = Parameters<typeof waitPort>[0];

const BRIDGE_RETRY_INTERVAL = 100;

export class DevTool {
  #options: Required<DevToolOptions>;
  #isPortOpened = false;

  constructor(options?: DevToolOptions) {
    const resolvedOptions = Object.assign(
      {
        host: DEFAULT_HOSTNAME,
        port: DEFAULT_PORT,
        timeout: REQUEST_TIMEOUT,
      },
      options,
    );

    this.#options = resolvedOptions;
  }

  list() {
    return this.#executeRequest<DebuggerList>({
      path: '/json',
    });
  }

  async version(): Promise<Version> {
    const result = await this.#executeRequest<VersionReturnValue>({
      path: '/json/version',
    });
    log.info(result);
    return {
      browser: result.Browser,
      protocolVersion: result['Protocol-Version'],
    };
  }
  #waitDebuggerPort() {
    return new Promise<void>((resolve, reject) => {
      if (!this.#isPortOpened) {
        const waitOptions: WaitOptions = {
          ...this.#options,
          output: 'silent',
          interval: BRIDGE_RETRY_INTERVAL,
        };
        waitPort(waitOptions)
          .then(() => {
            this.#isPortOpened = true;
            resolve();
          })
          .catch(reject);
      } else {
        resolve();
      }
    });
  }

  async #executeRequest<T>(options: DevToolRequestOptions): Promise<T> {
    const protocol = http;
    const resolvedOptions: RequestOptions = Object.assign({}, this.#options, options);
    log.debug('Request to the debugger', resolvedOptions);
    return new Promise((resolve, reject) => {
      this.#waitDebuggerPort()
        .catch(() => {
          reject(new Error(ERROR_MESSAGE.TIMEOUT_WAIT_PORT));
        })
        .then(() => {
          const req = protocol.request(resolvedOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              data += chunk;
            });

            res.on('end', () => {
              try {
                if (res.statusCode === 200) {
                  const message = JSON.parse(data);

                  log.trace('Received response: ', message);
                  resolve(message);
                } else {
                  reject(new Error(data));
                }
              } catch (error) {
                reject(error);
              }
            });
          });

          req.setTimeout(this.#options.timeout, () => {
            this.#timeoutHandler(reject, req);
          });

          req.on('socket', (socket) => {
            socket.setTimeout(this.#options.timeout);
            socket.on('timeout', () => {
              this.#timeoutHandler(reject, req);
            });
          });

          req.on('error', (error) => {
            reject(new Error(`Request Error: ${error.message}`));
          });

          req.end();
        });
    });
  }

  #timeoutHandler(reject: (reason?: Error) => void, request: ClientRequest) {
    request.destroy();
    const message = `${ERROR_MESSAGE.TIMEOUT_CONNECTION} ${getReqInfo(request)}`;
    log.trace(message);
    reject(new Error(message));
  }
}

const getReqInfo = (request: ClientRequest) =>
  `${request.method} ${request.protocol}//${request.getHeader('Host')}${request.path}`;
