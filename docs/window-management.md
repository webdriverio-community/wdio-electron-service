# Window Management

The service automatically handles window management in your Electron applications. This means you can focus on writing tests without worrying about managing window focus.

## What It Does

- Automatically detects and switches to the active window
- Handles multiple windows seamlessly
- Works with both single and multi-remote browser instances
- Supports common scenarios like splash screens and popups

## Example

```ts
// The service automatically handles window focus
await browser.click('#button-in-main-window');

// Opening a new window
await browser.newWindow('https://example.com');

// The service automatically switches to the new window
await browser.click('#element-in-new-window');
```

## Manual Window Control

While window management is automatic, sometimes you may need explicit control. Here's a practical example:

```ts
describe('Settings window', () => {
  it('should save settings in popup window', async () => {
    // Open settings popup
    await browser.click('#open-settings-button');

    // Get window handles and switch to popup
    const handles = await browser.getWindowHandles();
    expect(handles).toHaveLength(2); // Verify popup opened
    await browser.switchToWindow(handles[1]);

    // Modify settings and save
    await browser.click('#save-settings');

    // Return to main window
    await browser.switchToWindow(handles[0]);
  });
});
```

The above example shows how to:

- Open a settings window from the main window
- Switch to the newly opened window
- Perform actions in the popup
- Switch back to the main window
