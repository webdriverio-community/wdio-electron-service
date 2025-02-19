import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import { setupBrowser, type WebdriverIOQueries } from '@testing-library/webdriverio';

describe('DOM', () => {
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

  describe('using testing-library', () => {
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

  describe('using $', () => {
    /**
     * This test is to check if return value of `$` has `getAttribute` or another attributes
     * @see https://github.com/webdriverio-community/wdio-electron-service/issues/957
     */
    it('should determine when an element is in the document', async () => {
      const checkbox = $('[data-testid="disabled-checkbox"]');
      const type = await checkbox.getAttribute('type');

      await expect(checkbox).toExist();
      await expect(type).toBe('checkbox');
    });

    it('should determine when an element is not in the document', async () => {
      await expect($('not-there')).not.toExist();
    });

    it('should determine when an element is visible', async () => {
      await expect($('[data-testid="disabled-checkbox"]')).toBeDisplayed();
    });

    it('should determine when an element is not visible', async () => {
      await expect($('[data-testid="hidden-textarea"]')).not.toBeDisplayed();
    });
  });
});

describe('using $$', () => {
  /**
   * This test is to check if return value of `$$` has `getElements` or another attributes
   * @see https://github.com/webdriverio-community/wdio-electron-service/issues/899
   */
  it('should be able to call getElements to return values', async () => {
    const result = $$('[data-testid="disabled-checkbox"]');
    const chainedResult = await result.getElements();
    expect(chainedResult.length).toBe(1);
  });
});
