import { parseTimePropertyValue } from '@jupiterone/integration-sdk-core';
import {
  createMockIntegrationLogger,
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { integrationConfig } from '../../../test/config';
import { setupGithubRecording } from '../../../test/recording';
import { IntegrationConfig, sanitizeConfig } from '../../config';
import createGitHubAppClient from '../../util/createGitHubAppClient';
import { GitHubGraphQLClient } from './';

// Tests start with an expired token. You can see that refresh worked
// because there are two calls for an access token in each polly recording,
// recorded one second apart.

async function getAccess() {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  const config = context.instance.config;
  sanitizeConfig(config);

  const appClient = createGitHubAppClient(
    'https://api.github.com',
    config,
    createMockIntegrationLogger(),
  );
  const { token, expiresAt } = (await appClient.auth({
    type: 'installation',
  })) as {
    token: string;
    expiresAt: string;
  };
  const tokenExpires = parseTimePropertyValue(expiresAt) || 0;
  return { token, tokenExpires, appClient };
}

async function getClient() {
  const { token, tokenExpires, appClient } = await getAccess();
  return new GitHubGraphQLClient(
    'https://api.github.com/graphql',
    token,
    tokenExpires * 0, //making this be time zero simulates an expired token and forces a refresh
    createMockIntegrationLogger(),
    appClient,
  );
}

describe('GraphQLClient.query', () => {
  let polly: Recording;

  afterEach(async () => {
    await polly.stop();
  });

  test('#query', async () => {
    polly = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.refreshTokenQuery',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const query = `
      query ($login: String!) {
      organization(login: $login) {
        id
        name
        description
      }
      rateLimit {
        cost
        remaining
      }
    }`;
    const queryVariables = {
      login: 'j1-ingest',
    };

    const response = await client.query(query, queryVariables);
    expect(response).toBeDefined();
  });
});
