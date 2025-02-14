import http, { type ClientRequest, type RequestOptions } from 'node:http';

import log from '@wdio/electron-utils/log';
import { DEFAULT_HOSTNAME, DEFAULT_PORT, ERROR_MESSAGE, REQUEST_TIMEOUT } from './constants';

import type { WdioCdpBridge } from './types';

export type DevToolOptions = {
  host?: string;
  port?: number;
  timeout?: number;
};

type DevToolRequestOptions = RequestOptions & {
  path: string;
};

type VersionReturnValue = {
  'Browser': string;
  'Protocol-Version': string;
};

export class DevTool {
  #host: string;
  #port: number;
  #timeout: number;
  constructor(options?: DevToolOptions) {
    const resolvedOptions = Object.assign(
      {
        host: DEFAULT_HOSTNAME,
        port: DEFAULT_PORT,
        useHttps: false,
        timeout: REQUEST_TIMEOUT,
      },
      options,
    );

    this.#host = resolvedOptions.host;
    this.#port = resolvedOptions.port;
    this.#timeout = resolvedOptions.timeout;
  }

  list() {
    return this.#executeRequest<WdioCdpBridge.DebuggerList>({
      path: '/json',
    });
  }

  async version(): Promise<WdioCdpBridge.Version> {
    const result = await this.#executeRequest<VersionReturnValue>({
      path: '/json/version',
    });
    console.log(result);
    return {
      browser: result['Browser'],
      protocolVersion: result['Protocol-Version'],
    };
  }

  #executeRequest<T>(options: DevToolRequestOptions): Promise<T> {
    const protocol = http;
    const resolvedOptions: RequestOptions = Object.assign(
      {
        host: this.#host,
        port: this.#port,
      },
      options,
    );
    log.debug('Request to the debugger', resolvedOptions);
    return new Promise((resolve, reject) => {
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

      req.setTimeout(this.#timeout, () => {
        this.#timeoutHandler(reject, req);
      });

      req.on('socket', (socket) => {
        socket.setTimeout(this.#timeout);
        socket.on('timeout', () => {
          this.#timeoutHandler(reject, req);
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request Error: ${error.message}`));
      });
      req.end();
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #timeoutHandler(reject: (reason?: any) => void, request: ClientRequest) {
    request.destroy();
    const message = `${ERROR_MESSAGE.TIMEOUT_CONNECTION} ${getReqInfo(request)}`;
    log.trace(message);
    reject(new Error(message));
  }
}

const getReqInfo = (request: ClientRequest) =>
  `${request.method} ${request.protocol}//${request.getHeader('Host')}${request.path}`;
