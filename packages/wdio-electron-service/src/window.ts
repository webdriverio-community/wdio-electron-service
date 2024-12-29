import log from '@wdio/electron-utils/log';

export const getWindowHandle = async (browser: WebdriverIO.Browser) => {
  if (browser.isMultiremote) {
    return;
  }
  const handles = await browser.getWindowHandles();
  if (handles.length === 1) {
    return handles[0];
  } else {
    return;
  }
};

const followWindow = async (browser: WebdriverIO.Browser) => {
  const currentHandle = await getWindowHandle(browser);

  if (!!currentHandle && currentHandle !== browser.electron.windowHandle) {
    if (browser.electron.windowHandle) {
      log.debug(
        'Window is changed.',
        `New window handle: ${currentHandle}`,
        `Old window handle: ${browser.electron.windowHandle}`,
      );
    }
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
  if (browser.isMultiremote) {
    const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
    for (const instance of mrBrowser.instances) {
      const mrInstance = mrBrowser.getInstance(instance);
      await followWindow(mrInstance);
    }
  } else {
    await followWindow(browser);
  }
};
