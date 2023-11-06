import {
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
  IntegrationWarnEventName,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig, Scopes } from './config';
import {
  AccountType,
  EnvironmentEntity,
  RepoEntity,
  RepoData,
  TeamEntity,
  TokenPermissions,
} from './types';
import getInstallation from './util/getInstallation';
import createGitHubAppClient from './util/createGitHubAppClient';
import OrganizationAccountClient from './client/OrganizationAccountClient';
import {
  GitHubGraphQLClient,
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgTeamRepoQueryResponse,
  VulnerabilityAlertResponse,
  BranchProtectionRuleResponse,
  TagQueryResponse,
  Review,
  Label,
  Commit,
  OrgExternalIdentifierQueryResponse,
  RepoConnectionFilters,
} from './client/GraphQLClient';
import {
  CodeScanningAlertQueryResponse,
  OrgAppQueryResponse,
  RepoEnvironmentQueryResponse,
  RepoTopicQueryResponse,
  SecretQueryResponse,
  SecretScanningAlertQueryResponse,
} from './client/RESTClient/types';
import {
  CollaboratorResponse,
  IssueResponse,
  PullRequestResponse,
} from './client/GraphQLClient';
import { Octokit } from '@octokit/rest';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
export type GithubPagesInfo = {
  hasPages: boolean;
  pagesUrl?: string;
};

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  graphQLClient: OrganizationAccountClient;
  restClient: Octokit;
  ghsToken: string;
  gheServerVersion?: string;
  scopes: Scopes;

  readonly restApiUrl: string;
  readonly graphqlUrl: string;

  constructor(
    readonly config: IntegrationConfig,
    readonly logger: IntegrationLogger,
  ) {
    this.restApiUrl = config.githubApiBaseUrl.includes('api.github.com')
      ? config.githubApiBaseUrl
      : `${config.githubApiBaseUrl}/api/v3`;
    // More info on baseUrl here: https://github.com/octokit/graphql.js/#use-with-github-enterprise
    this.graphqlUrl = config.githubApiBaseUrl.includes('api.github.com')
      ? config.githubApiBaseUrl
      : `${config.githubApiBaseUrl}/api`;

    this.logger.debug(
      { graphqlBaseUrl: this.graphqlUrl },
      'GraphQL client base URL.',
    );
  }

  public async verifyAuthentication(): Promise<void> {
    await this.fetchAndSetupMeta();
  }

  /**
   * Queries meta endpoint and saves the GHE Server version, if applicable.
   */
  private async fetchAndSetupMeta(): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const meta = await this.graphQLClient.fetchMeta();
    this.gheServerVersion = meta.installed_version ?? null;
    if (this.gheServerVersion) {
      this.logger.info(
        { gheServerVersion: this.gheServerVersion },
        'GitHub Enterprise Server version',
      );
    }
  }

  /**
   * Fetch the organization.
   */
  public async fetchOrganization() {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const { rateLimit, organization } =
      await this.graphQLClient.fetchOrganization();

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Organization.',
    );

    return organization;
  }

  /**
   * Fetch the pull request based on the provided params.
   * @param repoOwner e.g. - JupiterOne
   * @param repoName e.g. - graph-github
   * @param pullRequestNumber e.g. - 5
   */
  public async fetchPullRequest(
    repoOwner: string,
    repoName: string,
    pullRequestNumber: number,
  ) {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    return this.graphQLClient.fetchPullRequest(
      repoOwner,
      repoName,
      pullRequestNumber,
    );
  }

  /**
   * Iterates each member (user) resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateOrgMembers(
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateOrgMembers(iteratee);

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Org Members.',
    );
  }

  public async iterateTags(
    repoOwner: string,
    repoName: string,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ) {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateTags(
      repoOwner,
      repoName,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Repository Tags.',
    );
  }

  /**
   * Iterates each external identifier in the provider.
   *
   * @param iteratee receives each resource to produce an identifier lookup table
   */
  public async iterateOrgExternalIdentifiers(
    iteratee: ResourceIteratee<OrgExternalIdentifierQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit =
      await this.graphQLClient.iterateExternalIdentifiers(iteratee);

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Org Members.',
    );
  }

  /**
   * Iterates each team resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeams(
    iteratee: ResourceIteratee<OrgTeamQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateTeams(iteratee);

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Team Repositories.',
    );
  }

  /**
   * Iterates each team-repo association from the provider.
   *
   * @param team
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeamRepos(
    teamName: string,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateTeamRepositories(
      teamName,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Team Repositories.',
    );
  }

  /**
   * Iterates each team-repo association from the provider.
   *
   * @param team
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateBatchedTeamRepos(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateBatchedTeamRepositories(
      teamIds,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while batch fetching Team Repositories.',
    );
  }

  /**
   * Iterates each team-member association for a single team.
   *
   * @param team
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeamMembers(
    team: TeamEntity,
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iterateTeamMembers(
      team.name,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Team Members.',
    );
  }

  /**
   * Iterates each installed GitHub application.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateApps(
    iteratee: ResourceIteratee<OrgAppQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.orgAdmin) {
      const apps: OrgAppQueryResponse[] =
        await this.graphQLClient.getInstalledApps(this.ghsToken);
      for (const app of apps) {
        await iteratee(app);
      }
    }
  }

  /**
   * Iterates each Github organization secret.
   *
   * @param allRepos
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateOrgSecrets(
    allRepos: Map<string, RepoData>,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.orgSecrets) {
      const secrets: SecretQueryResponse[] =
        await this.graphQLClient.getOrganizationSecrets();
      for (const secret of secrets) {
        //set repos that use this secret, so we can make relationships in iteratree
        secret.visibility === 'all'
          ? (secret.repos = Array.from(allRepos.values()))
          : (secret.repos = []);
        if (
          secret.visibility === 'selected' ||
          secret.visibility === 'private'
        ) {
          //go get the list of repos and add them
          const reposForOrgSecret =
            await this.graphQLClient.getReposForOrgSecret(secret.name);
          const secretRepos: RepoData[] = [];
          for (const repo of reposForOrgSecret) {
            const repoTag = Array.from(allRepos.values()).find(
              (r) => r._key === repo.node_id,
            );
            if (repoTag) {
              secretRepos.push(repoTag);
            }
          }
          secret.repos = secretRepos;
        }
        await iteratee(secret);
      }
    }
  }

  /**
   * Iterates each Github repo secret.
   *
   * @param repoName
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateRepoSecrets(
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoSecrets) {
      await this.graphQLClient.getRepoSecrets(repoName, iteratee);
    }
  }

  /**
   * Iterates branch protection rules for the provided repoName.
   *
   * @param repoName
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateBranchProtectionPolicy(
    repoName: string,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.orgAdmin) {
      const rateLimit =
        await this.graphQLClient.iterateRepoBranchProtectionRules(
          repoName,
          iteratee,
          this.gheServerVersion,
        );

      this.logger.info(
        { rateLimit },
        'Rate limit consumed while fetching Branch Protection Rules.',
      );
    }
  }

  /**
   * Iterates branch protection rules for the provided repoIds.
   *
   * @param repoIds
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateBatchedBranchProtectionPolicy(
    repoIds: string[],
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.orgAdmin) {
      const rateLimit =
        await this.graphQLClient.iterateBatchedRepoBranchProtectionRules(
          repoIds,
          iteratee,
          this.gheServerVersion,
        );

      this.logger.info(
        { rateLimit },
        'Rate limit consumed while batch fetching Branch Protection Rules.',
      );
    }
  }

  /**
   * Iterates each Github environment.
   *
   * @param repoName
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateEnvironments(
    repoName: string,
    iteratee: ResourceIteratee<RepoEnvironmentQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoEnvironments) {
      const environments: RepoEnvironmentQueryResponse[] =
        await this.graphQLClient.getEnvironments(repoName);
      for (const env of environments) {
        await iteratee(env);
      }
    }
  }

  /**
   * Iterates each repository topic.
   *
   * @param repoName
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTopics(
    repoName: string,
    iteratee: ResourceIteratee<RepoTopicQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const topics: RepoTopicQueryResponse[] =
      await this.graphQLClient.getRepositoryTopics(repoName);
    for (const topic of topics) {
      await iteratee(topic);
    }
  }

  /**
   * Iterates each Github environmental secret.
   *
   * @param envEntity
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateEnvSecrets(
    envEntity: EnvironmentEntity,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoSecrets) {
      const envSecrets = await this.graphQLClient.getEnvSecrets(
        envEntity.parentRepoDatabaseId,
        envEntity.name,
        envEntity.parentRepoName,
      );
      for (const envSecret of envSecrets) {
        await iteratee(envSecret);
      }
    }
  }

  /**
   * fetch information on Github Pages a specific repo
   *
   * @param repoOwner e.g. - JupiterOne
   * @param repoName e.g. - graph-github
   */
  public async fetchPagesInfoForRepo(
    repoOwner: string,
    repoName: string,
  ): Promise<GithubPagesInfo> {
    if (!this.restClient) {
      await this.setupAccountClient();
    }
    try {
      const getPagesReponse = await this.restClient.rest.repos.getPages({
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
   * Iterates each repo (CodeRepo) resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateRepos(
    connectionFilters: Pick<RepoConnectionFilters, 'lastSuccessfulExecution'>,
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iterateOrgRepositories(
      iteratee,
      {
        ...connectionFilters,
        alertStates: this.config.dependabotAlertStates,
        gheServerVersion: this.gheServerVersion,
      },
    );
    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Org Repositories.',
    );
  }

  /**
   * Iterates each pull request (PR) resource in the provider.
   *
   * @param repo entity
   * @param logger logger
   * @param ingestStartDatetime date string
   * @param maxResourceIngestion
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iteratePullRequests(
    repo: RepoEntity,
    logger: IntegrationLogger,
    ingestStartDatetime: string,
    maxResourceIngestion: number,
    maxSearchLimit: number,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iteratePullRequestEntities(
      repo,
      ingestStartDatetime,
      maxResourceIngestion,
      maxSearchLimit,
      iteratee,
    );
    logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Pull Requests.',
    );
  }

  /**
   * Fetch all reviews from pull request resource in the provider.
   *
   * @param repo entity
   * @param pullRequestNumber number
   * @param logger logger
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateReviews(
    repo: RepoEntity,
    pullRequestNumber: number,
    logger: IntegrationLogger,
    iteratee: ResourceIteratee<Review>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iterateReviewEntities(
      repo,
      pullRequestNumber,
      iteratee,
    );
    logger.info({ rateLimit }, 'Rate limit consumed while fetching Reviews.');
  }

  /**
   * Fetch all labels from pull request resource in the provider.
   *
   * @param repo entity
   * @param pullRequestNumber number
   * @param logger logger
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateLabels(
    repo: RepoEntity,
    pullRequestNumber: number,
    logger: IntegrationLogger,
    iteratee: ResourceIteratee<Label>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iterateLabelEntities(
      repo,
      pullRequestNumber,
      iteratee,
    );
    logger.info({ rateLimit }, 'Rate limit consumed while fetching Labels.');
  }

  /**
   * Fetch all commits from pull request resource in the provider.
   *
   * @param repo entity
   * @param pullRequestNumber number
   * @param logger logger
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateCommits(
    repo: RepoEntity,
    pullRequestNumber: number,
    logger: IntegrationLogger,
    iteratee: ResourceIteratee<Commit>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    const rateLimit = await this.graphQLClient.iterateCommitEntities(
      repo,
      pullRequestNumber,
      iteratee,
    );
    logger.info({ rateLimit }, 'Rate limit consumed while fetching Commits.');
  }

  /**
   * Iterates each GitHub organization code scanning alerts.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateCodeScanningAlerts(
    iteratee: ResourceIteratee<CodeScanningAlertQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.codeScanningAlerts) {
      await this.graphQLClient.getCodeScanningAlerts(iteratee);
    }
  }

  /**
   * Iterates each GitHub organization secret scanning alerts.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateSecretScanningAlerts(
    iteratee: ResourceIteratee<SecretScanningAlertQueryResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.secretScanningAlerts) {
      await this.graphQLClient.getSecretScanningAlerts(iteratee);
    }
  }

  /**
   * Iterates the collaborators for a single repo.
   *
   * @param repoName name of the repository
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateRepoCollaborators(
    repoName: string,
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateRepoCollaborators(
      repoName,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Collaborators.',
    );
  }

  /**
   * Iterates the collaborators for a multiple repos.
   *
   * @param repoName name of the repository
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateBatchedRepoCollaborators(
    repoIds: string[],
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateBatchedRepoCollaborators(
      repoIds,
      iteratee,
    );

    this.logger.info(
      { rateLimit },
      'Rate limit consumed while batch fetching Collaborators.',
    );
  }

  /**
   * Iterates the issues for a repo in the provider.
   *
   * @param repo
   * @param lastSuccessfulExecution
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateIssues(
    repoName: string,
    lastSuccessfulExecution: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoIssues) {
      const rateLimit = await this.graphQLClient.iterateIssueEntities(
        repoName,
        lastSuccessfulExecution,
        iteratee,
      );
      this.logger.info(
        { rateLimit },
        'Rate limit consumed while fetching Issues.',
      );
    } else {
      this.logger.info(
        'Repo issues scope was not provided, skipping Issue ingestion.',
      );
    }
  }

  /**
   * Iterates the issues for a repo in the provider.
   *
   * @param repo
   * @param lastSuccessfulExecution
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateBatchedIssues(
    repoIds: string[],
    lastSuccessfulExecution: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<void> {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoIssues) {
      const rateLimit = await this.graphQLClient.iterateBatchedIssueEntities(
        repoIds,
        lastSuccessfulExecution,
        iteratee,
      );
      this.logger.info(
        { rateLimit },
        'Rate limit consumed while fetching batched Issues.',
      );
    } else {
      this.logger.info(
        'Repo issues scope was not provided, skipping batched Issue ingestion.',
      );
    }
  }

  public async iterateRepoVulnAlerts(
    repoName: string,
    maxRequestLimit: number,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ) {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateRepoVulnAlerts(
      repoName,
      iteratee,
      {
        states: this.config.dependabotAlertStates,
        severities: this.config.dependabotAlertSeverities,
      },
      maxRequestLimit,
      this.gheServerVersion,
    );
    this.logger.info(
      { rateLimit },
      'Rate limit consumed while fetching Vulnerability Alerts.',
    );
  }

  public async iterateBatchedRepoVulnAlerts(
    repoIds: string[],
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ) {
    if (!this.graphQLClient) {
      await this.setupAccountClient();
    }

    const rateLimit = await this.graphQLClient.iterateBatchedRepoVulnAlerts(
      repoIds,
      iteratee,
      {
        states: this.config.dependabotAlertStates,
        severities: this.config.dependabotAlertSeverities,
      },
      this.gheServerVersion,
    );
    this.logger.info(
      { rateLimit },
      'Rate limit consumed while batch fetching Vulnerability Alerts.',
    );
  }

  /**
   * Will set up this.graphQLClient and this.restClient
   */
  public async setupAccountClient(): Promise<void> {
    if (isNaN(this.config.installationId)) {
      throw new IntegrationValidationError(
        'Integration id should be a number.',
      );
    }

    const appClient = createGitHubAppClient(
      this.restApiUrl,
      this.config,
      this.logger,
    );

    let tokenExpires: number;
    let myPermissions: TokenPermissions;
    try {
      const { token, permissions, expiresAt } = (await appClient.auth({
        type: 'installation',
      })) as {
        token: string;
        permissions: TokenPermissions;
        expiresAt: string;
      };

      this.ghsToken = token;
      myPermissions = permissions;
      tokenExpires = parseTimePropertyValue(expiresAt) || 0;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: err.response?.url,
        status: err.status,
        statusText: err.response?.data?.message,
      });
    }

    if (myPermissions) {
      this.processScopes(myPermissions);
    } else {
      throw new IntegrationValidationError(
        'Installed GitHub app did not provide any permissions. Aborting step.',
      );
    }

    const installationId = Number(this.config.installationId);
    const installation = await getInstallation(appClient, installationId);
    if (installation.target_type !== AccountType.Org) {
      throw new IntegrationValidationError(
        'Integration supports only GitHub Organization accounts.',
      );
    }

    this.restClient = appClient;
    this.graphQLClient = new OrganizationAccountClient({
      login: installation?.account?.login ?? this.config.githubAppDefaultLogin,
      baseUrl: this.restApiUrl,
      restClient: appClient,
      graphqlClient: new GitHubGraphQLClient(
        this.graphqlUrl,
        this.ghsToken,
        tokenExpires,
        this.logger,
        appClient,
      ),
      logger: this.logger,
    });
  }

  private processScopes(perms: TokenPermissions) {
    if (!this.scopes) {
      this.scopes = {
        codeScanningAlerts: false,
        orgAdmin: false,
        orgSecrets: false,
        repoAdmin: false,
        repoSecrets: false,
        repoEnvironments: false,
        repoIssues: false,
        dependabotAlerts: false,
        repoPages: false,
        repoDiscussions: false,
        secretScanningAlerts: false,
      };
    }
    this.logger.info({ perms }, 'Permissions received with token');

    //checking for proper scopes
    if (!(perms.members === 'read' || perms.members === 'write')) {
      throw new IntegrationValidationError(
        'Integration requires read access to organization members. See GitHub App permissions.',
      );
    }

    if (!(perms.metadata === 'read' || perms.metadata === 'write')) {
      //as of now, this property has no 'write' value, but just in case
      throw new IntegrationValidationError(
        'Integration requires read access to repository metadata. See GitHub App permissions.',
      );
    }

    //note that ingesting installed applications requires scope organization_administration:read
    if (
      !(
        perms.organization_administration === 'read' ||
        perms.organization_administration === 'write'
      )
    ) {
      this.scopes.orgAdmin = false;
      this.logger.info(
        {},
        'Token does not have organization_administration scope. Installed GitHub Apps cannot be ingested',
      );
    } else {
      this.scopes.orgAdmin = true;
    }

    //ingesting org secrets requires scope organization_secrets:read
    if (
      !(
        perms.organization_secrets === 'read' ||
        perms.organization_secrets === 'write'
      )
    ) {
      this.scopes.orgSecrets = false;
      this.logger.info(
        {},
        "Token does not have 'organization_secrets' scope. Org secrets cannot be ingested",
      );
    } else {
      this.scopes.orgSecrets = true;
    }

    //ingesting repo and env secrets requires scope secrets:read
    if (!(perms.secrets === 'read' || perms.secrets === 'write')) {
      this.scopes.repoSecrets = false;
      this.logger.info(
        {},
        "Token does not have 'secrets' scope. Repo and environmental secrets cannot be ingested",
      );
    } else {
      this.scopes.repoSecrets = true;
    }

    //ingesting environments or environmental secrets requires scope environments:read
    if (!(perms.environments === 'read' || perms.environments === 'write')) {
      this.scopes.repoEnvironments = false;
      this.logger.info(
        {},
        "Token does not have 'environments' scope. Environments and environmental secrets cannot be ingested",
      );
    } else {
      this.scopes.repoEnvironments = true;
    }

    //ingesting repo issues requires scope issues:read
    if (!(perms.issues === 'read' || perms.issues === 'write')) {
      this.scopes.repoIssues = false;
      this.logger.info(
        {},
        "Token does not have 'issues' scope. Repo Issues cannot be ingested. PRs from private repos also cannot be ingested.",
      );
    } else {
      this.scopes.repoIssues = true;
    }

    //ingesting dependabot alerts requires scope vulnerability_alerts:read
    if (['read', 'write'].includes(perms.vulnerability_alerts!)) {
      this.scopes.dependabotAlerts = true;
    } else {
      this.logger.info(
        "Token does not have 'vulnerability_alerts' (aka dependabot alerts) scope. Repo Vulnerability Alerts cannot be ingested.",
      );
      this.scopes.dependabotAlerts = false;
    }

    //ingesting codeScanning alerts requires scope security_events:read
    if (['read', 'write'].includes(perms.security_events!)) {
      this.scopes.codeScanningAlerts = true;
      this.scopes.secretScanningAlerts = true;
    } else {
      this.logger.info(
        "Token does not have 'security_events' (aka codeScanning alerts) scope. Repo Vulnerability Alerts cannot be ingested.",
      );
      this.scopes.codeScanningAlerts = false;
      this.scopes.secretScanningAlerts = false;
    }

    //ingesting secretScanning alerts requires secret_scanning_alerts:read permission
    if (['read', 'write'].includes(perms.secret_scanning_alerts!)) {
      this.scopes.secretScanningAlerts = true;
    } else {
      this.logger.info(
        "Token does not have 'secret_scanning_alerts' permission enabled. Secret Scanning Alerts cannot be ingested.",
      );
      this.scopes.secretScanningAlerts = false;
    }

    //ingesting github pages requires scope repo pages:read
    if (['read', 'write'].includes(perms.pages!)) {
      this.scopes.repoPages = true;
    } else {
      this.logger.info(
        'Token does not have Github Pages permissions enabled. Github Pages information per repo will not be gathered.',
      );
    }

    //ingesting branch protection rules requires scope repo administration:read
    if (['read', 'write'].includes(perms.administration!)) {
      this.scopes.repoAdmin = true;
    } else {
      this.logger.info(
        "Token does not have repo 'administration' scope. Repo Branch Protection Rules cannot be ingested.",
      );
      this.scopes.repoAdmin = false;
    }

    //ingesting branch protection rules on private repos requires scope repo discussions:read
    if (['read', 'write'].includes(perms.discussions!)) {
      this.scopes.repoDiscussions = true;
    } else {
      this.logger.info(
        "Token does not have repo 'discussions' scope. Repo Branch Protection Rules cannot be ingested for private repos.",
      );
      this.scopes.repoDiscussions = false;
    }

    const missingScopes = Object.keys(this.scopes).filter(
      (key) => !this.scopes[key],
    );

    if (missingScopes.length > 0) {
      const missingScopesMessage = `The following scope(s) were not granted: [${missingScopes.join(
        ', ',
      )}]. Ingestion will be limited! Please accept new permissions to ingest full dataset.`;

      this.logger.info(
        { allScopes: this.scopes, missingScopes },
        missingScopesMessage,
      );
      this.logger.publishWarnEvent({
        name: IntegrationWarnEventName.MissingPermission,
        description: missingScopesMessage,
      });
    }

    //scopes check done
  }
}

/**
 * API Client is a singleton. New instances
 * are not necessary. Prevents setupAccountClient()
 * from being called repeatedly.
 */
let apiClientInstance;
export function getOrCreateApiClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = new APIClient(config, logger);
  }

  return apiClientInstance;
}
