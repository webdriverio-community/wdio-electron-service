import { testAppsManager } from '../e2e/setup/testAppsManager.js';

async function cleanup() {
  await testAppsManager.cleanup();
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
