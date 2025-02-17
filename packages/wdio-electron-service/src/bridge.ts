import log from '@wdio/electron-utils/log';
import { SevereServiceError } from 'webdriverio';

export const getDebuggerEndpoint = (capabilities: WebdriverIO.Capabilities) => {
  log.trace('Try to detect the node debugger endpoint');

  const debugArg = capabilities['goog:chromeOptions']?.args?.find((item) => item.startsWith('--inspect='));
  log.trace(`Detected debugger args: ${debugArg}`);

  const debugUrl = debugArg ? debugArg.split('=')[1] : undefined;
  const [host, strPort] = debugUrl ? debugUrl.split(':') : [];
  const result = { host, port: Number(strPort) };

  if (!result.host || !result.port) {
    throw new SevereServiceError(`Failed to detect the debugger endpoint.`);
  }

  log.trace(`Detected the node debugger endpoint: `, result);
  return result;
};
