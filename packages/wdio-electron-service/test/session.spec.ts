import { describe, it, vi, expect } from 'vitest';

import { init } from '../src/session.js';

const browserMock = { mockBrowser: true };
const onPrepareMock = vi.fn();
const beforeMock = vi.fn();

vi.mock('../src/service.js', () => ({
  default: class MockElectronWorkerService {
    constructor() {}
    async before(...args: unknown[]) {
      beforeMock(...args);
    }
  },
}));
vi.mock('../src/launcher.js', () => ({
  default: class MockElectronLaunchService {
    constructor() {}
    async onPrepare(...args: unknown[]) {
      onPrepareMock(...args);
    }
  },
}));
vi.mock('webdriverio', () => ({ remote: async () => Promise.resolve(browserMock) }));

describe('init', () => {
  it('should create a new browser session', async () => {
    const session = await init({});
    expect(session).toStrictEqual(browserMock);
  });

  it('should call onPrepare with the expected parameters', async () => {
    await init([{ 'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' } }]);
    expect(onPrepareMock).toHaveBeenCalledWith(
      {
        appBinaryPath: '/path/to/binary',
      },
      [
        {
          'browserName': 'electron',
          'wdio:electronServiceOptions': {
            appBinaryPath: '/path/to/binary',
          },
        },
      ],
    );
  });

  it('should call before with the expected parameters', async () => {
    await init([{ 'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' } }]);
    expect(beforeMock).toHaveBeenCalledWith({}, [], browserMock);
  });
});
