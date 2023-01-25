import ChromedriverLauncher from './launcher.js';
import ElectronWorkerService from './service.js';

export default ElectronWorkerService;
export const launcher = ChromedriverLauncher;
export type electronService = {
  api: (...arg: unknown[]) => Promise<unknown>;
  app: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  mainProcess: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  browserWindow: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
} & WebdriverIO.Browser;
