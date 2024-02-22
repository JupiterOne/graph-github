import { Octokit } from '@octokit/rest';
import { IntegrationConfig } from '../../config';
import {
  IntegrationError,
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import {
  CodeScanningAlertQueryResponse,
  OrgAppQueryResponse,
  OrgSecretRepoQueryResponse,
  RepoEnvironmentQueryResponse,
  SecretQueryResponse,
  SecretScanningAlertQueryResponse,
} from './types';
import { RepoData } from '../../types';
import { RequestError } from '@octokit/request-error';
import {
  AppScopes,
  IScopes,
  ScopesSet,
  TokenScopes,
  fetchScopes,
} from '../scopes';
import { fetchOrganizationLogin } from '../organizationLogin';
import { getAuthOptions } from '../auth';
import { getMetaResponse } from '../meta';
import { ResourceIteratee } from '../types';
import fetch from 'node-fetch';

export type GithubPagesInfo = {
  hasPages: boolean;
  pagesUrl?: string;
};

//MAX_RETRIES is an arbitrary number, but consider that it limits the number
// of retries for the entire client instance, not for a single request.
const MAX_RETRIES = 20;

export class GithubRestClient implements IScopes {
  /**
   * The base URL for the GitHub REST API.
   */
  private restApiUrl: string;

  /**
   * Documentation can be found here: https://github.com/octokit/rest.js
   */
  private octokit: Octokit;

  /**
   * The configuration for the integration instance.
   */
  private readonly config: IntegrationConfig;

  /**
   * The logger for the integration instance.
   */
  private readonly logger: IntegrationLogger;

  /**
   * The organization login.
   */
  private orgLogin: string | undefined;

  /**
   * The Github scopes from authentication response.
   */
  private scopes: ScopesSet | undefined;

  /**
   * The version of the GitHub Enterprise Server, if applicable.
   * This is only fetched once and then cached.
   * If the version is not applicable, it will be set to null.
   */
  private gheServerVersion: string | null | undefined;

  constructor(config: IntegrationConfig, logger: IntegrationLogger) {
    this.config = config;
    this.logger = logger;
    this.restApiUrl = config.githubApiBaseUrl.includes('api.github.com')
      ? config.githubApiBaseUrl
      : `${config.githubApiBaseUrl}/api/v3`;

    //https://github.com/octokit/plugin-throttling.js/
    //https://github.com/octokit/plugin-retry.js/
    const OctokitThrottling = Octokit.plugin(throttling, retry);

    this.octokit = new OctokitThrottling({
      baseUrl: this.restApiUrl,
      ...getAuthOptions(config),
      request: {
        fetch: fetch,
      },
      userAgent: 'jupiter-integration-github',
      throttle: {
        onRateLimit: (retryAfter, options) => {
          logger.warn(
            { retryAfter, options },
            `Rate limit reached for request "${options.method} ${options.url}"`,
          );
          if (options.request.retryCount < MAX_RETRIES) {
            // Retry twice
            return true;
          }
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          logger.warn(
            { retryAfter, options },
            `Secondary rate limit reached for request "${options.method} ${options.url}"`,
          );
          // Note: retryCount represents the number of retries for the entire client instance, not for a single request.
          if (options.request.retryCount < MAX_RETRIES) {
            return true;
          }
        },
      },
    });
  }

  public async verifyAuthentication(): Promise<void> {
    try {
      const response = await getMetaResponse(this.config);
      const meta = response.data as { installed_version?: string };
      const gheServerVersion = meta.installed_version;
      if (gheServerVersion) {
        this.logger.info(
          { gheServerVersion },
          'GitHub Enterprise Server version',
        );
      }
    } catch (err) {
      if (err instanceof RequestError) {
        throw new IntegrationProviderAuthenticationError({
          endpoint: err.response?.url ?? `${this.restApiUrl}/meta`,
          status: err.status,
          statusText: String(err.status),
        });
      }
      throw new IntegrationProviderAuthenticationError({
        endpoint: `${this.restApiUrl}/meta`,
        status: 403,
        statusText: 'Unauthorized',
      });
    }
  }

  async getGithubEnterpriseServerVersion(): Promise<string | null> {
    if (this.gheServerVersion === undefined) {
      const response = await getMetaResponse(this.config);
      const meta = response.data as { installed_version?: string };
      this.gheServerVersion = meta.installed_version ?? null;
    }
    return this.gheServerVersion;
  }

  async getOrganizationLogin(): Promise<string> {
    if (this.orgLogin) {
      return this.orgLogin;
    }

    this.orgLogin = await fetchOrganizationLogin(this.config);

    if (!this.orgLogin) {
      throw new IntegrationError({
        code: 'ORG_LOGIN_NOT_FOUND',
        message: 'Organization login was not found or could not be determined',
      });
    }

    return this.orgLogin;
  }

  async getScopes(): Promise<ScopesSet | undefined> {
    if (!this.scopes) {
      this.scopes = await fetchScopes(this.config);
    }

    return this.scopes;
  }

  /**
   * Fetch information on Github Pages a specific repo
   *
   * @param repoOwner - e.g. JupiterOne
   * @param repoName - e.g. graph-github
   */
  @AppScopes(['pages'])
  @TokenScopes(['repo'])
  public async fetchPagesInfoForRepo(
    repoOwner: string,
    repoName: string,
  ): Promise<GithubPagesInfo | undefined> {
    try {
      const getPagesReponse = await this.octokit.rest.repos.getPages({
        repo: repoName,
        owner: repoOwner,
      });
      return {
        hasPages: true,
        pagesUrl: getPagesReponse.data.html_url || getPagesReponse.data.url,
      };
    } catch (err) {
      if (err.status === 404) {
        return {
          hasPages: false,
        };
      }
      throw new IntegrationProviderAPIError({
        endpoint: this.restApiUrl,
        status: err.status,
        statusText: err.statusText,
        message: 'Encountered error while fetching Github Pages info for repo',
      });
    }
  }

  /**
   * Iterates each Github organization secret.
   *
   * @param allRepos
   * @param iteratee receives each resource to produce entities/relationships
   */
  @AppScopes(['organization_secrets'])
  @TokenScopes(['admin:org'])
  async iterateOrgSecrets(
    allRepos: Map<string, RepoData>,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    await this.iterateOrganizationSecrets(async (orgSecret) => {
      //set repos that use this secret, so we can make relationships in iteratee
      orgSecret.visibility === 'all'
        ? (orgSecret.repos = Array.from(allRepos.values()))
        : (orgSecret.repos = []);
      if (
        orgSecret.visibility === 'selected' ||
        orgSecret.visibility === 'private'
      ) {
        //go get the list of repos and add them
        const secretRepos: RepoData[] = [];
        await this.iterateReposForOrgSecret(orgSecret.name, (repo) => {
          const repoTag = Array.from(allRepos.values()).find(
            (r) => r._key === repo.node_id,
          );
          if (repoTag) {
            secretRepos.push(repoTag);
          }
        });
        orgSecret.repos = secretRepos;
      }
      await iteratee(orgSecret);
    });
  }

  private async iterateOrganizationSecrets(
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      // https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#list-organization-secrets
      const iterator = this.octokit.paginate.iterator(
        'GET /orgs/{org}/actions/secrets',
        {
          org,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const secret of response.data) {
          await iteratee(secret);
        }
      }
    } catch (err) {
      this.logger.warn('Error while attempting to ingest organization secrets');
      throw new IntegrationError(err);
    }
  }

  private async iterateReposForOrgSecret(
    secretName: string,
    iteratee: ResourceIteratee<OrgSecretRepoQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      //https://docs.github.com/en/rest/reference/actions#list-selected-repositories-for-an-organization-secret
      const iterator = this.octokit.paginate.iterator(
        'GET /orgs/{org}/actions/secrets/{secret_name}/repositories',
        {
          org,
          secret_name: secretName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const repo of response.data) {
          await iteratee(repo);
        }
      }
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest repos for an organization secret',
      );
      throw new IntegrationError(err);
    }
  }

  @AppScopes(['security_events'])
  @TokenScopes(['repo', 'security_events'])
  async iterateCodeScanningAlerts(
    iteratee: ResourceIteratee<CodeScanningAlertQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.codeScanning.listAlertsForOrg,
        {
          org,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const alert of response.data) {
          await iteratee(alert);
        }
      }
    } catch (err) {
      this.logger.warn(
        'Error while attempting to ingest organization code scanning alerts',
      );
      throw new IntegrationError(err);
    }
  }

  @AppScopes(['secret_scanning_alerts'])
  @TokenScopes(['repo', 'security_events'])
  async iterateSecretScanningAlerts(
    iteratee: ResourceIteratee<SecretScanningAlertQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.secretScanning.listAlertsForOrg,
        {
          org,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const alert of response.data) {
          await iteratee(alert);
        }
      }
    } catch (err) {
      this.logger.warn(
        err,
        'Error while attempting to ingest organization secret scanning alerts',
      );
      throw new IntegrationError(err);
    }
  }

  @AppScopes(['secrets'])
  @TokenScopes(['repo'])
  async iterateRepoSecrets(
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    const owner = await this.getOrganizationLogin();
    try {
      //https://docs.github.com/en/rest/reference/actions#list-repository-secrets
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.actions.listRepoSecrets,
        {
          owner,
          repo: repoName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const repoSecret of response.data) {
          await iteratee(repoSecret);
        }
      }
    } catch (err) {
      if (err.status === 403) {
        this.logger.info(
          { repoName },
          `Repo returned a 403 unauthorized when secrets requested. This is caused by repos with more restrictive privacy settings`,
        );
      } else {
        this.logger.warn(
          { err },
          'Error while attempting to ingest repo secrets. This was mostly like NOT caused by a restrictive privacy setting.',
        );
        throw new IntegrationError(err);
      }
    }
  }

  @AppScopes(['actions'])
  @TokenScopes(['repo'])
  async iterateEnvironments(
    repoName: string,
    iteratee: ResourceIteratee<RepoEnvironmentQueryResponse>,
  ): Promise<void> {
    // Note: Environments are available on GraphQL now, but with many less properties
    const owner = await this.getOrganizationLogin();
    try {
      //https://docs.github.com/en/rest/reference/repos#get-all-environments
      const iterator = this.octokit.paginate.iterator(
        'GET /repos/{owner}/{repo}/environments',
        {
          owner,
          repo: repoName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const environment of response.data) {
          if (environment) {
            await iteratee(environment);
          }
        }
      }
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        // private repos can only use environments in Enterprise level GitHub accounts
        // you get 404 if you try to call the REST API for environments on a private repo otherwise
        // but we don't know whether the account is Enterprise level, so we have to try private repos
        // once we move getEnvironments to GraphQL, this won't be an issue - private repos will simply
        // not be included in the API reply
        // 403 can happen if the GitHub App is not permitted to access all repos
        return;
      } else {
        this.logger.warn(
          { repoName },
          `Error while attempting to ingest environments for repo ${repoName}`,
        );
        throw new IntegrationError(err);
      }
    }
  }

  @AppScopes(['secrets'])
  @TokenScopes(['repo'])
  async iterateEnvSecrets(
    repoDatabaseId: number,
    envName: string,
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    try {
      // https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#list-environment-secrets
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.actions.listEnvironmentSecrets,
        {
          repository_id: repoDatabaseId,
          environment_name: envName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const secret of response.data) {
          await iteratee(secret);
        }
      }
    } catch (err) {
      if (err.status === 403) {
        // This is caused by repos with more restrictive privacy settings
        this.logger.warn(
          { repoName },
          `Repo returned a 403 unauthorized when environmental secrets requested.`,
        );
        return;
      }
      throw new IntegrationProviderAPIError({
        message: repoName + ': ' + err.message,
        status: err.status,
        statusText: err.statusText,
        cause: err,
        endpoint: `${this.restApiUrl}/repositories/${repoDatabaseId}/environments/${envName}/secrets`,
      });
    }
  }

  @AppScopes(['organization_administration'])
  @TokenScopes(['read:org', 'admin:org'])
  async iterateApps(
    iteratee: ResourceIteratee<OrgAppQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      const reply = await this.octokit.rest.orgs.listAppInstallations({
        org,
      });
      if (reply.data.installations) {
        for (const installation of reply.data?.installations ?? []) {
          await iteratee(installation);
        }
      } else {
        this.logger.warn({}, 'Found no installed GitHub apps');
      }
    } catch (err) {
      this.logger.warn(
        { err },
        'Error while attempting to ingest to installed GitHub apps',
      );
      throw new IntegrationError(err);
    }
  }
}

let restClientInstance: GithubRestClient | undefined;
export function getOrCreateRestClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): GithubRestClient {
  if (!restClientInstance) {
    restClientInstance = new GithubRestClient(config, logger);
  }

  return restClientInstance;
}
