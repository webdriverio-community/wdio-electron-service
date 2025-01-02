import { multiremotebrowser, expect } from '@wdio/globals';

describe('application with changing window', () => {
  it('should launch the application first screen', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    const browserB = multiremotebrowser.getInstance('browserB');
    await expect(browserA).toHaveTitle('Splash window');
    await expect(browserB).toHaveTitle('Splash window');
  });

  it('should launch the application second screen', async () => {
    const browserA = multiremotebrowser.getInstance('browserA');
    const browserB = multiremotebrowser.getInstance('browserB');
    browserA.$('.switch-main-window').click();
    browserB.$('.switch-main-window').click();
    await expect(browserA).toHaveTitle('Test');
    await expect(browserB).toHaveTitle('Test');
  });
});
