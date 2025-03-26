import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

describe('application window tests', () => {
  it('should launch the application splash screen window', async () => {
    if (browser.isMultiremote) {
      const multi = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      const browserA = multi.getInstance('browserA');
      const browserB = multi.getInstance('browserB');
      await expect(browserA).toHaveTitle('Splash Screen');
      await expect(browserB).toHaveTitle('Splash Screen');
    } else {
      await expect(browser).toHaveTitle('Splash Screen');
    }
  });

  it('should switch to the application main window', async () => {
    if (browser.isMultiremote) {
      const multi = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      const browserA = multi.getInstance('browserA');
      const browserB = multi.getInstance('browserB');
      await (await browserA.$('.switch-main-window')).click();
      await (await browserB.$('.switch-main-window')).click();
      await expect(browserA).toHaveTitle('Test');
      await expect(browserB).toHaveTitle('Test');
    } else {
      const elem = await browser.$('.switch-main-window');
      await elem.click();
      await expect(browser).toHaveTitle('Test');
    }
  });
});
