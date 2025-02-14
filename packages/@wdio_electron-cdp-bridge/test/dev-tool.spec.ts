import { describe, expect, it } from 'vitest';
import nock from 'nock';

import { DevTool } from '../src/dev-tool';
import { ERROR_MESSAGE } from '../src/constants';

describe('DevTool', () => {
  describe('Version', () => {
    const expected = {
      browser: 'Node',
      protocolVersion: 'v1.1',
    };
    it('should return version information', async () => {
      nock('http://localhost:9229')
        .get('/json/version')
        .reply(
          200,
          JSON.stringify({
            'Browser': 'Node',
            'Protocol-Version': 'v1.1',
          }),
        );
      const devtool = new DevTool();
      const data = await devtool.version();
      expect(data).toStrictEqual(expected);
    });
    it('should return version information using not default params', async () => {
      nock('http://somehost:50000')
        .get('/json/version')
        .reply(
          200,
          JSON.stringify({
            'Browser': 'Node',
            'Protocol-Version': 'v1.1',
          }),
        );
      const devtool = new DevTool({
        host: 'somehost',
        port: 50000,
      });
      const data = await devtool.version();
      expect(data).toStrictEqual(expected);
    });

    it('should throw error when receive invalid json data', async () => {
      nock('http://localhost:9229').get('/json/version').reply(200, 'invalid data');
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw error when status code is not 200', async () => {
      nock('http://localhost:9229').get('/json/version').reply(400, 'invalid data');
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw error when server is not running', async () => {
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw error when timeout occurred', async () => {
      nock('http://localhost:9229').get('/json/version').delay(500).reply(200, JSON.stringify(expected));
      const devtool = new DevTool({ timeout: 100 });
      await expect(() => devtool.version()).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_CONNECTION);
    });
  });

  describe('list', () => {
    it('should return the information of debugger', async () => {
      const expected = {
        description: 'node.js instance',
        devtoolsFrontendUrl:
          'devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:9229/uuid',
        devtoolsFrontendUrlCompat:
          'devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:9229/uuid',
        faviconUrl: 'https://nodejs.org/static/images/favicons/favicon.ico',
        id: 'uuid',
        title: 'electron/js2c/browser_init',
        type: 'node',
        url: 'file://',
        webSocketDebuggerUrl: 'ws://localhost:9229/uuid',
      };

      nock('http://localhost:9229')
        .get('/json')
        .reply(200, JSON.stringify([expected]));
      const devtool = new DevTool();
      const data = await devtool.list();
      expect(data).toStrictEqual([expected]);
    });
  });
});
