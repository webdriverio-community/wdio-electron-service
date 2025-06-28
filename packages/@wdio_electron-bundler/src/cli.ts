#!/usr/bin/env node

import { Command } from 'commander';
import { buildCommand } from './cli/commands.js';

const program = new Command();

program.name('wdio-bundler').description('WebdriverIO Electron Service bundler CLI').version('8.2.1');

// Unified build command with all options
program
  .command('build')
  .description('Build project using generated rollup configuration')
  .option('--dry-run', 'Show generated config without building')
  .option('--export-config [path]', 'Export rollup config to file (default: rollup.config.js)')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--vv, --extra-verbose', 'Show extra detailed progress')
  .action(buildCommand);

program.parse();
