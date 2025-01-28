import log from '@wdio/electron-utils/log';

export const getActiveWindowHandle = async (browser: WebdriverIO.Browser) => {
  if (browser.isMultiremote) {
    return undefined;
  }

  log.trace('Getting active window handle');
  const handles = await browser.getWindowHandles();

  // No windows available
  if (handles.length === 0) {
    log.trace('No windows found');
    return undefined;
  }

  const currentHandle = browser.electron.windowHandle;

  // If we have a current window handle and it's still valid, keep using it
  if (currentHandle && handles.includes(currentHandle)) {
    log.trace(`Keeping current window handle: ${currentHandle}`);
    return currentHandle;
  }

  // Otherwise return first available window handle
  log.trace(`Selecting first available window handle: ${handles[0]}`);
  return handles[0];
};

const switchToActiveWindow = async (browser: WebdriverIO.Browser) => {
  const activeHandle = await getActiveWindowHandle(browser);

  if (activeHandle && activeHandle !== browser.electron.windowHandle) {
    log.debug(
      'The active window has changed. Switching...',
      `New window handle: ${activeHandle}`,
      `Previous window handle: ${browser.electron.windowHandle}`,
    );
    await browser.switchToWindow(activeHandle);
    browser.electron.windowHandle = activeHandle;
  }
};

export const ensureActiveWindowFocus = async (
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  commandName: string,
) => {
  log.trace(`Ensuring active window focus before command: ${commandName}`);
  if (browser.isMultiremote) {
    const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
    for (const instance of mrBrowser.instances) {
      const mrInstance = mrBrowser.getInstance(instance);
      await switchToActiveWindow(mrInstance);
    }
  } else {
    await switchToActiveWindow(browser);
  }
  log.trace(`Window focus check completed for command: ${commandName}`);
};
