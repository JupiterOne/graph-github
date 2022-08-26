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
  IssueResponse,
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgTeamRepoQueryResponse,
  PullRequestResponse,
  RateLimitStepSummary,
  VulnerabilityAlertResponse,
} from './types';
import PullRequestsQuery from './pullRequestQueries/PullRequestsQuery';
import IssuesQuery from './issueQueries/IssuesQuery';
import { createQueryExecutor } from './CreateQueryExecutor';
import OrgRepositoriesQuery from './repositoryQueries/OrgRepositoriesQuery';
import TeamRepositoriesQuery from './repositoryQueries/TeamRepositoriesQuery';
import OrgMembersQuery from './memberQueries/OrgMembersQuery';
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

const FIVE_MINUTES_IN_MILLIS = 300000;

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
  public async query(queryString: string, queryVariables) {
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
    repoOwner,
    repoName,
    pullRequestNumber,
  ): Promise<PullRequestResponse | null> {
    const executor = createQueryExecutor(this, this.logger);

    let pullRequest: PullRequestResponse | null = null;
    await SinglePullRequestQuery.iteratePullRequest(
      { pullRequestNumber, repoName, repoOwner },
      executor,
      (pr) => {
        pullRequest = pr;
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
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await PullRequestsQuery.iteratePullRequests(
        {
          ...repository,
          ingestStartDatetime,
          maxResourceIngestion,
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
    login,
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await OrgRepositoriesQuery.iterateRepositories(login, executor, iteratee),
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
    login,
    repoName,
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
    login,
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await OrgMembersQuery.iterateMembers(login, executor, iteratee),
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
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<RateLimitStepSummary> {
    const executor = createQueryExecutor(this, this.logger);

    return this.collectRateLimitStatus(
      await BranchProtectionRulesQuery.iterateBranchProtectionRules(
        { repoOwner: login, repoName },
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
    queryVariables,
    timeoutRetryAttempt = 0,
  ) {
    const { logger } = this;

    const queryWithPreRetryErrorHandling = async () => {
      try {
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
        delay: 30_000, // 30 seconds to start
        timeout: 180_000, // 3 min timeout. We need this in case Node hangs with ETIMEDOUT
        factor: 2, //exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
        handleError: async (error, attemptContext) => {
          logger.debug('Error being handled in handleError.');
          await retryErrorHandle(error, logger, attemptContext, () =>
            this.refreshToken(),
          );

          if (attemptContext.aborted) {
            logger.warn(
              { attemptContext, error, queryString, queryVariables },
              'Hit an unrecoverable error when attempting to query GraphQL. Aborting.',
            );
          } else {
            logger.warn(
              { attemptContext, error, queryString, queryVariables },
              `Hit a possibly recoverable error when attempting to query GraphQL. Waiting before trying again.`,
            );
          }
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
