import { join } from 'path';
import { Testrunner } from '@wdio/types/build/Options';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { launcher } from 'wdio-chromedriver-service';

import ChromeDriverLauncher from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';

const isWin = process.platform === 'win32';

vi.mock('wdio-chromedriver-service');

describe('on non-Windows platforms', () => {
  beforeEach(() => {
    mockProcessProperty('platform', 'linux');
  });

  afterEach(() => {
    revertProcessProperty('platform');
  });

  it('should handle no chromedriver configuration', () => {
    const launcherInstance = new ChromeDriverLauncher({}, { browserName: 'mockBrowser' }, {
      mock: 'config',
    } as unknown as Testrunner);
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
      { chromedriver: { logFileName: 'mock-log.txt' } },
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
    const launcherInstance = new ChromeDriverLauncher({}, { browserName: 'mockBrowser' }, {
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
      { chromedriver: { logFileName: 'mock-log.txt' } },
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
