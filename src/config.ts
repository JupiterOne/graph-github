import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';
import { createAPIClient } from './client';

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
    type: 'string',
  },
  githubAppLocalPrivateKeyPath: {
    type: 'string',
  },
  githubAppLocalCallbackUrl: {
    type: 'string',
  },
  installationId: {
    type: 'string',
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
  githubAppId: string;

  /**
   * The local path to your PEM file for authentication
   */
  githubAppLocalPrivateKeyPath: string;

  /**
   * The callback URL used by the GitHub app to reply. Probably a smee.io link.
   */
  githubAppLocalCallbackUrl: string;

  /**
   * The ID number assigned to the installation, delivered to the callback URL above.
   */
  installationId: string;
}

export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>,
) {
  const { config } = context.instance;

  if (!config.githubAppId || !config.githubAppLocalPrivateKeyPath || !config.installationId) {
    throw new IntegrationValidationError(
      'Config requires all of {githubAppId, githubAppLocalPrivateKeyPath, installationId}',
    );
  }
  const apiClient = createAPIClient(config, context.logger);
  await apiClient.verifyAuthentication();
}
