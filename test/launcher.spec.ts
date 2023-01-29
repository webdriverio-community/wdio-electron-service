import { vi, Mock, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { launcher } from 'wdio-chromedriver-service';
import ChromeDriverLauncher from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';

vi.mock('wdio-chromedriver-service');

interface RequireResolveMock extends Mock {
  paths(request: string): string[] | null;
}

it('should handle no chromedriver configuration', () => {
  const requireResolveMock = vi.fn() as RequireResolveMock;
  requireResolveMock.mockReturnValue('/electron-chromedriver/chromedriver.js');
  const launcherInstance = new ChromeDriverLauncher(
    {},
    { browserName: 'mockBrowser' },
    { mock: 'config' },
    requireResolveMock,
  );
  expect(launcherInstance).toBeInstanceOf(launcher);
  expect(launcher).toHaveBeenCalledWith(
    {
      chromedriverCustomPath: expect.stringContaining('/electron-chromedriver/chromedriver.js') as string,
    },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
  );
});

it('should create a new CDS instance with the expected parameters', () => {
  const requireResolveMock = vi.fn() as RequireResolveMock;
  requireResolveMock.mockReturnValue('/electron-chromedriver/chromedriver.js');
  const launcherInstance = new ChromeDriverLauncher(
    { chromedriver: { logFileName: 'mock-log.txt' } },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
    requireResolveMock,
  );
  expect(launcherInstance).toBeInstanceOf(launcher);
  expect(launcher).toHaveBeenCalledWith(
    {
      chromedriverCustomPath: expect.stringContaining('/electron-chromedriver/chromedriver.js') as string,
      logFileName: 'mock-log.txt',
    },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
  );
});

it('should get the chromedriver path from electron-chromedriver', () => {
  const requireResolveMock = vi.fn() as RequireResolveMock;
  requireResolveMock.mockReturnValue('mock-chromedriver-path');
  const launcherInstance = new ChromeDriverLauncher(
    { chromedriver: { logFileName: 'mock-log.txt' } },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
    requireResolveMock,
  );
  expect(launcherInstance).toBeInstanceOf(launcher);
  expect(requireResolveMock).toHaveBeenCalledWith('electron-chromedriver/chromedriver');
  expect(launcher).toHaveBeenCalledWith(
    { chromedriverCustomPath: 'mock-chromedriver-path', logFileName: 'mock-log.txt' },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
  );
});

it('should not look for electron-chromedriver when chromedriverCustomPath is specified', () => {
  const requireResolveMock = vi.fn() as RequireResolveMock;
  requireResolveMock.mockReturnValue('mock-chromedriver-path');
  const launcherInstance = new ChromeDriverLauncher(
    { chromedriver: { logFileName: 'mock-log.txt', chromedriverCustomPath: 'mock-chromedriver-path-custom' } },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
    requireResolveMock,
  );
  expect(launcherInstance).toBeInstanceOf(launcher);
  expect(requireResolveMock).not.toHaveBeenCalled();
  expect(launcher).toHaveBeenCalledWith(
    { chromedriverCustomPath: 'mock-chromedriver-path-custom', logFileName: 'mock-log.txt' },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
  );
});

it('should throw an error when chromedriverCustomPath is not specified and electron-chromedriver is not found', () => {
  const requireResolveMock = vi.fn() as RequireResolveMock;
  requireResolveMock.mockImplementation(() => {
    throw new Error('module not found');
  });
  expect(
    () =>
      new ChromeDriverLauncher(
        { chromedriver: { logFileName: 'mock-log.txt' } },
        { browserName: 'mockBrowser' },
        { mock: 'config' },
        requireResolveMock,
      ),
  ).toThrow(
    'electron-chromedriver was not found. You need to install it or provide a binary via the chromedriver.chromedriverCustomPath option.',
  );
});

describe('on windows platforms', () => {
  beforeEach(() => {
    mockProcessProperty('platform', 'win32');
  });

  afterEach(() => {
    revertProcessProperty('platform');
  });

  it('should create a new CDS instance with the expected parameters', () => {
    const requireResolveMock = vi.fn() as RequireResolveMock;
    requireResolveMock.mockReturnValue('mock-chromedriver');
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { logFileName: 'mock-log.txt' } },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
      requireResolveMock,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining('/wdio-electron-service/bin/chrome-driver.bat') as string,
        logFileName: 'mock-log.txt',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should create the expected environment variables', () => {
    const requireResolveMock = vi.fn() as RequireResolveMock;
    requireResolveMock.mockReturnValue('mock-chromedriver-path');
    const launcherInstance = new ChromeDriverLauncher(
      { chromedriver: { logFileName: 'mock-log.txt' } },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
      requireResolveMock,
    );
    expect(launcherInstance).toBeInstanceOf(launcher);
    expect(requireResolveMock).toHaveBeenCalledWith('electron-chromedriver/chromedriver');
    expect(process.env.WDIO_ELECTRON_NODE_PATH).toContain('/bin/node');
    expect(process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH).toBe('mock-chromedriver-path');
  });
});
