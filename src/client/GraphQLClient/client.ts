import {
  graphql as octokitGraphQl,
  GraphqlResponseError,
} from '@octokit/graphql';

import {
  IntegrationLogger,
  IntegrationProviderAuthenticationError,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';
import { retry } from '@lifeomic/attempt';
import { Octokit } from '@octokit/rest';

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

const FIVE_MINUTES_IN_MILLIS = 300_000;

export class GitHubGraphQLClient {
  private readonly graphqlUrl: string;

  /**
   * Documentation can be found here: https://github.com/octokit/graphql.js
   */
  private graph: graphql;

  private readonly logger: IntegrationLogger;
  private authClient: Octokit;
  private tokenExpires: number;
  private rateLimitStatus: {
    limit: number;
    remaining: number;
    resetAt: string;
  };

  constructor(
    graphqlUrl: string,
    token: string,
    tokenExpires: number,
    logger: IntegrationLogger,
    authClient: Octokit,
  ) {
    this.graphqlUrl = graphqlUrl;
    this.graph = octokitGraphQl.defaults({
      baseUrl: this.graphqlUrl,
      headers: {
        'User-Agent': 'jupiterone-graph-github',
        Authorization: `token ${token}`,
      },
    });
    this.tokenExpires = tokenExpires;
    this.logger = logger;
    this.authClient = authClient;
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
   * Refreshes the token and reinitialize the graphql client.
   * @private
   */
  private async refreshToken() {
    try {
      const { token, expiresAt } = (await this.authClient.auth({
        type: 'installation',
        refresh: true, //required or else client will return the previous token from cache
      })) as {
        token: string;
        expiresAt: string;
      };
      this.graph = octokitGraphQl.defaults({
        baseUrl: this.graphqlUrl,
        headers: {
          'User-Agent': 'jupiterone-graph-github',
          Authorization: `token ${token}`,
        },
      });
      this.tokenExpires = parseTimePropertyValue(expiresAt) || 0;
    } catch (err) {
      this.logger.error(err);
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: err.response?.url,
        status: err.status,
        statusText: err.response?.data?.message,
      });
    }
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
    if (this.tokenExpires - FIVE_MINUTES_IN_MILLIS < Date.now()) {
      await this.refreshToken();
    }

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
        },
        executor,
        iteratee,
        this.logger,
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
        },
        executor,
        iteratee,
        this.logger,
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
    repoFullName: string,
    lastExecutionTime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await IssuesQuery.iterateIssues(
        { repoFullName, lastExecutionTime },
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
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await OrgRepositoriesQuery.iterateRepositories(login, executor, iteratee),
    );
  }

  public async iterateTags(
    repoOwner: string,
    repoName: string,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await TagsQuery.iterateTags({ repoName, repoOwner }, executor, iteratee),
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
      await TeamsQuery.iterateTeams(login, executor, iteratee),
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
        },
        executor,
        iteratee,
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
      await OrgMembersQuery.iterateMembers(login, executor, iteratee),
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
        login,
        executor,
        iteratee,
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
        { login, teamSlug },
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
      ),
    );
  }

  public async iterateBatchedRepoVulnAlerts(
    repoIds: string[],
    filters: { severities: string[]; states: string[] },
    gheServerVersion: string | undefined,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
    maxRequestLimit: number,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BatchedRepoVulnAlertsQuery.iterateVulnerabilityAlerts(
        {
          repoIds,
          severityFilter: filters.severities ?? [],
          stateFilter: filters.states ?? [],
          gheServerVersion,
          maxRequestLimit,
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
        return await this.graph(queryString, queryVariables);
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
        calculateDelay: () => retryDelay,
        timeout: 180_000, // 3 min timeout. We need this in case Node hangs with ETIMEDOUT
        factor: 2, //exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
        handleError: async (error, attemptContext) => {
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
            () => this.refreshToken(),
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
