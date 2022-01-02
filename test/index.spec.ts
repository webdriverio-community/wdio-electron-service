import DefaultClass, { launcher as LauncherClass } from '../src/index';
import ElectronWorkerService from '../src/service';
import ChromedriverLauncher from '../src/launcher';

it('should export the expected classes', () => {
  const workerInstance = new DefaultClass({});
  expect(workerInstance).toBeInstanceOf(ElectronWorkerService);
  const launcherInstance = new LauncherClass({}, {}, {});
  expect(launcherInstance).toBeInstanceOf(ChromedriverLauncher);
});
