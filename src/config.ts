import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfig,
  IntegrationIngestionConfigFieldMap,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import { getOrCreateApiClient } from './client';
const fs = require('fs');
import { URL } from 'url';
import { IngestionSources } from './constants';

/**
 * A type describing the configuration fields required to execute the
 * integration for a specific account in the data provider.
 *
 * When executing the integration in a development environment, these values may
 * be provided in a `.env` file with environment variables.
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
   * Array of alert states used to filter alerts.
   */
  dependabotAlertStates: string[];

  /**
   * Array of severities used to filter alerts.
   */
  dependabotAlertSeverities: string[];
}

export type Scopes = {
  codeScanningAlerts: boolean;
  orgAdmin: boolean;
  orgSecrets: boolean;
  repoAdmin: boolean;
  repoSecrets: boolean;
  repoPages: boolean;
  repoEnvironments: boolean;
  repoIssues: boolean;
  dependabotAlerts: boolean;
  repoDiscussions: boolean;
  secretScanningAlerts: boolean;
};

type AuthenticationData = {
  scopes: Scopes;
  gheServerVersion?: string;
};

async function sanitizeAndVerifyAuthentication(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): Promise<AuthenticationData> {
  sanitizeConfig(config); // Mutate the config as needed

  const apiClient = getOrCreateApiClient(config, logger);
  await apiClient.verifyAuthentication();

  return {
    scopes: apiClient.scopes,
    gheServerVersion: apiClient.gheServerVersion,
  };
}

export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<void> {
  const { instance, logger } = context;
  const { config } = instance;
  await sanitizeAndVerifyAuthentication(config, logger);
}

export async function validateAndReturnAuthenticationData(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<AuthenticationData> {
  const { instance, logger } = context;
  const { config } = instance;
  return await sanitizeAndVerifyAuthentication(config, logger);
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

  config.pullRequestIngestStartDatetime =
    config.pullRequestIngestStartDatetime ||
    process.env['PULL_REQUEST_INGEST_START_DATETIME']; // Expects Date.toISOString format

  config.pullRequestMaxResourcesPerRepo =
    config.pullRequestMaxResourcesPerRepo ||
    process.env['PULL_REQUEST_MAX_RESOURCES_PER_REPO'];

  config.pullRequestMaxSearchLimit =
    config.pullRequestMaxSearchLimit ||
    process.env['PULL_REQUEST_MAX_SEARCH_LIMIT'];

  config.dependabotAlertRequestLimit =
    config.dependabotAlertRequestLimit ||
    process.env['DEPENDABOT_ALERT_REQUEST_LIMIT'];

  config.dependabotAlertSeverities = config.dependabotAlertSeverities ?? [];
  config.dependabotAlertStates = config.dependabotAlertStates ?? [];

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

export const ingestionConfig: IntegrationIngestionConfigFieldMap = {
  [IngestionSources.CODE_SCANNING_ALERTS]: {
    title: 'GitHub Code Scanning Alerts',
    description: 'Alerts from CodeQL analysis or a third-party analysis.',
  },
  [IngestionSources.BRANCH_PROTECTION_RULES]: {
    title: 'GitHub Branch Protection Rules',
    description:
      'Configurable restrictions and requirements imposed on a branch.',
  },
  [IngestionSources.VULNERABILITY_ALERTS]: {
    title: 'GitHub Dependabot Vulnerability Alerts',
    defaultsToDisabled: true,
    description:
      'Automated notifications about security vulnerabilities present in code dependencies.',
  },
  [IngestionSources.PRS]: {
    title: 'GitHub Pull Requests',
    description:
      'Proposed changes to a codebase allowing reviews and discussion.',
  },
  [IngestionSources.ISSUES]: {
    title: 'GitHub Repository Issues',
    description: 'Used for tracking and discussing problems, ideas, and more.',
  },
  [IngestionSources.APPS]: {
    title: 'GitHub Applications',
    description: 'Applications installed within an organization.',
  },
  [IngestionSources.ENVIRONMENTS]: {
    title: 'GitHub Environments',
    description:
      'Used to describe a general deployment target like production, staging, or development',
  },
  [IngestionSources.ORG_SECRETS]: {
    title: 'GitHub Organization Secrets',
    description: 'Secrets metadata available in an organization.',
  },
  [IngestionSources.ENV_SECRETS]: {
    title: 'GitHub Environment Secrets',
    description: 'Secrets metadata available in an environment.',
  },
  [IngestionSources.REPO_SECRETS]: {
    title: 'GitHub Repository Secrets',
    description: 'Secrets metadata available in a repository.',
  },
  [IngestionSources.SECRET_SCANNING_ALERTS]: {
    title: 'GitHub Secret Scanning Alerts',
    description:
      'Alerts for potential leaks of known secrets in public repositories',
  },
};
