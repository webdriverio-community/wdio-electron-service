/// <reference types="mocha" />
import { expect } from '@wdio/globals';
import type { BrowserWindow } from 'electron';
import { browser } from 'wdio-electron-service';

const waitTextOfElement = async (element: ReturnType<typeof browser.$>, expectedText: string) => {
  // respect configuration for the timeout and interval
  // @see https://webdriver.io/docs/api/browser/waitUntil
  return await element.waitUntil(
    async function (this: WebdriverIO.Element) {
      return (await this.getText()) === expectedText;
    },
    {
      timeoutMsg: 'Did not reach the expected value.',
    },
  );
};

describe('interaction', () => {
  describe('keyboard input', () => {
    it('should detect keyboard input', async () => {
      const expectedText = 'YO';
      const elem = browser.$('.keypress-count');
      await browser.keys(['y', 'o']);
      await waitTextOfElement(elem, expectedText);

      await expect(elem).toHaveText(expectedText);
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

        const biggerClickCountElem = browser.$('.click-count .bigger');
        await waitTextOfElement(biggerClickCountElem, '1');
        biggerClickCount = await biggerClickCountElem.getText();
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

        const smallerClickCountElem = browser.$('.click-count .bigger');
        await waitTextOfElement(smallerClickCountElem, '1');
        const smallerClickCount = await smallerClickCountElem.getText();
        expect(smallerClickCount).toEqual('1');

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
