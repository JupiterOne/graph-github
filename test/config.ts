import * as dotenv from 'dotenv';
import * as path from 'path';
import { IntegrationConfig } from '../src/config';
import { getFakeRsaKey } from '../src/util/sha';
import { invocationConfig } from '../src';
import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import { StepTestConfig } from '@jupiterone/integration-sdk-testing';

if (process.env.LOAD_ENV) {
  dotenv.config({
    path: path.join(__dirname, '../.env'),
  });
}

// JupiterOne-Sandbox Account values
const GITHUB_APP_ID = 278393;
const INSTALLATION_ID = 32841752;
//@octokit client instantiation requires a private RSA Key
const APP_PRIVATE_KEY = getFakeRsaKey();

export const integrationConfig: IntegrationConfig = {
  githubAppId: Number(process.env.GITHUB_APP_ID) || GITHUB_APP_ID,
  githubAppPrivateKey: APP_PRIVATE_KEY,
  installationId: Number(process.env.INSTALLATION_ID) || INSTALLATION_ID,
  githubAppDefaultLogin: 'something', //can be set manually in tests
  githubApiBaseUrl: 'https://api.github.com',
} as IntegrationConfig; // casting config instead of setting useRestForTeamRepos to imitate configs already in production

export function buildStepTestConfig(stepId: string): StepTestConfig {
  return {
    stepId,
    instanceConfig: integrationConfig,
    invocationConfig: invocationConfig as IntegrationInvocationConfig,
  };
}
