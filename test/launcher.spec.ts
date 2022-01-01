import { launcher } from 'wdio-chromedriver-service';
import Launcher from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';

jest.mock('wdio-chromedriver-service');

interface RequireResolveMock extends jest.Mock {
  paths(request: string): string[] | null;
}

it('should create a new CDS instance with the expected parameters', () => {
  new Launcher({ mock: 'options' }, { browserName: 'mockBrowser' }, { mock: 'config' });
  expect(launcher).toHaveBeenCalledWith(
    { chromedriverCustomPath: expect.stringContaining('/electron-chromedriver/chromedriver.js'), mock: 'options' },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
  );
});

it('should call require.resolve with the expected parameters', () => {
  const requireResolveMock = jest.fn() as RequireResolveMock;
  requireResolveMock.mockReturnValue('mock-chromedriver-path');
  new Launcher({ mock: 'options' }, { browserName: 'mockBrowser' }, { mock: 'config' }, requireResolveMock);
  expect(requireResolveMock).toHaveBeenCalledWith('electron-chromedriver/chromedriver');
  expect(launcher).toHaveBeenCalledWith(
    { chromedriverCustomPath: 'mock-chromedriver-path', mock: 'options' },
    { browserName: 'mockBrowser' },
    { mock: 'config' },
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
    new Launcher({ mock: 'options' }, { browserName: 'mockBrowser' }, { mock: 'config' });
    expect(launcher).toHaveBeenCalledWith(
      {
        chromedriverCustomPath: expect.stringContaining('/wdio-electron-service/bin/chrome-driver.bat'),
        mock: 'options',
      },
      { browserName: 'mockBrowser' },
      { mock: 'config' },
    );
  });

  it('should create the expected environment variables', () => {
    const requireResolveMock = jest.fn() as RequireResolveMock;
    requireResolveMock.mockReturnValue('mock-chromedriver-path');
    new Launcher({ mock: 'options' }, { browserName: 'mockBrowser' }, { mock: 'config' }, requireResolveMock);
    expect(requireResolveMock).toHaveBeenCalledWith('electron-chromedriver/chromedriver');
    expect(process.env.WDIO_ELECTRON_NODE_PATH).toContain('/bin/node'); //TODO: check on windows
    expect(process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH).toEqual('mock-chromedriver-path');
  });
});
