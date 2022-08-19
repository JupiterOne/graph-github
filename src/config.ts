import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';
import { getOrCreateApiClient } from './client';
const fs = require('fs');
import { URL } from 'url';

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
 *
 * This integration will actually have a disparity between the instanceConfigFields
 * that will come from local execution and the fields used in the managed environment.
 * Specifically, local execution will use githubAppLocalPrivateKeyPath to load the
 * path to a .pem file on the local filesystem. That file will load the real field,
 * githubAppPrivateKey, that is used in the managed environment.
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
};

/**
 * Properties provided by the `IntegrationInstance.config`. Normally reflects the
 * same properties defined by `instanceConfigFields`. See note above.
 */
export interface IntegrationConfig extends IntegrationInstanceConfig {
  /**
   * The GitHub App ID of the application at https://github.com/settings/apps.
   * In the managed environment for GitHub Cloud, this field is set by the environment.
   * In the managed environment for GitHub Enterprise Server, this field is filled in
   * by the user.
   */
  githubAppId: number;

  /**
   * The private key to authenticate the GitHub App.
   * In the managed environment for GitHub Cloud, this field will be passed in.
   * In the managed environment for GitHub Enterprise Server, this field is filled in
   * by the user.
   *
   * Since the key is typically a long RSA hash, it is more convenient in
   * the local environment to store that value in a file than to put it directly
   * in .env. The .env variable GITHUB_APP_LOCAL_PRIVATE_KEY_PATH is provided for
   * this purpose. If it exists, sanitizeConfig() below will load the text of
   * the file (pointed to by that path) into GITHUB_APP_PRIVATE_KEY.
   */
  githubAppPrivateKey: string;

  /**
   * The ID number assigned to the installation.
   * In the managed environment for GitHub Cloud, the authentication flow automatically
   * populates this field.
   * In the managed environment for GitHub Enterprise Server, this value is filled in by the user.
   */
  installationId: number;

  /**
   * Optional. Login is usually derived from a call to the API,
   * but if that fails or is not available, processing can proceed
   * if this var is specified.
   */
  githubAppDefaultLogin: string;

  /**
   * Indicates if the integration is being configured
   * for a GitHub Enterprise Server.
   */
  configureGitHubEnterpriseServer: boolean;

  /**
   * Used during GitHub Enterprise Server Configuration. Defaults to api.github.com.
   *
   * Supported protocols include http & https.
   * Url must include host. A provided path will be ignored.
   * Valid example: my.github.com or https://my.git.org
   */
  githubApiBaseUrl: string;

  /**
   * Boolean indicating if dependabot alerts should be ingested.
   */
  enableDependabotAlerts: boolean;

  /**
   * Array of alert states used to filter alerts.
   */
  dependabotAlertStates: string[];

  /**
   * Array of severities used to filter alerts.
   */
  dependabotAlertSeverities: string[];
}

export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<{
  orgAdmin: boolean;
  orgSecrets: boolean;
  repoSecrets: boolean;
  repoEnvironments: boolean;
  repoIssues: boolean;
  dependabotAlerts: boolean;
}> {
  const { config } = context.instance;

  sanitizeConfig(config); //mutate the config as needed

  const apiClient = getOrCreateApiClient(config, context.logger);
  await apiClient.verifyAuthentication();
  return apiClient.scopes;
}

/**
 * Modifies config based on auth approach: local, cloud, GHE
 * @param config
 */
export function sanitizeConfig(config: IntegrationConfig) {
  const localPath = process.env['GITHUB_APP_LOCAL_PRIVATE_KEY_PATH'];
  if (localPath) {
    let content;
    try {
      content = fs.readFileSync(localPath);
    } catch (err) {
      // basically not there
    }
    if (content) {
      config.githubAppPrivateKey = content.toString();
    } else {
      throw new IntegrationValidationError(
        `'GITHUB_APP_LOCAL_PRIVATE_KEY_PATH' ${localPath}: cannot read content`,
      );
    }
  }

  // First use env var (local dev), next config for managed env, and then default to api.github.com
  config.githubApiBaseUrl = validateBaseUrl(
    process.env['GITHUB_API_BASE_URL'] ??
      config.githubApiBaseUrl ??
      'https://api.github.com',
  );

  config.enableDependabotAlerts =
    config.enableDependabotAlerts ||
    Boolean(process.env['ENABLE_DEPENDABOT_ALERTS']);

  config.pullRequestIngestStartDatetime =
    config.pullRequestIngestStartDatetime ||
    process.env['PULL_REQUEST_INGEST_START_DATETIME']; // Expects Date.toISOString format

  config.pullRequestMaxResourcesPerRepo =
    config.pullRequestMaxResourcesPerRepo ||
    process.env['PULL_REQUEST_MAX_RESOURCES_PER_REPO'];

  if (config.enableDependabotAlerts) {
    config.dependabotAlertSeverities = config.dependabotAlertSeverities ?? [];
    config.dependabotAlertStates = config.dependabotAlertStates ?? [];
  }

  if (
    !config.githubAppId ||
    !config.githubAppPrivateKey ||
    !config.installationId ||
    !config.githubApiBaseUrl
  ) {
    throw new IntegrationValidationError(
      'Config requires all of {githubAppId, githubAppPrivateKey, installationId, githubApiBaseUrl}',
    );
  }
}

export function validateBaseUrl(baseUrl: string): string {
  let validBaseUrl = baseUrl;
  if (!baseUrl.startsWith('http')) {
    validBaseUrl = `https://${baseUrl}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(validBaseUrl);
  } catch (e) {
    throw new IntegrationValidationError(
      'Config requires valid URL for githubApiBaseUrl.',
    );
  }

  return `${parsedUrl.protocol}//${parsedUrl.host}`;
}
