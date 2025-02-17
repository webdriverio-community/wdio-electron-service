import { describe, expect, it } from 'vitest';

import { getDebuggerEndpoint } from '../src/bridge.js';

describe('getDebuggerEndpoint', () => {
  it('should return the endpoint information of the node debugger', () => {
    const host = 'localhost';
    const port = 50000;
    const result = getDebuggerEndpoint({
      ['goog:chromeOptions']: {
        args: ['foo=bar', `--inspect=${host}:${port}`],
      },
    });
    expect(result).toStrictEqual({
      host,
      port,
    });
  });

  it('should throw the error when `--inspect` is not set', () => {
    expect(() =>
      getDebuggerEndpoint({
        ['goog:chromeOptions']: {
          args: ['foo=bar'],
        },
      }),
    ).toThrowError();
  });

  it('should throw the error when invalid host is set', () => {
    const host = '';
    const port = 'xxx';
    expect(() =>
      getDebuggerEndpoint({
        ['goog:chromeOptions']: {
          args: ['foo=bar', `--inspect=${host}:${port}`],
        },
      }),
    ).toThrowError();
  });

  it('should throw the error when invalid port number is set', () => {
    const host = 'localhost';
    const port = 'xxx';
    expect(() =>
      getDebuggerEndpoint({
        ['goog:chromeOptions']: {
          args: ['foo=bar', `--inspect=${host}:${port}`],
        },
      }),
    ).toThrowError();
  });
});
