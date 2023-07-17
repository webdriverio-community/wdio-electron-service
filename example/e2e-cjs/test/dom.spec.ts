const { browser } = require('wdio-electron-service');
const { setupBrowser, WebdriverIOQueries } = require('@testing-library/webdriverio');

describe('application loading', () => {
  let screen: WebdriverIOQueries;

  before(() => {
    screen = setupBrowser(browser);
  });

  // Cover a few WebdriverIO expect matchers -  https://webdriver.io/docs/api/expect-webdriverio

  describe('DOM', () => {
    it('should determine when an element is in the document', async () => {
      await expect(await screen.getByTestId('disabled-checkbox')).toExist();
    });

    it('should determine when an element is not in the document', async () => {
      await expect(await screen.queryByTestId('not-there')).not.toExist();
    });

    it('should determine when an element is visible', async () => {
      await expect(await screen.getByTestId('disabled-checkbox')).toBeDisplayed();
    });

    it('should determine when an element is not visible', async () => {
      await expect(await screen.getByTestId('hidden-textarea')).not.toBeDisplayed();
    });
  });
});
