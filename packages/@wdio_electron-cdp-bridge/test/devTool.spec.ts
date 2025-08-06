import nock from 'nock';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import waitPort from 'wait-port';
import { ERROR_MESSAGE } from '../src/constants.js';
import { DevTool } from '../src/devTool.js';

vi.mock('wait-port', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

describe('DevTool', () => {
  beforeEach(() => {
    (waitPort as Mock).mockResolvedValue(undefined);
  });

  describe('Version', () => {
    const expected = {
      browser: 'Node',
      protocolVersion: 'v1.1',
    };

    it('should retrieve version information with default configuration', async () => {
      nock('http://localhost:9229')
        .get('/json/version')
        .reply(
          200,
          JSON.stringify({
            Browser: 'Node',
            'Protocol-Version': 'v1.1',
          }),
        );
      const devtool = new DevTool();
      const data = await devtool.version();
      expect(data).toStrictEqual(expected);
    });

    it('should retrieve version information with custom host and port', async () => {
      nock('http://somehost:50000')
        .get('/json/version')
        .reply(
          200,
          JSON.stringify({
            Browser: 'Node',
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

    it('should throw an error when receiving invalid JSON response', async () => {
      nock('http://localhost:9229').get('/json/version').reply(200, 'invalid data');
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw an error when receiving non-200 HTTP status code', async () => {
      nock('http://localhost:9229').get('/json/version').reply(400, 'invalid data');
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw an error when debugger server is not running', async () => {
      const devtool = new DevTool();
      await expect(() => devtool.version()).rejects.toThrowError();
    });

    it('should throw a timeout error when request exceeds timeout limit', async () => {
      nock('http://localhost:9229').get('/json/version').delay(500).reply(200, JSON.stringify(expected));
      const devtool = new DevTool({ timeout: 100 });
      await expect(() => devtool.version()).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_CONNECTION);
    });
  });

  describe('waitPort', () => {
    it('should throw a timeout error when port waiting exceeds timeout', async () => {
      nock('http://localhost:9229').get('/json/version').reply(200, JSON.stringify({}));
      (waitPort as Mock).mockRejectedValue(undefined);
      const devtool = new DevTool();

      await expect(() => devtool.version()).rejects.toThrowError(ERROR_MESSAGE.TIMEOUT_WAIT_PORT);
      expect(waitPort).toHaveBeenCalled();
    });

    it('should only call waitPort once for multiple consecutive requests', async () => {
      nock('http://localhost:9229')
        .get('/json/version')
        .reply(200, JSON.stringify({}))
        .get('/json/version')
        .reply(200, JSON.stringify({}));
      const devtool = new DevTool();

      await devtool.version();
      expect(waitPort).toHaveBeenCalledTimes(1);
      await devtool.version();
      expect(waitPort).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('should retrieve debugger target information successfully', async () => {
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
