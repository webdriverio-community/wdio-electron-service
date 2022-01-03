import DefaultClass, { launcher as LauncherClass } from '../src/index';
import ElectronWorkerService from '../src/service';
import ChromedriverLauncher from '../src/launcher';

it('should export the expected classes', () => {
  const workerInstance = new DefaultClass({
    appPath: '/mock/path',
    appName: 'mock-app',
  });
  expect(workerInstance).toBeInstanceOf(ElectronWorkerService);
  const launcherInstance = new LauncherClass({}, {}, {});
  expect(launcherInstance).toBeInstanceOf(ChromedriverLauncher);
});
