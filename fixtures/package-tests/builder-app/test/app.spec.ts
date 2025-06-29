import { $ } from '@wdio/globals';
import { browser } from 'wdio-electron-service';

describe('Builder App Example', () => {
  before(async () => {
    // Wait for the app to be fully ready
    await browser.waitUntil(
      async () => {
        const ready = await browser.electron.execute((electron) => {
          return electron.app.isReady();
        });
        return ready;
      },
      {
        timeout: 10000,
        timeoutMsg: 'App did not become ready',
      },
    );
  });

  it('should display the correct app title', async () => {
    await expect(browser).toHaveTitle('Builder App Example');
  });

  it('should display the main heading with builder branding', async () => {
    const heading = await $('h1');
    await expect(heading).toHaveText('📦 Builder App');
  });

  it('should get app version via Electron API', async () => {
    const versionBtn = await $('[data-testid="version-button"]');
    const infoDisplay = await $('[data-testid="info-display"]');

    await versionBtn.click();
    await browser.waitUntil(
      async () => {
        const html = await infoDisplay.getHTML();
        return html.includes('App Version:');
      },
      {
        timeout: 10000,
        interval: 100,
        timeoutMsg: 'Version info should be displayed',
      },
    );

    const html = await infoDisplay.getHTML();
    expect(html).toContain('📋 App Version:');
    expect(html).toContain('1.0.0');
  });

  it('should get app name via Electron API', async () => {
    const nameBtn = await $('[data-testid="name-button"]');
    const infoDisplay = await $('[data-testid="info-display"]');

    await nameBtn.click();
    await browser.waitUntil(
      async () => {
        const html = await infoDisplay.getHTML();
        return html.includes('App Name:');
      },
      {
        timeout: 10000,
        interval: 100,
        timeoutMsg: 'App name should be displayed',
      },
    );

    const html = await infoDisplay.getHTML();
    expect(html).toContain('🏷️ App Name:');
    expect(html).toContain('builder-app-example');
  });

  it('should have correct window configuration', async () => {
    const windowSize = await browser.electron.execute((electron) => {
      const windows = electron.BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const bounds = windows[0].getBounds();
        return { width: bounds.width, height: bounds.height };
      }
      return null;
    });

    expect(windowSize).not.toBeNull();
    expect(windowSize.width).toBe(900);
    expect(windowSize.height).toBe(700);
  });
});
