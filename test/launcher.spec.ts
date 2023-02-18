import { join } from 'path';
import { Testrunner } from '@wdio/types/build/Options';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { launcher } from 'wdio-chromedriver-service';
// import { downloadArtifact } from '@electron/get';

import ChromeDriverLauncher from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';

const isWin = process.platform === 'win32';
let downloadArtifactMock = vi.fn();

vi.mock('wdio-chromedriver-service');
vi.mock('extract-zip', () => ({ default: vi.fn().mockImplementation(() => Promise.resolve()) }));
vi.mock('fs', () => ({ promises: { chmod: vi.fn().mockImplementation(() => Promise.resolve()) } }));

beforeEach(() => {
  downloadArtifactMock = vi.fn();
  vi.doUnmock('@electron/get');
  vi.doMock('@electron/get', () => {
    const downloadArtifact = vi.fn().mockImplementation(() => Promise.resolve('mock-zip-path'));

    return { downloadArtifact };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('options validation', () => {
  it('should throw an error when no chromedriverCustomPath or electronVersion are specified', () => {
    expect(() => {
      new ChromeDriverLauncher({}, { browserName: 'mockBrowser' }, {
        mock: 'config',
      } as unknown as Testrunner);
    }).toThrow('You must specify the electronVersion, or provide a chromedriverCustomPath value');
  });
});

describe('on non-Windows platforms', () => {
  beforeEach(() => {
    mockProcessProperty('platform', 'linux');
  });

  afterEach(() => {
    revertProcessProperty('platform');
  });

  it('should handle no chromedriver configuration', () => {
    const launcherInstance = new ChromeDriverLauncher(
      {
        electronVersion: '23.1.0',
      },
      { browserName: 'mockBrowser' },
      {
        mock: 'config',
      } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining(join('wdio-electron-service', 'bin', 'chromedriver')) as string,
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should set chromedriverCustomPath correctly when not provided', () => {
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { logFileName: 'mock-log.txt' }, electronVersion: '23.1.0' },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining(join('wdio-electron-service', 'bin', 'chromedriver')) as string,
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should pass through chromeDriverCustomPath', () => {
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { chromedriverCustomPath: 'mock-chromedriver', logFileName: 'mock-log.txt' } },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: 'mock-chromedriver',
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });
});

describe('on windows platforms', () => {
  beforeEach(() => {
    mockProcessProperty('platform', 'win32');
  });

  afterEach(() => {
    revertProcessProperty('platform');
  });

  it('should handle no chromedriver configuration', () => {
    const launcherInstance = new ChromeDriverLauncher({ electronVersion: '23.1.0' }, { browserName: 'mockBrowser' }, {
      mock: 'config',
    } as unknown as Testrunner);
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining(
          join('wdio-electron-service', 'bin', 'chromedriver.exe'),
        ) as string,
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should set chromedriverCustomPath correctly when not provided', () => {
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { logFileName: 'mock-log.txt' }, electronVersion: '23.1.0' },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining(
          join('wdio-electron-service', 'bin', 'chromedriver.exe'),
        ) as string,
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should execute a JS chromedriverCustomPath via the .bat file', () => {
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { chromedriverCustomPath: 'mock-chromedriver.js', logFileName: 'mock-log.txt' } },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining(
          join('wdio-electron-service', 'bin', 'chromedriver.bat'),
        ) as string,
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
    expect(process.env.WDIO_ELECTRON_NODE_PATH).toContain(isWin ? 'windows\\node' : 'bin/node');
    expect(process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH).toBe('mock-chromedriver.js');
  });

  it('should pass through a non-JS chromeDriverCustomPath', () => {
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { chromedriverCustomPath: 'mock-chromedriver.exe', logFileName: 'mock-log.txt' } },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: 'mock-chromedriver.exe',
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });
});

describe('onPrepare', () => {
  it('should download chromedriver when no chromedriverCustomPath is specified', async () => {
    const { default: ChromeDriverLauncher2 } = await import('../src/launcher');
    const { downloadArtifact } = await import('@electron/get');
    const launcherInstance = new ChromeDriverLauncher2(
      { chromedriver: { logFileName: 'mock-log.txt' }, electronVersion: '23.0.0' },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    launcherInstance.onPrepare();

    expect(downloadArtifact).toHaveBeenCalledWith({
      arch: undefined,
      artifactName: 'chromedriver',
      cacheRoot: undefined,
      force: false,
      platform: undefined,
      version: '23.0.0',
    });
  });

  it('should not download chromedriver when a chromedriverCustomPath is specified', async () => {
    const { downloadArtifact } = await import('@electron/get');
    const launcherInstance = new ChromeDriverLauncher(
      {
        chromedriver: { logFileName: 'mock-log.txt', chromedriverCustomPath: 'mock-chromedriver' },
        electronVersion: '23.0.0',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' } as unknown as Testrunner,
    );
    launcherInstance.onPrepare();

    expect(downloadArtifact).not.toHaveBeenCalled();
  });

  describe('when the first download fails', () => {
    it('should attempt a single additional fallback download according to semver', async () => {
      const { downloadArtifact } = await import('@electron/get');
      const launcherInstance = new ChromeDriverLauncher(
        {
          chromedriver: { logFileName: 'mock-log.txt', chromedriverCustomPath: 'mock-chromedriver' },
          electronVersion: '23.1.69',
        },
        { browserName: 'mockBrowser' },
        { mock: 'config' } as unknown as Testrunner,
      );
      launcherInstance.onPrepare();

      expect(downloadArtifact).toHaveBeenCalledTimes(2);
      expect(downloadArtifact).toHaveBeenCalledWith([
        {
          arch: undefined,
          artifactName: 'chromedriver',
          cacheRoot: undefined,
          force: false,
          platform: undefined,
          version: '23.1.69',
        },
        {
          arch: undefined,
          artifactName: 'chromedriver',
          cacheRoot: undefined,
          force: false,
          platform: undefined,
          version: '23.1.0',
        },
      ]);
    });

    it('should throw an error if there is no semver fallback to try', async () => {
      const { downloadArtifact } = await import('@electron/get');
      const launcherInstance = new ChromeDriverLauncher(
        {
          chromedriver: { logFileName: 'mock-log.txt', chromedriverCustomPath: 'mock-chromedriver' },
          electronVersion: '23.1.0',
        },
        { browserName: 'mockBrowser' },
        { mock: 'config' } as unknown as Testrunner,
      );
      launcherInstance.onPrepare();

      expect(downloadArtifact).toHaveBeenCalledTimes(1);
      expect(downloadArtifact).toHaveBeenCalledWith({
        arch: undefined,
        artifactName: 'chromedriver',
        cacheRoot: undefined,
        force: false,
        platform: undefined,
        version: '23.1.0',
      });
    });
  });
});
