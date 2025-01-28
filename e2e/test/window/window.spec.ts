import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

describe('application with multiple windows', () => {
  it('should launch the application splash screen window', async () => {
    await expect(browser).toHaveTitle('Splash Screen');
  });

  it('should switch to the application main window', async () => {
    const elem = await browser.$('.switch-main-window');
    await elem.click();

    await expect(browser).toHaveTitle('Test');
  });
});
