import { expect } from '@wdio/globals';

describe('DOM', () => {
  describe('using $', () => {
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
  it('should be able to call getElements to return values', async () => {
    const result = $$('[data-testid="disabled-checkbox"]');
    const chainedResult = await result.getElements();
    expect(chainedResult.length).toBe(1);
  });
});
