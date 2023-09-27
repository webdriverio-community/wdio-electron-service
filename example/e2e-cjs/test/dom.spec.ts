import { setupBrowser, type WebdriverIOQueries } from '@testing-library/webdriverio';

describe('application loading', () => {
  let screen: WebdriverIOQueries;

  before(() => {
    screen = setupBrowser(browser);
  });

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

  describe('WDIO Matchers', () => {
    it('should be able to use WebdriverIO matchers', async () => {
      await expect(await $('#disabled-checkbox')).toBePresent();
    });
  });
});
