import { Octokit } from '@octokit/rest';
import { IntegrationConfig } from '../../config';
import {
  IntegrationError,
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';
import { StrategyOptions, createAppAuth } from '@octokit/auth-app';
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
import { AccountType, RepoData } from '../../types';
import { RequestError } from '@octokit/request-error';
import {
  AppScopes,
  ClassicTokenScopes,
  IScopes,
  ScopesSet,
  scope,
} from '../scopes';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
export type GithubPagesInfo = {
  hasPages: boolean;
  pagesUrl?: string;
};

//MAX_RETRIES is an arbitrary number, but consider that it limits the number
// of retries for the entire client instance, not for a single request.
const MAX_RETRIES = 20;

function getAuthOptions(config: IntegrationConfig) {
  let authOptions: {
    authStrategy?: typeof createAppAuth;
    auth: string | StrategyOptions;
  };
  if (config.selectedAuthType === 'githubEnterpriseToken') {
    authOptions = { auth: config.githubEnterpriseToken };
  } else {
    authOptions = {
      authStrategy: createAppAuth,
      auth: {
        appId: config.githubAppId,
        privateKey: config.githubAppPrivateKey,
        installationId: config.installationId,
      },
    };
  }
  return authOptions;
}

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
  private ghServerVersion: string | null | undefined;

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
      userAgent: 'jupiter-integration-github',
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn(
            { retryAfter, options },
            'Rate limit reached for request.',
          );
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
  }

  public async verifyAuthentication(): Promise<void> {
    try {
      const response = await this.octokit.meta.get();
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

  async getGithubServerVersion(): Promise<string | null> {
    if (this.ghServerVersion === undefined) {
      const response = await this.octokit.meta.get();
      const meta = response.data as { installed_version?: string };
      this.ghServerVersion = meta.installed_version ?? null;
    }
    return this.ghServerVersion;
  }

  async getOrganizationLogin(): Promise<string> {
    if (this.orgLogin) {
      return this.orgLogin;
    }

    if (this.config.selectedAuthType === 'githubEnterpriseToken') {
      this.orgLogin = this.config.organization;
    } else {
      try {
        const {
          data: installation,
          status,
          url,
        } = await this.octokit.apps.getInstallation({
          installation_id: this.config.installationId,
        });

        if (!installation) {
          throw new IntegrationProviderAPIError({
            endpoint: url,
            status,
            statusText: String(status),
            message:
              'Response from GitHub API did not include installation data',
          });
        }

        if (installation.target_type !== AccountType.Org) {
          throw new IntegrationValidationError(
            'Integration supports only GitHub Organization accounts.',
          );
        }

        this.orgLogin =
          installation?.account?.login ?? this.config.githubAppDefaultLogin;
      } catch (err) {
        throw new IntegrationError({
          code: 'APP_INSTALLATION_NOT_FOUND',
          message:
            'Github App installation associated with this integration instance no longer exists',
          cause: err,
        });
      }
    }

    if (!this.orgLogin) {
      throw new IntegrationError({
        code: 'ORG_LOGIN_NOT_FOUND',
        message: 'Organization login was not found or could not be determined',
      });
    }

    return this.orgLogin;
  }

  async getScopes(): Promise<ScopesSet | undefined> {
    if (this.scopes) {
      return this.scopes;
    }

    if (this.config.selectedAuthType === 'githubEnterpriseToken') {
      const response = await this.octokit.request('HEAD /');
      const scopesHeader = response.headers['x-oauth-scopes'];
      this.scopes = scopesHeader
        ? new Set(scopesHeader.split(/,\s+/) as ClassicTokenScopes[])
        : undefined;
    } else {
      const response = await this.octokit.apps.getInstallation({
        installation_id: this.config.installationId,
      });
      const permissions = Object.keys(response.data.permissions) as AppScopes[];
      this.scopes = permissions.length ? new Set(permissions) : undefined;
    }
    return this.scopes;
  }

  /**
   * Fetch information on Github Pages a specific repo
   *
   * @param repoOwner - e.g. JupiterOne
   * @param repoName - e.g. graph-github
   */
  @scope(['pages'], 'Pages Info')
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
  @scope(['organization_secrets'], 'Org Secrets')
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
        // TODO: check that this property returns the correct data
        for (const secret of response.data.secrets) {
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
        // TODO: check that this property returns the correct data
        for (const repo of response.data.repositories) {
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

  @scope(['security_events'], 'Code Scanning Alerts')
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

  @scope(['secret_scanning_alerts'], 'Secret Scanning Alerts')
  async iterateSecretScanningAlerts(
    iteratee: ResourceIteratee<SecretScanningAlertQueryResponse>,
  ): Promise<void> {
    const org = await this.getOrganizationLogin();
    try {
      const iterator = this.octokit.paginate.iterator(
        'GET /orgs/{org}/secret-scanning/alerts',
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

  @scope(['secrets'], 'Repo Secrets')
  async iterateRepoSecrets(
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    const owner = await this.getOrganizationLogin();
    try {
      //https://docs.github.com/en/rest/reference/actions#list-repository-secrets
      const iterator = this.octokit.paginate.iterator(
        'GET /repos/{owner}/{repo}/actions/secrets',
        {
          owner,
          repo: repoName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        // TODO: check that this property returns the correct data
        for (const repoSecret of response.data.secrets) {
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

  @scope(['environments'], 'Environments')
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
        // TODO: check that this property returns the correct data
        for (const environment of response.data?.environments || []) {
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

  @scope(['secrets'], 'Env Secrets')
  async iterateEnvSecrets(
    repoDatabaseId: number,
    envName: string,
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    try {
      // https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#list-environment-secrets
      const iterator = this.octokit.paginate.iterator(
        'GET /repositories/{repository_id}/environments/{environment_name}/secrets',
        {
          repository_id: repoDatabaseId,
          environment_name: envName,
          per_page: 100,
        },
      );
      for await (const response of iterator) {
        for (const secret of response.data.secrets) {
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

  @scope(['organization_administration'], 'Github Apps')
  async iterateApps(
    iteratee: ResourceIteratee<OrgAppQueryResponse>,
  ): Promise<void> {
    //the endpoint needed is /orgs/${this.login}/installations
    //when we try to call it from the Octokit v3 REST client paginate function, we get 'bad credentials'
    //per GitHub tech support, this endpoint requires a token that starts with 'ghs'
    //the v3 Octokit REST client .auth call returns such a token, which we pass to the
    //v4 GraphQL client. However, the v4 GraphQL client does not appear to have access
    //to the Apps Nodes (as far as we can currently tell), and the v3 REST client does not
    //appear to use the 'ghs' token that it returns. When we use curl or a direct request
    //via @octokit/request, using the ghs token, the endpoint works. Attempts to override
    //the v3 REST client headers in the paginate function, in order to force it to use the
    //ghs token, have been unsuccessful. After several hours of experimentation and research,
    //the only thing that has worked in this direct call to @octokit/request, which is the v3 REST API.
    //It's not ideal to call that REST API without the client wrapper, because it is not a paginated call,
    //and it does not have rate-limit and retry functions. We could build our own pagination and
    //rate-limit aware wrapper for it, but if this endpoint is the only time we need @octokit/request,
    //we will probably be okay without pagination and rate-limit aware features, because there are
    //typically only going to be a few GitHub apps installed in a given organization.
    //TODO: a more elegant solution. Possibly making our own pagination and rate-limit aware wrapper.
    const org = await this.getOrganizationLogin();
    try {
      const reply = await this.octokit.request(
        `GET /orgs/{org}/installations`,
        {
          org,
        },
      );
      if (reply.data.installations) {
        for (const installation of reply.data.installations) {
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
