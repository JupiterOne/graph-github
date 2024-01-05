import { Octokit } from '@octokit/rest';
import {
  IntegrationError,
  IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';

import {
  BranchProtectionRuleResponse,
  GitHubGraphQLClient,
  OrgMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamRepoQueryResponse,
  VulnerabilityAlertResponse,
} from './GraphQLClient';
import {
  OrgAppQueryResponse,
  SecretQueryResponse,
  OrgSecretRepoQueryResponse,
  RepoEnvironmentQueryResponse,
  CodeScanningAlertQueryResponse,
  SecretScanningAlertQueryResponse,
} from './RESTClient/types';
import { request } from '@octokit/request';
import { ResourceIteratee } from '../client';
import {
  PullRequestResponse,
  IssueResponse,
  CollaboratorResponse,
  RateLimitStepSummary,
  Review,
  TagQueryResponse,
  Label,
  Commit,
  OrgExternalIdentifierQueryResponse,
  RepoConnectionFilters,
  TopicQueryResponse,
  BranchProtectionRuleAllowancesResponse,
  IssueLabel,
  IssueAssignee,
} from './GraphQLClient/types';

export default class OrganizationAccountClient {
  authorizedForPullRequests: boolean;

  v3RateLimitConsumed: number;

  readonly login: string;
  readonly baseUrl: string;
  readonly v3: Octokit;
  readonly v4: GitHubGraphQLClient;
  readonly logger: IntegrationLogger;

  constructor(options: {
    /**
     * The login of the GitHub account, a required parameter of some endpoints.
     */
    login: string;
    /**
     * The base URL to make requests.
     */
    baseUrl: string;
    /**
     * A GitHub API v3 client configured with necessary authentication, binding it
     * to a specific GitHub account (organization or user), used for accessing
     * endpoints listed at https://developer.github.com/v3/apps/available-endpoints/.
     */
    restClient: Octokit;
    /**
     * A GitHub API v4 (GraphQL) client, used for making queries listed at
     * https://developer.github.com/v4/query/.
     */
    graphqlClient: GitHubGraphQLClient;
    /**
     * A logger supplied by the managed integration SDK, used for logging
     * information about non-fatal errors.
     */
    logger: IntegrationLogger;
  }) {
    this.login = options.login;
    this.baseUrl = options.baseUrl;
    this.v3 = options.restClient;
    this.v4 = options.graphqlClient;
    this.logger = options.logger;

    this.authorizedForPullRequests = true;
    this.v3RateLimitConsumed = 0;

    this.logger.info(
      { login: options.login, baseUrl: options.baseUrl },
      'Constructing Organization Account client',
    );
  }

  /**
   * Calls using the Octokit GraphQL client (API v4).
   *
   * GraphQL is the preferred way of accessing the GitHub API, because it calls a hierarchy of
   * resources and only the desired properties. It is therefore more efficient.
   * However, to find a resource in GraphQL, one must know where in the hierarchy that resource
   * lives. Documentation at https://docs.github.com/en/graphql does not list all resources
   * that are available through the REST API (v3).
   */

  /**
   * Fetches the organization associated with `login`
   * plus rate limit details.
   */
  async fetchOrganization() {
    return await this.v4.fetchOrganization(this.login);
  }

  /**
   * Fetches meta about the API server. https://docs.github.com/en/enterprise-server@3.5/rest/meta
   * Used to determine compatibility for GHE Server versions.
   */
  async fetchMeta() {
    return (await this.v3.meta.get().then((result) => result.data)) as {
      installed_version: string;
    };
  }

  /**
   * Fetches the pull request for the given parameters.
   * @param repoOwner
   * @param repoName
   * @param pullRequestNumber
   */
  async fetchPullRequest(
    repoOwner: string,
    repoName: string,
    pullRequestNumber: number,
  ) {
    return await this.v4.fetchPullRequest(
      repoOwner,
      repoName,
      pullRequestNumber,
    );
  }

  /**
   * Iterate Organization owned Repos.
   * @param iteratee
   */
  async iterateOrgRepositories(
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
    connectionFilters: RepoConnectionFilters,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateOrgRepositories(
      this.login,
      iteratee,
      connectionFilters,
    );
  }

  async iterateTags(
    repoName: string,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ) {
    return await this.v4.iterateTags(this.login, repoName, iteratee);
  }

  async iterateBatchedTags(
    repoIds: string[],
    iteratee: ResourceIteratee<TagQueryResponse>,
  ) {
    return await this.v4.iterateBatchedTags(repoIds, iteratee);
  }

  async iterateTopics(
    repoName: string,
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ) {
    return await this.v4.iterateTopics(this.login, repoName, iteratee);
  }

  async iterateBatchedTopics(
    repoIds: string[],
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ) {
    return await this.v4.iterateBatchedTopics(repoIds, iteratee);
  }

  /**
   * Iterate over team repositories.
   * @param teamSlug
   * @param iteratee
   */
  async iterateTeamRepositories(
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateTeamRepositories(
      this.login,
      teamSlug,
      iteratee,
    );
  }

  /**
   * Iterate over team repositories.
   * @param teamSlug
   * @param iteratee
   */
  async iterateBatchedTeamRepositories(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedTeamRepositories(teamIds, iteratee);
  }

  /**
   * Iterate over Org Members.
   * @param iteratee
   */
  async iterateOrgMembers(
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateOrgMembers(this.login, iteratee);
  }

  async iterateExternalIdentifiers(
    iteratee: ResourceIteratee<OrgExternalIdentifierQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateExternalIdentifiers(this.login, iteratee);
  }

  async iterateTeams(
    iteratee: ResourceIteratee<OrgTeamQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateTeams(this.login, iteratee);
  }

  async iterateTeamMembers(
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateTeamMembers(this.login, teamSlug, iteratee);
  }

  async iterateBatchedTeamMembers(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedTeamMembers(teamIds, iteratee);
  }

  async iterateRepoCollaborators(
    repoName: string,
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateRepoCollaborators(
      this.login,
      repoName,
      iteratee,
    );
  }

  async iterateBatchedRepoCollaborators(
    repoIds: string[],
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedRepoCollaborators(repoIds, iteratee);
  }

  /**
   * Calls the GraphQL client to iterate over pull request entities.
   * @param repo
   * @param ingestStartDatetime
   * @param maxResourceIngestion
   * @param iteratee
   */
  async iteratePullRequestEntities(
    repoName: string,
    isPublicRepo: boolean,
    ingestStartDatetime: string, //expect Date.toISOString format
    maxResourceIngestion: number,
    maxSearchLimit: number,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting pull requests.');
      return { totalCost: 0 };
    }
    ingestStartDatetime = this.sanitizeLastExecutionTime(ingestStartDatetime);
    return await this.v4.iteratePullRequests(
      {
        fullName: `${this.login}/${repoName}`,
        public: isPublicRepo,
      },
      ingestStartDatetime,
      maxResourceIngestion,
      maxSearchLimit,
      iteratee,
    );
  }

  async iterateBatchedPullRequestEntities(
    repoIds: string[],
    ingestStartDatetime: string, //expect Date.toISOString format
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting pull requests.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedPullRequests(
      repoIds,
      ingestStartDatetime,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over review entities.
   * @param repo
   * @param pullRequestNumber
   * @param iteratee
   */
  async iterateReviews(
    repoName: string,
    isPublicRepo: boolean,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Review>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Reviews.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateReviews(
      {
        name: repoName,
        owner: this.login,
        isPublic: isPublicRepo,
      },
      pullRequestNumber,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over review entities.
   * @param pullRequestIds
   * @param isPublicRepo
   * @param iteratee
   */
  async iterateBatchedReviews(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Review>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Reviews.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedReviews(pullRequestIds, iteratee);
  }

  /**
   * Calls the GraphQL client to iterate over label entities.
   * @param repo
   * @param pullRequestNumber
   * @param iteratee
   */
  async iterateLabelEntities(
    repoName: string,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Label>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Labels.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateLabels(
      {
        name: repoName,
        owner: this.login,
      },
      pullRequestNumber,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over label entities.
   * @param pullRequestIds
   * @param iteratee
   */
  async iterateBatchedLabelEntities(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Label>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Labels.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedLabels(pullRequestIds, iteratee);
  }

  /**
   * Calls the GraphQL client to iterate over commit entities.
   * @param repo
   * @param pullRequestNumber
   * @param iteratee
   */
  async iterateCommits(
    repoName: string,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Commit>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Commit.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateCommits(
      {
        name: repoName,
        owner: this.login,
      },
      pullRequestNumber,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over commit entities.
   * @param repo
   * @param pullRequestNumber
   * @param iteratee
   */
  async iterateBatchedCommits(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Commit>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting Commit.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedCommits(pullRequestIds, iteratee);
  }

  /**
   * Calls the GraphQL client to iterate over issue entities.
   * Notes: issues and PRs are actually the same in the API
   * @param repoName
   * @param lastExecutionTime
   * @param iteratee
   */
  async iterateIssueEntities(
    repoName: string,
    lastExecutionTime: string, //expect Date.toISOString format
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<RateLimitStepSummary> {
    //issues and PRs are actually the same in the API
    //we just filter for is:issue instead of is:pr
    //and remove pr-specific children from the request
    // TODO: SP -> investigate removing pr-specific children
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { totalCost: 0 };
    }
    lastExecutionTime = this.sanitizeLastExecutionTime(lastExecutionTime);

    return await this.v4.iterateIssues(
      this.login,
      repoName,
      lastExecutionTime,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over issue entities.
   * Notes: issues and PRs are actually the same in the API
   * @param repoIds
   * @param lastExecutionTime
   * @param iteratee
   */
  async iterateBatchedIssueEntities(
    repoIds: string[],
    lastExecutionTime: string, //expect Date.toISOString format
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<RateLimitStepSummary> {
    //issues and PRs are actually the same in the API
    //we just filter for is:issue instead of is:pr
    //and remove pr-specific children from the request
    // TODO: SP -> investigate removing pr-specific children
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { totalCost: 0 };
    }
    lastExecutionTime = this.sanitizeLastExecutionTime(lastExecutionTime);

    return await this.v4.iterateBatchedIssues(
      repoIds,
      lastExecutionTime,
      iteratee,
    );
  }

  /**
   * Calls the GraphQL client to iterate over issue label entities.
   * @param {string[]} issueIds
   * @param {ResourceIteratee<IssueLabel>} iteratee
   */
  async iterateBatchedIssueLabels(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueLabel>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedIssueLabels(issueIds, iteratee);
  }

  /**
   * Calls the GraphQL client to iterate over issue assignee entities.
   * @param {string[]} issueIds
   * @param {ResourceIteratee<IssueAssignee>} iteratee
   */
  async iterateBatchedIssueAssignees(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueAssignee>,
  ): Promise<RateLimitStepSummary> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { totalCost: 0 };
    }
    return await this.v4.iterateBatchedIssueAssignees(issueIds, iteratee);
  }

  async iterateRepoVulnAlerts(
    repoName: string,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
    filters: { severities: string[]; states: string[] },
    maxRequestLimit: number,
    gheServerVersion?: string,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateRepoVulnAlerts(
      this.login,
      repoName,
      filters,
      gheServerVersion,
      iteratee,
      maxRequestLimit,
    );
  }

  async iterateBatchedRepoVulnAlerts(
    repoIds: string[],
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
    filters: { severities: string[]; states: string[] },
    gheServerVersion?: string,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedRepoVulnAlerts(
      repoIds,
      filters,
      gheServerVersion,
      iteratee,
    );
  }

  async iterateRepoBranchProtectionRules(
    repoName: string,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
    gheServerVersion?: string,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateRepoBranchProtectionRules(
      this.login,
      repoName,
      gheServerVersion,
      iteratee,
    );
  }

  async iterateBatchedRepoBranchProtectionRules(
    repoIds: string[],
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
    gheServerVersion?: string,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedRepoBranchProtectionRules(
      repoIds,
      gheServerVersion,
      iteratee,
    );
  }

  async iterateBatchedPolicyAllowances(
    branchProtectionRuleIds: string[],
    iteratee: ResourceIteratee<BranchProtectionRuleAllowancesResponse>,
    gheServerVersion?: string,
  ): Promise<RateLimitStepSummary> {
    return await this.v4.iterateBatchedPolicyAllowances(
      branchProtectionRuleIds,
      gheServerVersion,
      iteratee,
    );
  }

  /**
   * Calls using the Octokit REST client (v3 API).
   *
   * In general, we'd like to phase these out when possible and use GraphQL instead.
   * We are currently using REST calls where the resource is not available through
   * GraphQL, or possibly it is available but we don't know where to access it in the
   * object hierarchy.
   *
   */

  async getOrganizationSecrets(): Promise<SecretQueryResponse[]> {
    try {
      const orgSecrets = await this.v3.paginate(
        'GET /orgs/{org}/actions/secrets', //https://docs.github.com/en/rest/reference/actions#list-organization-secrets
        {
          org: this.login,
          per_page: 100,
        },
        (response) => {
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return orgSecrets || [];
    } catch (err) {
      this.logger.warn('Error while attempting to ingest organization secrets');
      throw new IntegrationError(err);
    }
  }

  async getCodeScanningAlerts(
    iteratee: ResourceIteratee<CodeScanningAlertQueryResponse>,
  ): Promise<void> {
    try {
      for await (const response of this.v3.paginate.iterator(
        this.v3.rest.codeScanning.listAlertsForOrg,
        {
          org: this.login,
          per_page: 100,
        },
      )) {
        this.v3RateLimitConsumed++;

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

  async getSecretScanningAlerts(
    iteratee: ResourceIteratee<SecretScanningAlertQueryResponse>,
  ): Promise<void> {
    try {
      const route = 'GET /orgs/{org}/secret-scanning/alerts';
      for await (const response of this.v3.paginate.iterator(route, {
        org: this.login,
        per_page: 100,
      })) {
        this.v3RateLimitConsumed++;

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

  async getReposForOrgSecret(
    secretName,
  ): Promise<OrgSecretRepoQueryResponse[]> {
    try {
      const reposForSecret = await this.v3.paginate(
        'GET /orgs/{org}/actions/secrets/{secret_name}/repositories', //https://docs.github.com/en/rest/reference/actions#list-selected-repositories-for-an-organization-secret
        {
          org: this.login,
          secret_name: secretName,
          per_page: 100,
        },
        (response) => {
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return reposForSecret || [];
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest repos for an organization secret',
      );
      throw new IntegrationError(err);
    }
  }

  async getRepoSecrets(
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    try {
      const route = 'GET /repos/{owner}/{repo}/actions/secrets'; //https://docs.github.com/en/rest/reference/actions#list-repository-secrets
      for await (const response of this.v3.paginate.iterator(route, {
        owner: this.login,
        repo: repoName,
        per_page: 100,
      })) {
        this.v3RateLimitConsumed++;
        for (const repoSecret of response.data) await iteratee(repoSecret);
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

  //Environments are available on GraphQL now, but with many less properties
  async getEnvironments(
    repoName: string,
  ): Promise<RepoEnvironmentQueryResponse[]> {
    try {
      const repoEnvironments = await this.v3.paginate(
        'GET /repos/{owner}/{repo}/environments' as any, //https://docs.github.com/en/rest/reference/repos#get-all-environments
        {
          owner: this.login,
          repo: repoName,
          per_page: 100,
        },
        (response) => {
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return repoEnvironments || [];
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        //private repos can only use environments in Enterprise level GitHub accounts
        //you get 404 if you try to call the REST API for environments on a private repo otherwise
        //but we don't know whether the account is Enterprise level, so we have to try private repos
        //once we move getEnvironments to GraphQL, this won't be an issue - private repos will simply
        //not be included in the API reply
        //403 can happen if the GitHub App is not permitted to access all repos
        return [];
      } else {
        this.logger.warn(
          { repoName },
          `Error while attempting to ingest environments for repo ${repoName}`,
        );
        throw new IntegrationError(err);
      }
    }
  }

  async getEnvSecrets(
    repoDatabaseId: string,
    envName: string,
    repoName: string,
  ): Promise<SecretQueryResponse[]> {
    try {
      const repoEnvSecrets = await this.v3.paginate(
        'GET /repositories/{repository_id}/environments/{environment_name}/secrets' as any, //https://docs.github.com/en/rest/reference/actions#list-environment-secrets
        {
          repository_id: repoDatabaseId,
          environment_name: envName,
          per_page: 100,
        },
        (response) => {
          this.v3RateLimitConsumed++;
          return response?.data;
        },
      );
      return repoEnvSecrets || [];
    } catch (err) {
      if (err.status === 403) {
        //this is caused by repos with more restrictive privacy settings
        this.logger.info(
          { repoName },
          `Repo returned a 403 unauthorized when environmental secrets requested.`,
        );
        return [];
      }
      throw new IntegrationProviderAPIError({
        message: repoName + ': ' + err.message,
        status: err.status,
        statusText: err.statusText,
        cause: err,
        endpoint: `${this.baseUrl}/repositories/${repoDatabaseId}/environments/${envName}/secrets`,
      });
    }
  }

  /**
   * One-off API calls using neither the Octokit GraphQL or REST clients for some reason.
   */

  async getInstalledApps(ghsToken): Promise<OrgAppQueryResponse[]> {
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
    try {
      const reply = await request(`GET /orgs/${this.login}/installations`, {
        baseUrl: this.baseUrl,
        headers: {
          authorization: `Bearer ${ghsToken}`,
        },
        type: 'private',
      });
      if (reply.data.installations) {
        return reply.data.installations;
      }
      this.logger.warn({}, 'Found no installed GitHub apps');
      return [];
    } catch (err) {
      this.logger.warn(
        { err },
        'Error while attempting to ingest to installed GitHub apps',
      );
      throw new IntegrationError(err);
    }
  }

  /**
   * Helper functions
   */

  private sanitizeLastExecutionTime(lastExecutionTime: string): string {
    // defensive programming just in case of bad code changes later
    // GitHub expects the query string for the updated parameter to be in format 'YYYY-MM-DD'.
    // It will also take a full Date.toIsoString output with time.
    // Examples: 2011-10-05 or 2011-10-05T14:48:00.000Z
    // It will NOT behave properly with a msec-since-epoch integer.
    // If a malformed string is passed to Github, it does NOT throw an error
    // It simply returns no data, as if no data meets the criteria
    // So if we have a bad string, we'll just set lastExecutionTime far back so we get the
    // behavior of a first-time execution
    let sanitizedExecutionTime = lastExecutionTime;
    if (
      new Date(lastExecutionTime).toString() === 'Invalid Date' ||
      !lastExecutionTime.includes('-')
    ) {
      this.logger.warn(
        { lastExecutionTime },
        `Bad string format passed to lastExecutionTime, setting to 2000-01-01 for safety`,
      );
      sanitizedExecutionTime = '2000-01-01';
    }
    return sanitizedExecutionTime;
  }
}
