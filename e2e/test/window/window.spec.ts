import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

describe('application with changing window', () => {
  it('should launch the application first screen', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    console.log(`appName: ${appName}`);
    await expect(browser).toHaveTitle('Splash window');
  });

  it('should launch the application second screen', async () => {
    const elem = browser.$('.switch-main-window');
    await elem.click();

    const appName = await browser.electron.execute((electron) => electron.app.getName());
    console.log(`appName: ${appName}`);
    await expect(browser).toHaveTitle('Test');
  });
});
