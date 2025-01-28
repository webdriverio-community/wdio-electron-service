import { multiremotebrowser, expect } from '@wdio/globals';

describe('application with changing window', () => {
  it('should launch the application splash screen window', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    const browserB = multiremotebrowser.getInstance('browserB');
    await expect(browserA).toHaveTitle('Splash Screen');
    await expect(browserB).toHaveTitle('Splash Screen');
  });

  it('should switch to the application main window', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    const browserB = multiremotebrowser.getInstance('browserB');
    browserA.$('.switch-main-window').click();
    browserB.$('.switch-main-window').click();
    await expect(browserA).toHaveTitle('Test');
    await expect(browserB).toHaveTitle('Test');
  });
});
