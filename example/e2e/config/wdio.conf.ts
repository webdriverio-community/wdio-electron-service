import { config as baseConfig } from '../../wdio.conf.js';

process.env.TEST = 'true';

export const config = {
    ...baseConfig,
    specs: ['../*.spec.ts'],
}
