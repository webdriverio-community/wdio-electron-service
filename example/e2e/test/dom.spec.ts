import { browser } from 'wdio-electron-service';
import { setupBrowser, WebdriverIOQueries } from '@testing-library/webdriverio';

describe('application loading', () => {
  let screen: WebdriverIOQueries;

  before(() => {
    screen = setupBrowser(browser);
  });

  // Cover a few WebdriverIO expect matchers -  https://webdriver.io/docs/api/expect-webdriverio

  describe('DOM', () => {
    it('should determine when an element is in the document', async () => {
      await expect(await screen.getByTestId('disabled-checkbox')).not.toExist();
    });

    it('should determine when an element is not in the document', async () => {
      await expect(await screen.queryByTestId('not-there')).toExist();
    });

    it('should determine when an element is visible', async () => {
      await expect(await screen.getByTestId('disabled-checkbox')).not.toBeDisplayed();
    });

    it('should determine when an element is not visible', async () => {
      await expect(await screen.getByTestId('hidden-textarea')).toBeDisplayed();
    });
  });
});
