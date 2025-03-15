import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import type { BrowserWindow } from 'electron';

describe('interaction', () => {
  describe('keyboard input', () => {
    it('should detect keyboard input', async () => {
      const el = browser.$('.keypress-count');
      await browser.keys(['y', 'o']);
      await el.waitUntil(
        async function (this: WebdriverIO.Element) {
          return (await this.getText()) === 'YO';
        },
        {
          timeout: 1000,
          timeoutMsg: 'expected text to be different after 1s',
        },
      );

      await expect(el).toHaveText('YO');
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
