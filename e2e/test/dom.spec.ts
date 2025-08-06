import { $, $$, expect } from '@wdio/globals';

describe('DOM', () => {
  describe('using $', () => {
    it('should determine when an element is in the document', async () => {
      const checkbox = await $('[data-testid="disabled-checkbox"]');
      const type = await checkbox.getAttribute('type');

      await expect(checkbox).toExist();
      await expect(type).toBe('checkbox');
    });

    it('should determine when an element is not in the document', async () => {
      const result = await $('not-there');
      await expect(result).not.toExist();
    });

    it('should determine when an element is visible', async () => {
      const result = await $('[data-testid="disabled-checkbox"]');
      await expect(result).toBeDisplayed();
    });

    it('should determine when an element is not visible', async () => {
      const result = await $('[data-testid="hidden-textarea"]');
      await expect(result).not.toBeDisplayed();
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
