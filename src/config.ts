import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';
import { createAPIClient } from './client';
import fetchPrivateKey from './util/fetchPrivateKey';

/**
 * A type describing the configuration fields required to execute the
 * integration for a specific account in the data provider.
 *
 * When executing the integration in a development environment, these values may
 * be provided in a `.env` file with environment variables. For example:
 *
 * - `CLIENT_ID=123` becomes `instance.config.clientId = '123'`
 * - `CLIENT_SECRET=abc` becomes `instance.config.clientSecret = 'abc'`
 *
 * Environment variables are NOT used when the integration is executing in a
 * managed environment. For example, in JupiterOne, users configure
 * `instance.config` in a UI.
 */
export const instanceConfigFields: IntegrationInstanceConfigFieldMap = {
  githubAppId: {
    type: 'string', //should be a number, but that's not an option in the SDK
  },
  githubAppLocalPrivateKeyPath: {
    type: 'string', //only used for local configs
  },
  installationId: {
    type: 'string', //should be a number, but that's not an option in the SDK
  },
  analyzeCommitApproval: {
    type: 'boolean',
  },
};

/**
 * Properties provided by the `IntegrationInstance.config`. This reflects the
 * same properties defined by `instanceConfigFields`.
 */
export interface IntegrationConfig extends IntegrationInstanceConfig {
  /**
   * The GitHub App ID of the application at https://github.com/settings/apps
   */
  githubAppId: number;

  /**
   * The private key to authenticate the GitHub App.
   * This can come from a local config variable GITHUB_APP_LOCAL_PRIVATE_KEY_PATH
   * or if that doesn't exist, from a config variable GITHUB_APP_PRIVATE_KEY_PARAM
   * See validateInvocation below
   */
  githubAppPrivateKey: string;

  /**
   * The ID number assigned to the installation, delivered to the callback URL above.
   */
  installationId: number;

  /**
   * Whether to analyze commit approvals as part of pull-requests
   */
  analyzeCommitApproval: boolean;
}

export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>,
) {
  const { config } = context.instance;

  await sanitizeConfig(config); //mutate the config as needed
  const apiClient = createAPIClient(config, context.logger);
  await apiClient.verifyAuthentication();
}

export async function sanitizeConfig(config: IntegrationConfig) {
  config.githubAppPrivateKey = 'temp';
  config.githubAppPrivateKey = await fetchPrivateKey({
    privateKeyEnvLocalPathParam: 'GITHUB_APP_LOCAL_PRIVATE_KEY_PATH',
    privateKeyEnvSsmParam: 'GITHUB_APP_PRIVATE_KEY', //this a hack. We need to define the real param.
  });

  if (
    !config.githubAppId ||
    !config.githubAppPrivateKey ||
    !config.installationId
  ) {
    throw new IntegrationValidationError(
      'Config requires all of {githubAppId, githubAppPrivateKey, installationId}',
    );
  }
}
