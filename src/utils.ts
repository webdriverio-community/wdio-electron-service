import path from 'node:path';

export function getBinaryPath(appPath: string, appName: string, distDirName = 'dist') {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const { platform, arch } = process;

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const pathMap = {
    darwin: path.join(arch === 'arm64' ? 'mac-arm64' : 'mac', `${appName}.app`, 'Contents', 'MacOS', appName),
    linux: path.join('linux-unpacked', appName),
    win32: path.join('win-unpacked', `${appName}.exe`),
  };

  const electronPath = pathMap[platform as keyof typeof SupportedPlatform];

  return path.join(appPath, distDirName, electronPath);
}
