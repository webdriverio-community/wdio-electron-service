import { setupBrowser, WebdriverIOBoundFunctions } from '@testing-library/webdriverio';
import { queries } from '@testing-library/dom';

describe('application loading', () => {
  let screen: WebdriverIOBoundFunctions<typeof queries>;

  before(() => {
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
      it('increases the window height and width by 10 pixels', async () => {
        let bounds = (await browser.electronBrowserWindow('getBounds')) as { width: number; height: number };
        expect(bounds.width).toEqual(200);
        expect(bounds.height).toEqual(300);
        let biggerClickCount = await browser.$('.click-count .bigger').getText();
        expect(biggerClickCount).toEqual('0');
        const elem = await browser.$('.make-bigger');
        await elem.click();
        biggerClickCount = await browser.$('.click-count .bigger').getText();
        expect(biggerClickCount).toEqual('1');
        bounds = (await browser.electronBrowserWindow('getBounds')) as { width: number; height: number };
        expect(bounds.width).toEqual(210);
        expect(bounds.height).toEqual(310);
      });
    });
    describe('when the make smaller button is clicked', () => {
      it('decreases the window height and width by 10 pixels', async () => {
        let bounds = (await browser.electronBrowserWindow('getBounds')) as { width: number; height: number };
        expect(bounds.width).toEqual(210);
        expect(bounds.height).toEqual(310);
        const elem = await browser.$('.make-smaller');
        await elem.click();
        bounds = (await browser.electronBrowserWindow('getBounds')) as { width: number; height: number };
        expect(bounds.width).toEqual(200);
        expect(bounds.height).toEqual(300);
      });
    });
  });
});
