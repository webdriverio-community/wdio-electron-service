import path from 'node:path';

export function getBinaryPath(appPath: string, appName: string, distDirName = 'dist', p = process) {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  if (!Object.values(SupportedPlatform).includes(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }

  const pathMap = {
    darwin: path.join(p.arch === 'arm64' ? 'mac-arm64' : 'mac', `${appName}.app`, 'Contents', 'MacOS', appName),
    linux: path.join('linux-unpacked', appName),
    win32: path.join('win-unpacked', `${appName}.exe`),
  };

  const electronPath = pathMap[p.platform as keyof typeof SupportedPlatform];

  return path.join(appPath, distDirName, electronPath);
}
