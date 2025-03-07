import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import { setupBrowser, type WebdriverIOQueries } from '@testing-library/webdriverio';
import type { BrowserWindow } from 'electron';

describe('interaction', () => {
  let screen: WebdriverIOQueries;

  before(() => {
    /**
     * This is a workaround for the issue with the `browser` object type being
     * mismatched`.
     * @see https://github.com/testing-library/webdriverio-testing-library/issues/51
     */
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    screen = setupBrowser(browser);
  });

  describe('keyboard input', () => {
    it('should detect keyboard input', async () => {
      await browser.keys(['y', 'o']);
      expect(await (await screen.getByTestId('keypress-count')).getText()).toEqual('YO');
    });
  });

  describe('click events', () => {
    describe('when the make larger button is clicked', () => {
      it('should increase the window height and width by 10 pixels', async () => {
        let bounds = (await browser.electron.execute((electron) => {
          const browserWindow = electron.BrowserWindow.getAllWindows()[0] as BrowserWindow;
          return browserWindow.getBounds();
        })) as {
          width: number;
          height: number;
        };
        expect(bounds.width).toEqual(200);
        expect(bounds.height).toEqual(300);
        let biggerClickCount = await browser.$('.click-count .bigger').getText();
        expect(biggerClickCount).toEqual('0');
        const elem = browser.$('.make-bigger');
        await elem.click();
        biggerClickCount = await browser.$('.click-count .bigger').getText();
        expect(biggerClickCount).toEqual('1');
        bounds = (await browser.electron.execute((electron) => {
          const browserWindow = electron.BrowserWindow.getAllWindows()[0] as BrowserWindow;
          return browserWindow.getBounds();
        })) as {
          width: number;
          height: number;
        };
        expect(bounds.width).toEqual(210);
        expect(bounds.height).toEqual(310);
      });
    });

    describe('when the make smaller button is clicked', () => {
      it('should decrease the window height and width by 10 pixels', async () => {
        let bounds = (await browser.electron.execute((electron) => {
          const browserWindow = electron.BrowserWindow.getAllWindows()[0] as BrowserWindow;
          return browserWindow.getBounds();
        })) as {
          width: number;
          height: number;
        };
        expect(bounds.width).toEqual(210);
        expect(bounds.height).toEqual(310);
        const elem = browser.$('.make-smaller');
        await elem.click();
        bounds = (await browser.electron.execute((electron) => {
          const browserWindow = electron.BrowserWindow.getAllWindows()[0] as BrowserWindow;
          return browserWindow.getBounds();
        })) as {
          width: number;
          height: number;
        };
        expect(bounds.width).toEqual(200);
        expect(bounds.height).toEqual(300);
      });
    });
  });
});
