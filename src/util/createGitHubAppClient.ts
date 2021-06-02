import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { throttling } from '@octokit/plugin-throttling';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import fetchPrivateKey from '../util/fetchPrivateKey';
import { IntegrationConfig } from '../config';

const MAX_RETRIES = 20; //an arbitrary number

export default async function createGitHubAppClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
) {
  const appId = Number(config.githubAppId);
  const installationId = Number(config.installationId);
  if (!appId) {
    throw new Error('GITHUB_APP_ID must be defined!');
  }

  const OctokitThrottling = Octokit.plugin(throttling);

  /*
   * API preview header "machine-man" (required for all endpoints requiring JWT
   * authentication) is automatically appended to all requests by the auth hook
   * returned from createAppAuth (the hook is registered on Octokit instance
   * here: https://github.com/octokit/core.js/blob/master/src/index.ts#L132).
   *
   * The auth hook also authenticates requests, manages cached JWTs and tokens,
   * and authenticates using the installation ID passed to createAppAuth.
   */
  const v3 = new OctokitThrottling({
    userAgent: 'jupiter-integration-github',
    authStrategy: createAppAuth,
    // Options passed to authStrategy
    auth: {
      id: appId,
      privateKey: await fetchPrivateKey({
        privateKeyEnvLocalPathParam: 'GITHUB_APP_LOCAL_PRIVATE_KEY_PATH',
        privateKeyEnvSsmParam: 'GITHUB_APP_PRIVATE_KEY_PARAM',
      }),
      installationId: installationId,
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        logger.warn({ retryAfter, options }, 'Rate limit reached for request.');

        /**
         * An important thing to know: retryCount represents the number of
         * retries for the entire client instance, not for a single request.
         */
        if (options.request.retryCount < MAX_RETRIES) {
          // Retry twice
          return true;
        }
      },
      onAbuseLimit: (retryAfter: number, options: any) => {
        logger.warn(
          { retryAfter, options },
          'Abuse limit reached for request.',
        );

        if (options.request.retryCount < MAX_RETRIES) {
          return true;
        }
      },
    },
  });

  return v3;
}
