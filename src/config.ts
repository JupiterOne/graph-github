import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfig,
  IntegrationIngestionConfigFieldMap,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import fs from 'node:fs';
import { URL } from 'url';
import { IngestionSources } from './constants';
import { getOrCreateRestClient } from './client/RESTClient/client';
import { ScopesSet } from './client/scopes';

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
export const instanceConfigFields: IntegrationInstanceConfigFieldMap<IntegrationConfig> =
  {
    selectedAuthType: {
      type: 'string',
    },
    enterpriseToken: {
      type: 'string',
      optional: true,
    },
    enterpriseSlug: {
      type: 'string',
      optional: true,
    },
    organization: {
      type: 'string',
      optional: true,
    },
    githubAppId: {
      type: 'string',
      optional: true,
    },
    // Used only for local execution.
    githubAppLocalPrivateKeyPath: {
      type: 'string',
      optional: true,
    },
    githubAppPrivateKey: {
      type: 'string',
      optional: true,
    },
    installationId: {
      type: 'string',
      optional: true,
    },
    githubApiBaseUrl: {
      type: 'string',
      optional: true,
    },
    pullRequestIngestStartDatetime: {
      type: 'string',
      optional: true,
    },
    pullRequestMaxResourcesPerRepo: {
      type: 'string',
      optional: true,
    },
    pullRequestMaxSearchLimit: {
      type: 'string',
      optional: true,
    },
    dependabotAlertStates: {
      type: 'string',
      optional: true,
    },
    dependabotAlertSeverities: {
      type: 'string',
      optional: true,
    },
  };

export interface IntegrationGithubAppConfig extends BaseIntegrationConfig {
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
}

export interface IntegrationGithubCloudConfig
  extends IntegrationGithubAppConfig {
  selectedAuthType: 'githubCloud';
}

export interface IntegrationGithubEnterpriseServerConfig
  extends IntegrationGithubAppConfig {
  selectedAuthType: 'githubEnterpriseServer';
}

export interface IntegrationGithubEnterpriseTokenConfig
  extends BaseIntegrationConfig {
  selectedAuthType: 'githubEnterpriseToken';
  /**
   * The Enterprise Owner personal access token (classic).
   */
  enterpriseToken: string;

  /**
   * The enterprise slug.
   */
  enterpriseSlug: string;

  /**
   * The organization login to ingest from.
   */
  organization: string;
}

/**
 * Properties provided by the `IntegrationInstance.config`. Normally reflects the
 * same properties defined by `instanceConfigFields`. See note above.
 */
export interface BaseIntegrationConfig extends IntegrationInstanceConfig {
  /**
   * Used during GitHub Enterprise Server Configuration. Defaults to api.github.com.
   *
   * Supported protocols include http & https.
   * Url must include host. A provided path will be ignored.
   * Valid example: my.github.com or https://my.git.org
   */
  githubApiBaseUrl: string;

  /**
   * The date and time to start ingesting pull requests in ISO 8601 format.
   */
  pullRequestIngestStartDatetime?: string;

  /**
   * The maximum number of resources to ingest per repository.
   */
  pullRequestMaxResourcesPerRepo?: number;

  /**
   * The maximum number of pull requests to fetch per page.
   */
  pullRequestMaxSearchLimit?: number;

  /**
   * Array of alert states used to filter alerts.
   */
  dependabotAlertStates?: string[];

  /**
   * Array of severities used to filter alerts.
   */
  dependabotAlertSeverities?: string[];

  /**
   * @deprecated
   *
   * Optional. Login is usually derived from a call to the API,
   * but if that fails or is not available, processing can proceed
   * if this var is specified.
   */
  githubAppDefaultLogin?: string;

  /**
   * @deprecated
   *
   * Indicates if the integration is being configured
   * for a GitHub Enterprise Server.
   */
  configureGitHubEnterpriseServer?: boolean;
}

export type IntegrationConfig =
  | IntegrationGithubCloudConfig
  | IntegrationGithubEnterpriseServerConfig
  | IntegrationGithubEnterpriseTokenConfig;

export interface ExecutionConfig {
  logIdentityMetrics?: boolean;
}

type AuthenticationData = {
  scopes: ScopesSet | undefined;
  gheServerVersion: string | null;
};

async function sanitizeAndVerifyAuthentication(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): Promise<AuthenticationData> {
  sanitizeConfig(config); // Mutate the config as needed

  const restClient = getOrCreateRestClient(config, logger);
  await restClient.verifyAuthentication();

  return {
    scopes: await restClient.getScopes(),
    gheServerVersion: await restClient.getGithubEnterpriseServerVersion(),
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

function getLocalPrivateKey(): string | undefined {
  const localPath = process.env['GITHUB_APP_LOCAL_PRIVATE_KEY_PATH'];
  if (!localPath) {
    return;
  }
  try {
    const content = fs.readFileSync(localPath);
    return content.toString();
  } catch (err) {
    throw new IntegrationValidationError(
      `'GITHUB_APP_LOCAL_PRIVATE_KEY_PATH' ${localPath}: cannot read content`,
    );
  }
}

/**
 * Modifies config based on auth approach: local, cloud, GHE
 * @param config
 */
export function sanitizeConfig(config: IntegrationConfig) {
  // First use env var (local dev), next config for managed env, and then default to api.github.com
  config.githubApiBaseUrl = validateBaseUrl(
    process.env['GITHUB_API_BASE_URL'] ??
      config.githubApiBaseUrl ??
      'https://api.github.com',
  );

  if (config.selectedAuthType === 'githubEnterpriseToken') {
    if (
      !config.enterpriseToken ||
      !config.enterpriseSlug ||
      !config.organization
    ) {
      throw new IntegrationValidationError(
        'Config requires all of {enterpriseToken, enterpriseSlug, organization}',
      );
    }
  } else {
    // -- selectedAuthType is either 'githubCloud' or 'githubEnterpriseServer' --
    const localPrivateKey = getLocalPrivateKey();
    if (localPrivateKey) {
      config.githubAppPrivateKey = localPrivateKey;
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

  config.pullRequestIngestStartDatetime =
    config.pullRequestIngestStartDatetime ??
    process.env['PULL_REQUEST_INGEST_START_DATETIME']; // Expects Date.toISOString format

  const pullRequestMaxResourcesPerRepo =
    config.pullRequestMaxResourcesPerRepo ??
    process.env['PULL_REQUEST_MAX_RESOURCES_PER_REPO'];
  if (pullRequestMaxResourcesPerRepo) {
    config.pullRequestMaxResourcesPerRepo = Number(
      pullRequestMaxResourcesPerRepo,
    );
  }

  const pullRequestMaxSearchLimit =
    config.pullRequestMaxSearchLimit ??
    process.env['PULL_REQUEST_MAX_SEARCH_LIMIT'];
  if (pullRequestMaxSearchLimit) {
    config.pullRequestMaxSearchLimit = Number(pullRequestMaxSearchLimit);
  }

  const dependabotAlertSeverities =
    config.dependabotAlertSeverities ??
    process.env['DEPENDABOT_ALERT_SEVERITIES'];
  if (dependabotAlertSeverities) {
    config.dependabotAlertSeverities =
      typeof dependabotAlertSeverities === 'string'
        ? dependabotAlertSeverities.split(',').map((state) => state.trim())
        : config.dependabotAlertSeverities ?? [];
  }

  const dependabotAlertStates =
    config.dependabotAlertStates ?? process.env['DEPENDABOT_ALERT_STATES'];
  if (dependabotAlertStates) {
    config.dependabotAlertStates =
      typeof dependabotAlertStates === 'string'
        ? dependabotAlertStates.split(',').map((state) => state.trim())
        : dependabotAlertStates ?? [];
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
  // TODO: enable when this is ready https://jupiterone.atlassian.net/browse/INT-9938
  // [IngestionSources.SECRET_SCANNING_ALERTS]: {
  //   title: 'GitHub Secret Scanning Alerts',
  //   description:
  //     'Alerts for potential leaks of known secrets in public repositories',
  //   defaultsToDisabled: true,
  // },
};
