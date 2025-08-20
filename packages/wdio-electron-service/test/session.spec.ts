import { beforeAll, describe, expect, it, vi } from 'vitest';

import { init } from '../src/session.js';

const browserMock = { mockBrowser: true };
const onPrepareMock = vi.fn();
const onWorkerStartMock = vi.fn();
const beforeMock = vi.fn();

vi.mock('../src/service.js', () => ({
  default: class MockElectronWorkerService {
    async before(...args: unknown[]) {
      beforeMock(...args);
    }
  },
}));
vi.mock('../src/launcher.js', () => ({
  default: class MockElectronLaunchService {
    async onPrepare(...args: unknown[]) {
      onPrepareMock(...args);
    }
    async onWorkerStart(...args: unknown[]) {
      onWorkerStartMock(...args);
    }
  },
}));
vi.mock('webdriverio', () => ({
  remote: async () => Promise.resolve(browserMock),
}));

describe('Session Management', () => {
  describe('init()', () => {
    beforeAll(() => {
      vi.clearAllMocks();
    });
    it('should create a new browser session', async () => {
      const session = await init({});
      expect(session).toStrictEqual(browserMock);
    });

    it('should call onPrepare with the expected parameters', async () => {
      const expectedCaps = {
        browserName: 'electron',
        browserVersion: '99.9.9',
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/binary',
        },
        'goog:chromeOptions': {
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--headless'],
        },
        'wdio:chromedriverOptions': {
          binary: '/path/to/chromedriver',
        },
      };
      await init([expectedCaps]);
      expect(onPrepareMock).toHaveBeenCalledWith({}, [expectedCaps]);
      expect(onWorkerStartMock).toHaveBeenCalledWith('', [expectedCaps]);
    });

    it('should call onPrepare with the expected parameters when a rootDir is specified', async () => {
      await init(
        [
          {
            browserName: 'electron',
            'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' },
          },
        ],
        {
          rootDir: '/path/to/root',
        },
      );
      expect(onPrepareMock).toHaveBeenCalledWith({ rootDir: '/path/to/root' }, [
        {
          browserName: 'electron',
          'wdio:electronServiceOptions': {
            appBinaryPath: '/path/to/binary',
          },
        },
      ]);
    });

    it('should call before with the expected parameters', async () => {
      await init([{ 'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' } }]);
      expect(beforeMock).toHaveBeenCalledWith({}, [], browserMock);
    });
  });
});
