import log from '@wdio/electron-utils/log';

export const getWindowHandle = async (browser: WebdriverIO.Browser) => {
  if (browser.isMultiremote) {
    return undefined;
  }
  log.debug(`Attempting to get window handle`);
  const handles = await browser.getWindowHandles();
  switch (handles.length) {
    case 0:
      log.debug(`The application has no window`);
      return undefined;
    case 1:
      log.debug(`The application has 1 window: ${handles[0]}`);
      return handles[0];
    default: {
      const currentHandle = browser.electron.windowHandle;
      if (!currentHandle || !handles.includes(currentHandle)) {
        log.debug(`The application has multiple window, first one is used: ${handles[0]}`);
        return handles[0];
      } else {
        log.debug(`Same window is detected: ${handles[0]}`);
        return currentHandle;
      }
    }
  }
};

const followWindow = async (browser: WebdriverIO.Browser) => {
  const currentHandle = await getWindowHandle(browser);

  if (!!currentHandle && currentHandle !== browser.electron.windowHandle) {
    log.debug(
      'Window is changed. Switching to new window',
      `New window handle: ${currentHandle}`,
      `Old window handle: ${browser.electron.windowHandle}`,
    );
    await browser.switchToWindow(currentHandle);
    browser.electron.windowHandle = currentHandle;
  }
};

export const executeWindowManagement = async (
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser | undefined,
  commandName: string,
) => {
  const excludeCommands = ['getWindowHandle', 'getWindowHandles', 'switchToWindow', 'execute'];
  if (!browser || excludeCommands.includes(commandName)) {
    return;
  }
  log.debug(`Start executing window management for command: ${commandName}`);
  if (browser.isMultiremote) {
    const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
    for (const instance of mrBrowser.instances) {
      const mrInstance = mrBrowser.getInstance(instance);
      await followWindow(mrInstance);
    }
  } else {
    await followWindow(browser);
  }
  log.debug(`End executing window management for command: ${commandName}`);
};
