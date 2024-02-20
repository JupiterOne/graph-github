import {
  graphql as octokitGraphQl,
  GraphqlResponseError,
} from '@octokit/graphql';

import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { retry } from '@lifeomic/attempt';

import { ResourceIteratee } from '../../client';

import {
  BranchProtectionRuleResponse,
  CollaboratorResponse,
  Commit,
  IssueResponse,
  Label,
  OrgMemberQueryResponse,
  OrgExternalIdentifierQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgTeamRepoQueryResponse,
  PullRequestResponse,
  RateLimitStepSummary,
  Review,
  TagQueryResponse,
  SinglePullRequestResponse,
  VulnerabilityAlertResponse,
  RepoConnectionFilters,
  TopicQueryResponse,
  BranchProtectionRuleAllowancesResponse,
  IssueLabel,
  IssueAssignee,
} from './types';
import PullRequestsQuery from './pullRequestQueries/PullRequestsQuery';
import IssuesQuery from './issueQueries/IssuesQuery';
import { createQueryExecutor } from './CreateQueryExecutor';
import OrgRepositoriesQuery from './repositoryQueries/OrgRepositoriesQuery';
import TeamRepositoriesQuery from './repositoryQueries/TeamRepositoriesQuery';
import OrgMembersQuery from './memberQueries/OrgMembersQuery';
import ExternalIdentifiersQuery from './memberQueries/ExternalIdentifiersQuery';
import TeamMembersQuery from './memberQueries/TeamMembersQuery';
import TeamsQuery from './teamQueries/TeamsQuery';
import RepoCollaboratorsQuery from './collaboratorQueries/RepoCollaboratorsQuery';
import OrganizationQuery, {
  OrganizationResults,
} from './organizationQueries/OrganizationQuery';
import {
  handleForbiddenErrors,
  handleNotFoundErrors,
  retryErrorHandle,
} from './errorHandlers';
import { graphql } from '@octokit/graphql/dist-types/types';
import SinglePullRequestQuery from './pullRequestQueries/SinglePullRequestQuery';
import RepoVulnAlertsQuery from './vulnerabilityAlertQueries/RepoVulnAlertsQuery';
import BranchProtectionRulesQuery from './branchProtectionRulesQueries/BranchProtectionRulesQuery';
import TagsQuery from './tagQueries/TagsQuery';
import ReviewsQuery from './pullRequestQueries/ReviewsQuery';
import LabelsQuery from './pullRequestQueries/LabelsQuery';
import CommitsQuery from './pullRequestQueries/CommitsQuery';
import BatchedBranchProtectionRulesQuery from './branchProtectionRulesQueries/BatchedBranchProtectionRulesQuery';
import BatchedRepoCollaboratorsQuery from './collaboratorQueries/BatchedRepoCollaboratorsQuery';
import BatchedRepoVulnAlertsQuery from './vulnerabilityAlertQueries/BatchedRepoVulnAlertsQuery';
import BatchedTeamRepositoriesQuery from './repositoryQueries/BatchedTeamRepositoriesQuery';
import BatchedIssuesQuery from './issueQueries/BatchedIssuesQuery';
import BatchedCommitsQuery from './pullRequestQueries/BatchedCommitsQuery';
import BatchedLabelsQuery from './pullRequestQueries/BatchedLabelsQuery';
import BatchedReviewsQuery from './pullRequestQueries/BatchedReviewsQuery';
import BatchedTeamMembersQuery from './memberQueries/BatchedTeamMembersQuery';
import { MAX_REQUESTS_LIMIT, MAX_SEARCH_LIMIT } from './paginate';
import BatchedTagsQuery from './tagQueries/BatchedTagsQuery';
import TopicsQuery from './topicQueries/TopicsQuery';
import BatchedTopicsQuery from './topicQueries/BatchedTopicsQuery';
import BatchedPullRequestsQuery from './pullRequestQueries/BatchedPullRequestsQuery';
import BatchedBranchProtectionRulesAllowancesQuery from './branchProtectionRulesQueries/BatchedBranchProtectionRulesAllowancesQuery';
import BatchedIssueLabelsQuery from './issueQueries/BatchedIssueLabelsQuery';
import BatchedIssueAssigneesQuery from './issueQueries/BatchedIssueAssigneesQuery';
import { IntegrationConfig } from '../../config';
import { createTokenAuth } from '@octokit/auth-token';
import { createAppAuth } from '@octokit/auth-app';

function getAuthStrategy(config: IntegrationConfig) {
  let auth:
    | ReturnType<typeof createAppAuth>
    | ReturnType<typeof createTokenAuth>;
  if (config.selectedAuthType === 'githubEnterpriseToken') {
    auth = createTokenAuth(config.enterpriseToken);
  } else {
    auth = createAppAuth({
      appId: config.githubAppId,
      privateKey: config.githubAppPrivateKey,
      installationId: config.installationId,
    });
  }
  return auth;
}

export class GitHubGraphQLClient {
  private readonly graphqlUrl: string;

  /**
   * Documentation can be found here: https://github.com/octokit/graphql.js
   */
  private graphqlWithAuth: graphql;

  private rateLimitStatus: {
    limit: number;
    remaining: number;
    resetAt: string;
  };

  constructor(
    private readonly config: IntegrationConfig,
    private readonly logger: IntegrationLogger,
  ) {
    this.graphqlUrl = this.config.githubApiBaseUrl.includes('api.github.com')
      ? this.config.githubApiBaseUrl
      : `${this.config.githubApiBaseUrl}/api`;

    this.graphqlWithAuth = octokitGraphQl.defaults({
      baseUrl: this.graphqlUrl,
      request: {
        hook: getAuthStrategy(this.config).hook,
      },
    });
  }

  private collectRateLimitStatus(results: RateLimitStepSummary) {
    if (results?.limit && results?.remaining && results?.resetAt) {
      this.rateLimitStatus = {
        limit: results.limit,
        remaining: results.remaining,
        resetAt: results.resetAt,
      };
    }

    return results;
  }

  get rateLimit() {
    return this.rateLimitStatus;
  }

  /**
   * Performs GraphQl request.
   * Handles:
   *    - token management (refreshes 5 minutes before expiring)
   *    - rate limit management
   * @param queryString
   * @param queryVariables
   */
  public async query(
    queryString: string,
    queryVariables: Record<string, unknown>,
  ) {
    return await this.retryGraphQL(queryString, queryVariables);
  }

  /**
   * Fetches organization associated with the provided login.
   * @param login
   */
  public async fetchOrganization(login: string): Promise<OrganizationResults> {
    const executor = createQueryExecutor(this, this.logger);

    const results = await OrganizationQuery.fetchOrganization(login, executor);

    this.collectRateLimitStatus(results.rateLimit);

    return results;
  }

  /**
   * Fetches Pull Request based on the provided parameters.
   * @param repoOwner
   * @param repoName
   * @param pullRequestNumber
   */
  public async fetchPullRequest(
    repoOwner: string,
    repoName: string,
    pullRequestNumber: number,
  ): Promise<SinglePullRequestResponse | undefined> {
    const executor = createQueryExecutor(this, this.logger);

    let pullRequest: SinglePullRequestResponse | undefined;
    await SinglePullRequestQuery.iteratePullRequest(
      { pullRequestNumber, repoName, repoOwner },
      executor,
      (pr) => {
        pullRequest = pr as SinglePullRequestResponse;
      },
      this.logger,
    );

    return pullRequest;
  }

  /**
   * Iterates over pull requests for the given repository.
   * @param repository
   * @param ingestStartDatetime
   * @param maxResourceIngestion
   * @param iteratee
   */
  public async iteratePullRequests(
    repository: { fullName: string; public: boolean },
    ingestStartDatetime: string,
    maxResourceIngestion: number,
    maxSearchLimit: number,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await PullRequestsQuery.iteratePullRequests(
        {
          ...repository,
          ingestStartDatetime,
          maxResourceIngestion,
          maxSearchLimit,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  public async iterateBatchedPullRequests(
    repoIds: string[],
    ingestStartDatetime: string,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedPullRequestsQuery.iteratePullRequests(
        {
          repoIds,
          ingestStartDatetime,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over reviews for the given pull request.
   * @param repository
   * @param pullRequestNumber
   * @param iteratee
   */
  public async iterateReviews(
    repository: { name: string; owner: string; isPublic: boolean },
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Review>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await ReviewsQuery.iterateReviews(
        {
          repoName: repository.name,
          repoOwner: repository.owner,
          isPublicRepo: repository.isPublic,
          pullRequestNumber,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over reviews for the given pull request ids.
   * @param pullRequestIds
   * @param iteratee
   */
  public async iterateBatchedReviews(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Review>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedReviewsQuery.iterateReviews(
        {
          pullRequestIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over labels for the given pull request.
   * @param repository
   * @param pullRequestNumber
   * @param iteratee
   */
  public async iterateLabels(
    repository: { name: string; owner: string },
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Label>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await LabelsQuery.iterateLabels(
        {
          repoName: repository.name,
          repoOwner: repository.owner,
          pullRequestNumber,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over labels for the given pull request.
   * @param repository
   * @param pullRequestNumber
   * @param iteratee
   */
  public async iterateBatchedLabels(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Label>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedLabelsQuery.iterateLabels(
        {
          pullRequestIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over commits for the given pull request.
   * @param repository
   * @param pullRequestNumber
   * @param iteratee
   */
  public async iterateCommits(
    repository: { name: string; owner: string },
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Commit>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await CommitsQuery.iterateCommits(
        {
          repoName: repository.name,
          repoOwner: repository.owner,
          pullRequestNumber,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over commits for the given pull request ids.
   * @param repository
   * @param pullRequestNumber
   * @param iteratee
   */
  public async iterateBatchedCommits(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Commit>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedCommitsQuery.iterateCommits(
        {
          pullRequestIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over issues for the given repository.
   * @param repoFullName
   * @param lastExecutionTime
   * @param iteratee
   */
  public async iterateIssues(
    login: string,
    repoName: string,
    lastExecutionTime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await IssuesQuery.iterateIssues(
        { login, repoName, lastExecutionTime, maxLimit: MAX_SEARCH_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over issues for the given repositories.
   * @param repoFullName
   * @param lastExecutionTime
   * @param iteratee
   */
  public async iterateBatchedIssues(
    repoIds: string[],
    lastExecutionTime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedIssuesQuery.iterateIssues(
        { repoIds, lastExecutionTime },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over issue labels for the given issue ids.
   * @param {string[]} issueIds
   * @param {ResourceIteratee<IssueLabel>} iteratee
   */
  public async iterateBatchedIssueLabels(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueLabel>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedIssueLabelsQuery.iterateIssueLabels(
        {
          issueIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over issue assignees for the given issue ids.
   * @param {string[]} issueIds
   * @param {ResourceIteratee<IssueAssignee>} iteratee
   */
  public async iterateBatchedIssueAssignees(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueAssignee>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedIssueAssigneesQuery.iterateIssueAssignees(
        {
          issueIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over Organization repositories.
   * @param login
   * @param iteratee
   */
  public async iterateOrgRepositories(
    login: string,
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
    connectionFilters: RepoConnectionFilters,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await OrgRepositoriesQuery.iterateRepositories(
        { login, maxLimit: 50, ...connectionFilters },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  public async iterateTags(
    repoOwner: string,
    repoName: string,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TagsQuery.iterateTags(
        { repoName, repoOwner, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  public async iterateBatchedTags(
    repoIds: string[],
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedTagsQuery.iterateTags({ repoIds }, executor, iteratee),
    );
  }

  public async iterateTopics(
    repoOwner: string,
    repoName: string,
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TopicsQuery.iterateTopics(
        { repoName, repoOwner, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  public async iterateBatchedTopics(
    repoIds: string[],
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedTopicsQuery.iterateTopics({ repoIds }, executor, iteratee),
    );
  }

  /**
   * Iterate teams found within an organization.
   * @param login aka organization
   * @param iteratee
   */
  public async iterateTeams(
    login: string,
    iteratee: ResourceIteratee<OrgTeamQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TeamsQuery.iterateTeams(
        { login, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterate repository collaborators within an organization.
   * @param login aka organization
   * @param repoName
   * @param iteratee
   */
  public async iterateRepoCollaborators(
    login: string,
    repoName: string,
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await RepoCollaboratorsQuery.iterateCollaborators(
        {
          login,
          repoName,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterate repository collaborators within an organization.
   * @param login aka organization
   * @param repoName
   * @param iteratee
   */
  public async iterateBatchedRepoCollaborators(
    repoIds: string[],
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedRepoCollaboratorsQuery.iterateCollaborators(
        {
          repoIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over repositories for the given org & team.
   * @param login - aka organization
   * @param teamSlug
   * @param iteratee
   */
  public async iterateTeamRepositories(
    login: string,
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TeamRepositoriesQuery.iterateRepositories(
        {
          login,
          teamSlug,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over repositories for the given team ids.
   * @param teamIds
   * @param iteratee
   */
  public async iterateBatchedTeamRepositories(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedTeamRepositoriesQuery.iterateRepositories(
        {
          teamIds,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates over members of the given org.
   * @param login - aka organization
   * @param iteratee
   */
  public async iterateOrgMembers(
    login: string,
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await OrgMembersQuery.iterateMembers(
        { login, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over external identifiers of the given org.
   * @param login - aka organization
   * @param iteratee
   */
  public async iterateExternalIdentifiers(
    login: string,
    iteratee: ResourceIteratee<OrgExternalIdentifierQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);
    return this.collectRateLimitStatus(
      await ExternalIdentifiersQuery.iterateExternalIdentifiers(
        { login, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over members of the given org & team.
   * @param login
   * @param teamSlug
   * @param iteratee
   */
  public async iterateTeamMembers(
    login: string,
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TeamMembersQuery.iterateMembers(
        { login, teamSlug, maxLimit: MAX_REQUESTS_LIMIT },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  /**
   * Iterates over members of the given teamIds.
   * @param teamIds
   * @param iteratee
   */
  public async iterateBatchedTeamMembers(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedTeamMembersQuery.iterateMembers(
        { teamIds },
        executor,
        iteratee,
      ),
    );
  }

  public async iterateRepoVulnAlerts(
    login: string,
    repoName: string,
    filters: { severities: string[]; states: string[] },
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
    maxRequestLimit: number,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await RepoVulnAlertsQuery.iterateVulnerabilityAlerts(
        {
          login,
          repoName,
          severityFilter: filters.severities ?? [],
          stateFilter: filters.states ?? [],
          gheServerVersion,
          maxRequestLimit,
        },
        executor,
        iteratee,
        this.logger,
      ),
    );
  }

  public async iterateBatchedRepoVulnAlerts(
    repoIds: string[],
    filters: { severities: string[]; states: string[] },
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedRepoVulnAlertsQuery.iterateVulnerabilityAlerts(
        {
          repoIds,
          severityFilter: filters.severities ?? [],
          stateFilter: filters.states ?? [],
          gheServerVersion,
        },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates through all branch protections rules found on the provided repo.
   * @param login - aka company
   * @param repoName
   * @param iteratee
   */
  public async iterateRepoBranchProtectionRules(
    login: string,
    repoName: string,
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BranchProtectionRulesQuery.iterateBranchProtectionRules(
        { repoOwner: login, repoName, gheServerVersion },
        executor,
        iteratee,
      ),
    );
  }

  /**
   * Iterates through all branch protections rules found on the provided repo.
   * @param login - aka company
   * @param repoName
   * @param iteratee
   */
  public async iterateBatchedRepoBranchProtectionRules(
    repoIds: string[],
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedBranchProtectionRulesQuery.iterateBranchProtectionRules(
        { repoIds, gheServerVersion },
        executor,
        iteratee,
      ),
    );
  }

  public async iterateBatchedPolicyAllowances(
    branchProtectionRuleIds: string[],
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<BranchProtectionRuleAllowancesResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedBranchProtectionRulesAllowancesQuery.iterateBranchProtectionRulesAllowances(
        { branchProtectionRuleIds, gheServerVersion },
        executor,
        iteratee,
      ),
    );
  }

  private readonly TIMEOUT_RETRY_ATTEMPTS = 3;

  /**
   *
   * @param queryString
   * @param queryVariables
   * @param timeoutRetryAttempt
   * @private
   */
  private async retryGraphQL(
    queryString: string,
    queryVariables: Record<string, unknown>,
    timeoutRetryAttempt = 0,
  ) {
    const { logger } = this;
    let retryDelay = 0;

    const queryWithPreRetryErrorHandling = async () => {
      try {
        retryDelay = 30_000;
        logger.debug(
          { queryString, queryVariables, timeoutRetryAttempt },
          'Attempting GraphQL request',
        );
        return await this.graphqlWithAuth(queryString, queryVariables);
      } catch (error) {
        logger.debug(
          { queryString, queryVariables, timeoutRetryAttempt, error },
          'GraphQL request failed.',
        );

        if (error instanceof GraphqlResponseError) {
          // Handle pre-retry logic
          // If resource can't be found, or is not accessible,
          // continue with processing.
          if (
            handleNotFoundErrors(error.errors, logger) ||
            handleForbiddenErrors(error.errors, logger)
          ) {
            return {
              rateLimit: {},
              // Partial data can be included in errors.
              ...error.data,
            };
          }
        }

        throw error;
      }
    };

    try {
      // Check https://github.com/lifeomic/attempt for options on retry
      return await retry(queryWithPreRetryErrorHandling, {
        maxAttempts: 3,
        calculateDelay: (context, options) => {
          if (retryDelay === 0) {
            // no delay between attempts
            return 0;
          }
          if (options.factor) {
            retryDelay *= Math.pow(options.factor, context.attemptNum - 1);

            if (options.maxDelay !== 0) {
              retryDelay = Math.min(retryDelay, options.maxDelay);
            }
          }
          return retryDelay;
        },
        timeout: 180_000, // 3 min timeout. We need this in case Node hangs with ETIMEDOUT
        factor: 2, //exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
        handleError: async (error, attemptContext) => {
          if (error.message?.includes('This may be the result of a timeout')) {
            logger.warn(
              { attemptContext, error, queryString, queryVariables },
              'Hit a Github Timeout. Aborting.',
            );
            attemptContext.abort();
            return;
          }

          if (attemptContext.aborted) {
            logger.warn(
              { attemptContext, error, queryString, queryVariables },
              'Hit an unrecoverable error when attempting to query GraphQL. Aborting.',
            );
            return;
          }

          logger.debug('Error being handled in handleError.');
          const delayMs = await retryErrorHandle(
            error,
            logger,
            attemptContext,
            () => {
              // Resets auth cache and it will fetch a new token on next request
              this.graphqlWithAuth = octokitGraphQl.defaults({
                baseUrl: this.graphqlUrl,
                request: {
                  hook: getAuthStrategy(this.config).hook,
                },
              });
            },
          );
          if (delayMs) {
            retryDelay = delayMs;
          }

          logger.warn(
            { attemptContext, error, queryString, queryVariables },
            `Hit a possibly recoverable error when attempting to query GraphQL. Waiting before trying again.`,
          );
        },
        handleTimeout: (attemptContext) => {
          if (timeoutRetryAttempt < this.TIMEOUT_RETRY_ATTEMPTS) {
            logger.warn(
              {
                attemptContext,
                queryString,
                queryVariables,
                timeoutRetryAttempt,
              },
              'Hit a timeout, restarting request retry cycle.',
            );

            return this.retryGraphQL(
              queryString,
              queryVariables,
              ++timeoutRetryAttempt,
            );
          } else {
            logger.warn(
              {
                attemptContext,
                queryString,
                queryVariables,
                timeoutRetryAttempt,
              },
              'Hit a timeout for the final time. Unable to collect data for this query.',
            );
            return {
              rateLimit: {},
            };
          }
        },
      });
    } catch (error) {
      logger.error({ error }, 'An error occurred during the request logic.');
      throw error;
    }
  }
}
