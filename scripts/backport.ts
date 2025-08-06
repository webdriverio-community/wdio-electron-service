#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { input, select } from '@inquirer/prompts';
import { Octokit } from '@octokit/rest';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import shell from 'shelljs';

// Dynamically determine versions from package.json
const determineVersions = async () => {
  try {
    const pkgPath = path.join(process.cwd(), 'packages/wdio-electron-service/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const maintenanceMajorVersion = parseInt(pkg.version.split('.')[0], 10);
    const currentMajorVersion = maintenanceMajorVersion + 1;

    return {
      activeLTSVersion: `v${currentMajorVersion}.x`,
      maintenanceLTSVersion: `v${maintenanceMajorVersion}.x`,
    };
  } catch (_error) {
    console.warn('Could not determine versions automatically from package.json');

    // Ask the user to provide the versions
    console.log('Please provide the version information:');
    const activeMajor = await input({
      message: 'What is the current active major version? (e.g., 8 for v8.x)',
      default: '8',
    });

    const maintenanceMajor = await input({
      message: 'What is the maintenance major version? (e.g., 7 for v7.x)',
      default: String(parseInt(activeMajor, 10) - 1),
    });

    return {
      activeLTSVersion: `v${activeMajor}.x`,
      maintenanceLTSVersion: `v${maintenanceMajor}.x`,
    };
  }
};

const { activeLTSVersion, maintenanceLTSVersion } = await determineVersions();

const TARGET_REPO = {
  OWNER: 'webdriverio-community',
  NAME: 'wdio-electron-service',
};
const PR_LABEL = {
  REQUESTED: 'backport:requested',
  COMPLETED: 'backport:completed',
};

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const QUESTIONS = {
  BACKPORT_CONFIRM: {
    message: `Do you want to backport this PR?`,
    choices: [
      {
        name: 'Yes, I want to backport this PR.',
        value: 'continue',
      },
      {
        name: 'No, skip this PR and proceed to next PR.',
        value: 'skip',
      },
      {
        name: 'No, abort this script.',
        value: 'abort',
      },
    ],
  },
  BACKPORT_CONFLICT: {
    message: `Conflicts are detected. How you want to handle this error?`,
    choices: [
      {
        name: 'Continue',
        value: true,
        description:
          `Run "git cherry-pick --continue" to continue the process.\n` +
          `(Please resolve the conflicts BEFORE selecting this option.)`,
      },
      {
        name: 'Abort',
        value: false,
        description: `Run "git cherry-pick --abort" and abort this script.`,
      },
    ],
  },
  BACKPORT_ERROR: {
    message: `An Error occurred. How do you want to handle this error?`,
    choices: [
      {
        name: 'Continue',
        value: 'continue',
        description:
          `I will fix the error and continue the backport process.\n` +
          `(Please resolve the error BEFORE selecting this option.)`,
      },
      {
        name: 'Skip and Continue',
        value: 'skip',
        description: `Ignore this PR and continue the backport process.`,
      },
      {
        name: 'Abort',
        value: 'abort',
        description: `Abort this script.`,
      },
    ],
  },
};
type PullRequest = GetResponseDataTypeFromEndpointMethod<Octokit['rest']['pulls']['list']> extends (infer U)[]
  ? U
  : never;
type BackportResult = { exit: boolean; isError: boolean };

console.log(`Welcome to the backport script for ${maintenanceLTSVersion}! 🚀`);
console.log(`Will backport changes from ${activeLTSVersion} to ${maintenanceLTSVersion}`);

/**
 * Global error handling
 */
process.on('uncaughtException', (error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    console.log('Process exited by Cntl-C! 👋');
  } else if (error instanceof Error) {
    console.error(`${error.message} 💥`);
    process.exit(1);
  } else {
    throw error;
  }
});

/**
 * check if `GITHUB_TOKEN` environment variable is set to interact with GitHub API
 */
if (!GITHUB_TOKEN) {
  throw new Error('Please create the file ".env" in the project root with the access token set as "GITHUB_TOKEN".');
}

/**
 * check if user is in right branch
 */
const { stdout: branch } = shell.exec('git rev-parse --abbrev-ref HEAD', { silent: true });
if (branch.trim() !== maintenanceLTSVersion) {
  throw new Error(
    'In order to start the backport process switch to the maintenance LTS branch via:\n' +
      `$ git checkout ${maintenanceLTSVersion}`,
  );
}

/**
 * Global variables
 */
const api = new Octokit({ auth: GITHUB_TOKEN });
const exec = (command: string) => {
  console.log(`> ${command}`);
  return shell.exec(command);
};
const answerHandler = (answer: string, question: string): BackportResult | undefined => {
  switch (answer) {
    case 'continue':
      // pass
      return;
    case 'skip':
    case 'abort':
      console.log(`Skip this PR.`);
      return {
        exit: answer === 'abort',
        isError: true,
      };
    default:
      throw `Received unknown answer: ${question}`;
  }
};
/**
 * Backport process
 * @param pr Pull request to backport
 * @returns result of backport process
 */
const backport = async (pr: PullRequest): Promise<BackportResult> => {
  console.log(
    [
      `\n${'='.repeat(80)}`,
      `PR: #${pr.number} - ${pr.title}`,
      `Author: ${pr.user?.login || 'unknown user'}`,
      `URL: ${pr.html_url}`,
      '-'.repeat(80),
    ].join('\n'),
  );

  const toBackport = answerHandler(await select(QUESTIONS.BACKPORT_CONFIRM), 'BACKPORT_CONFIRM');

  if (toBackport) {
    return toBackport;
  }

  console.log(`Backporting sha ${pr.merge_commit_sha} from ${activeLTSVersion} to ${maintenanceLTSVersion}`);

  const cherryPickResult = exec(`git cherry-pick -x -m 1 ${pr.merge_commit_sha}`);
  if (cherryPickResult.stdout && /CONFLICT/.test(cherryPickResult.stdout)) {
    const isContinue = await select(QUESTIONS.BACKPORT_CONFLICT);
    if (isContinue) {
      const cherryPickContinueResult = exec(`git cherry-pick --continue --no-edit`);
      if (cherryPickContinueResult.code !== 0) {
        return { exit: true, isError: true };
      }
    } else {
      exec(`git cherry-pick --abort`);
      return { exit: true, isError: true };
    }
  } else if (cherryPickResult.code !== 0) {
    const isContinue = answerHandler(await select(QUESTIONS.BACKPORT_ERROR), 'BACKPORT_ERROR');
    if (isContinue) {
      return isContinue;
    }
  }
  /**
   * switch labels
   */
  await Promise.all([
    api.issues.removeLabel({
      owner: TARGET_REPO.OWNER,
      repo: TARGET_REPO.NAME,
      issue_number: pr.number,
      name: PR_LABEL.REQUESTED,
    }),
    api.issues.addLabels({
      owner: TARGET_REPO.OWNER,
      repo: TARGET_REPO.NAME,
      issue_number: pr.number,
      labels: [PR_LABEL.COMPLETED],
    }),
  ]);

  return { exit: false, isError: false };
};

const backportRun = async (prsToBackport: PullRequest[]): Promise<number> => {
  if (prsToBackport.length < 1) {
    return prsToBackport.length;
  }

  let countBackportedPR = 0;
  for (const prToBackport of prsToBackport) {
    const result = await backport(prToBackport);
    if (!result.isError) {
      countBackportedPR++;
    }
    if (result.exit) {
      break;
    }
  }
  return countBackportedPR;
};

const getBackportPRs = async (): Promise<PullRequest[]> => {
  const prs = await api.pulls.list({
    owner: TARGET_REPO.OWNER,
    repo: TARGET_REPO.NAME,
    state: 'closed',
    sort: 'created',
    direction: 'desc',
    per_page: 100,
  });

  const prsToBackport = prs.data
    .filter((pr) => pr.labels.find((label) => label.name === PR_LABEL.REQUESTED) && Boolean(pr.merged_at))
    .reverse();
  return prsToBackport;
};

/**
 * execute the main process
 */
try {
  const prsToBackport = await getBackportPRs();
  const backportedPrs = await backportRun(prsToBackport);

  console.log(
    backportedPrs
      ? `\nSuccessfully backported ${backportedPrs} PRs 👏!\n` +
          `Please now push them to ${maintenanceLTSVersion} and make a new ${maintenanceLTSVersion}.x release!`
      : '\nNothing to backport! Bye 👏!',
  );
} catch (error) {
  console.error('Error in backport script:', error);
  process.exit(1);
}
