import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// TypeScript types
type PlatformMap = {
  [key: string]: string;
};

interface DownloadOptions {
  url: string;
  targetPath: string;
  maxRedirects?: number;
}

// Get electron version from environment
const electronVersion = process.env.ELECTRON_VERSION;

if (!electronVersion) {
  console.error('Error: ELECTRON_VERSION environment variable is not set');
  process.exit(1);
}

console.log(`Using Electron version: ${electronVersion}`);

// Determine platform and architecture
const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

// Map to Electron's naming conventions
const platformMap: PlatformMap = {
  win32: 'win32',
  darwin: 'darwin',
  linux: 'linux',
};

const electronPlatform = platformMap[platform];

if (!electronPlatform) {
  console.error('Unsupported platform:', platform);
  process.exit(1);
}

// Get current working directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

// Create cache directory if it doesn't exist
const cacheDir = path.join(workspaceRoot, 'electron-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Calculate hash directory - same structure Electron uses
const getPlatformArch = (): string => {
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (platform === 'win32') return arch === 'arm64' ? 'win32-arm64' : 'win32-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return `${platform}-${arch}`;
};

// Construct download URL and filename
const platformArch = getPlatformArch();
const filename = `electron-v${electronVersion}-${platformArch}.zip`;
const url = `https://github.com/electron/electron/releases/download/v${electronVersion}/${filename}`;
const targetPath = path.join(cacheDir, filename);

console.log(`Downloading Electron v${electronVersion} for ${platformArch} from ${url}`);

// Function to handle redirects
const downloadWithRedirects = ({ url, targetPath, maxRedirects = 5 }: DownloadOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    const tryDownload = (currentUrl: string): void => {
      console.log(`Trying download from: ${currentUrl}`);

      https
        .get(currentUrl, (response) => {
          // Check if we received a redirect
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            if (redirectCount >= maxRedirects) {
              reject(new Error(`Too many redirects (${redirectCount})`));
              return;
            }

            redirectCount++;
            const redirectUrl = new URL(response.headers.location, currentUrl).toString();
            console.log(`Redirected to: ${redirectUrl}`);
            tryDownload(redirectUrl);
            return;
          }

          // Check for success
          if (!response.statusCode || response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
            return;
          }

          // Write the file
          const file = fs.createWriteStream(targetPath);
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log(`Downloaded to ${targetPath}`);
            resolve();
          });

          file.on('error', (err) => {
            fs.unlinkSync(targetPath);
            reject(err);
          });
        })
        .on('error', reject);
    };

    tryDownload(url);
  });
};

// Execute the download
downloadWithRedirects({ url, targetPath })
  .then(() => {
    // Create proper directory structure for Electron Forge's expectations
    if (platform === 'darwin') {
      // Create the hash directory like Electron does
      const shasum = createHash('sha256');
      shasum.update(`v${electronVersion}-${platformArch}`);
      const hashDir = shasum.digest('hex');

      console.log(`Creating Electron cache structure with hash: ${hashDir}`);

      const dirPath = path.join(cacheDir, hashDir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Copy the zip file to the hash directory
      const destPath = path.join(dirPath, filename);
      fs.copyFileSync(targetPath, destPath);
      console.log(`Copied to ${destPath}`);
    } else if (platform === 'win32') {
      const versionCacheDir = path.join(cacheDir, electronVersion);
      if (!fs.existsSync(versionCacheDir)) {
        fs.mkdirSync(versionCacheDir, { recursive: true });
      }

      // Copy the file to the versioned directory
      try {
        fs.copyFileSync(targetPath, path.join(versionCacheDir, filename));
        console.log(`Copied to ${path.join(versionCacheDir, filename)}`);
      } catch (error) {
        console.error('Error copying file:', error);
        process.exit(1);
      }
    } else if (platform === 'linux') {
      // On Linux, create both version directory and hash directory to be safe
      const versionCacheDir = path.join(cacheDir, electronVersion);
      if (!fs.existsSync(versionCacheDir)) {
        fs.mkdirSync(versionCacheDir, { recursive: true });
      }

      // Also copy to version directory
      try {
        fs.copyFileSync(targetPath, path.join(versionCacheDir, filename));
        console.log(`Copied to ${path.join(versionCacheDir, filename)}`);
      } catch (error) {
        console.error('Error copying file:', error);
      }
    }

    console.log('Electron binary prepared successfully!');
  })
  .catch((error) => {
    console.error('Download error:', error);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    process.exit(1);
  });
