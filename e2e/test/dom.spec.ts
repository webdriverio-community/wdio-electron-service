import { expect } from '@wdio/globals';
import { browser } from 'wdio-electron-service';
import { setupBrowser, type WebdriverIOQueries } from '@testing-library/webdriverio';

describe('DOM', () => {
  let screen: WebdriverIOQueries;

  before(() => {
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
    it('should determine when an element is in the document', async () => {
      await expect($('[data-testid="disabled-checkbox"]')).toExist();
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
  it('should be able to call getElements to return values', async () => {
    const result = await $$('[data-testid="disabled-checkbox"]');
    const chainedResult = await result.getElements();
    expect(chainedResult.length).toBe(1);
  });
});
