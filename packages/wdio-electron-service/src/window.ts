import { createLogger } from '@wdio/electron-utils';

const log = createLogger('service');

import type { Browser as PuppeteerBrowser } from 'puppeteer-core';

const puppeteerSessionManager = new Map<string, PuppeteerBrowser>();

export const getActiveWindowHandle = async (puppeteerBrowser: PuppeteerBrowser, currentHandle?: string) => {
  log.trace('Getting active window handle');

  if (!puppeteerBrowser) {
    log.trace('Puppeteer is not initialized.');
    return undefined;
  }

  const handles = puppeteerBrowser
    .targets()
    .filter((target) => target.type() === 'page')
    .map((target) => (target as unknown as { _targetId: string })._targetId);

  // No windows available
  if (handles.length === 0) {
    log.trace('No windows found');
    return undefined;
  }

  // If we have a current window handle and it's still valid, keep using it
  if (currentHandle && handles.includes(currentHandle)) {
    log.trace(`Keeping current window handle: ${currentHandle}`);
    return currentHandle;
  }

  // Otherwise return first available window handle
  log.trace(`Selecting first available window handle: ${handles[0]}`);
  return handles[0];
};

const switchToActiveWindow = async (browser: WebdriverIO.Browser, puppeteerBrowser: PuppeteerBrowser) => {
  const activeHandle = await getActiveWindowHandle(puppeteerBrowser, browser.electron.windowHandle);

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
      const mrPuppeteer = await getPuppeteer(mrInstance);
      await switchToActiveWindow(mrInstance, mrPuppeteer);
    }
  } else {
    const puppeteer = await getPuppeteer(browser);
    await switchToActiveWindow(browser, puppeteer);
  }
  log.trace(`Window focus check completed for command: ${commandName}`);
};

export async function getPuppeteer(browser: WebdriverIO.Browser): Promise<PuppeteerBrowser> {
  const sessionId = browser.sessionId;
  const puppeteer = puppeteerSessionManager.get(sessionId);
  if (puppeteer) {
    log.trace(`Use cached puppeteer browser.`);
    return puppeteer;
  } else {
    log.trace(`Get puppeteer browser.`);
    const puppeteer = await browser.getPuppeteer();
    puppeteerSessionManager.set(sessionId, puppeteer);
    return puppeteer;
  }
}

export function clearPuppeteerSessions() {
  log.trace(`Remove all puppeteer sessions`);
  puppeteerSessionManager.clear();
}
