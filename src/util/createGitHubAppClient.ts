import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../config';

//MAX_RETRIES is an arbitrary number, but consider that it limits the number
// of retries for the entire client instance, not for a single request.
const MAX_RETRIES = 20;

export default function createGitHubAppClient(
  restApiBaseUrl: string,
  config: IntegrationConfig,
  logger: IntegrationLogger,
) {
  const appId = config.githubAppId;
  const installationId = config.installationId;
  const privateKey = config.githubAppPrivateKey;
  if (!appId) {
    throw new Error('GITHUB_APP_ID must be defined!');
  }

  //https://github.com/octokit/plugin-throttling.js/
  //https://github.com/octokit/plugin-retry.js/
  const OctokitThrottling = Octokit.plugin(throttling, retry);

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
    baseUrl: restApiBaseUrl,
    authStrategy: createAppAuth,
    // Options passed to authStrategy
    auth: {
      appId: appId,
      privateKey: privateKey,
      installationId: installationId,
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        logger.warn({ retryAfter, options }, 'Rate limit reached for request.');
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
        // Note: retryCount represents the number of retries for the entire client instance, not for a single request.
        if (options.request.retryCount < MAX_RETRIES) {
          return true;
        }
      },
    },
  });

  return v3;
}
