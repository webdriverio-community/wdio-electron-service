import path from 'node:path';

const getBinaryExtension = (packageName: string) => {
  if (process.platform === 'darwin') {
    return `.app/Contents/MacOS/${packageName}`;
  } else if (process.platform === 'win32') {
    return '.exe';
  }

  return '';
};

export const getBinaryPath = (exampleDir: string, rootDir: string) => {
  const packageName = `example-${exampleDir}`;
  const builderBinaryDirMap = (arch: string) => ({
    darwin: arch === 'x64' ? 'mac' : `mac-${arch}`,
    linux: 'linux-unpacked',
    win32: 'win-unpacked',
  });
  const isForge = exampleDir.startsWith('forge');
  const outputDir = isForge ? 'out' : 'dist';
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const binaryDir = isForge
    ? `${packageName}-${process.platform}-${process.arch}`
    : builderBinaryDirMap(process.arch)[platform];
  const binaryName = `${packageName}${getBinaryExtension(packageName)}`;

  return path.join(rootDir, 'examples', exampleDir, outputDir, binaryDir, binaryName);
};
