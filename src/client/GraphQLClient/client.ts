import {
  graphql as octokitGraphQl,
  GraphqlResponseError,
} from '@octokit/graphql';

import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import { retry } from '@lifeomic/attempt';

import { ResourceIteratee } from '../types';

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
  OrgQueryResponse,
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
import OrganizationQuery from './organizationQueries/OrganizationQuery';
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
import {
  AppScopes,
  IScopes,
  ScopesSet,
  TokenScopes,
  fetchScopes,
} from '../scopes';
import { fetchOrganizationLogin } from '../organizationLogin';
import { getAuthStrategy } from '../auth';
import { getMetaResponse } from '../meta';
import fetch from 'node-fetch';

export class GithubGraphqlClient implements IScopes {
  private readonly graphqlUrl: string;

  /**
   * Documentation can be found here: https://github.com/octokit/graphql.js
   */
  private graphqlWithAuth: graphql;

  /**
   * Rate limit status.
   */
  private rateLimitStatus: {
    limit: number;
    remaining: number;
    resetAt: string;
  };

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

  constructor(
    private readonly config: IntegrationConfig,
    private readonly logger: IntegrationLogger,
  ) {
    this.graphqlUrl = this.config.githubApiBaseUrl.includes('api.github.com')
      ? this.config.githubApiBaseUrl
      : `${this.config.githubApiBaseUrl}/api`;

    const authStrategy = getAuthStrategy(this.config);
    const requestHook = authStrategy.hook;
    this.graphqlWithAuth = octokitGraphQl.defaults({
      baseUrl: this.graphqlUrl,
      request: {
        fetch: fetch,
        hook: requestHook,
      },
    });
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

  async getGithubEnterpriseServerVersion(): Promise<string | null> {
    if (this.gheServerVersion === undefined) {
      const response = await getMetaResponse(this.config);
      const meta = response.data as { installed_version?: string };
      this.gheServerVersion = meta.installed_version ?? null;
    }
    return this.gheServerVersion;
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
  @TokenScopes(['read:org', 'admin:org'])
  public async fetchOrganization(): Promise<OrgQueryResponse | undefined> {
    const executor = createQueryExecutor(this, this.logger);

    const login = await this.getOrganizationLogin();
    const { organization, rateLimit } =
      await OrganizationQuery.fetchOrganization(login, executor);

    this.collectRateLimitStatus(rateLimit);

    return organization;
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

  async iteratePullRequests(
    repoName: string,
    isPublicRepo: boolean,
    ingestStartDatetime: string,
    maxResourceIngestion: number,
    maxSearchLimit: number,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<void>;
  async iteratePullRequests(
    repoIds: string[],
    ingestStartDatetime: string,
    iteratee: ResourceIteratee<PullRequestResponse>,
  ): Promise<void>;
  async iteratePullRequests(
    arg1: unknown,
    arg2: unknown,
    arg3: unknown,
    arg4?: unknown,
    arg5?: unknown,
    arg6?: unknown,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' && // repoName
      typeof arg2 === 'boolean' && // isPublicRepo
      typeof arg3 === 'string' && // ingestStartDatetime
      typeof arg4 === 'number' && // maxResourceIngestion
      typeof arg5 === 'number' && // maxSearchLimit
      typeof arg6 === 'function' // iteratee
    ) {
      const login = await this.getOrganizationLogin();
      const fullName = `${login}/${arg1}`;
      const iteratee = arg6 as ResourceIteratee<PullRequestResponse>;
      result = await PullRequestsQuery.iteratePullRequests(
        {
          fullName,
          public: arg2,
          ingestStartDatetime: arg3,
          maxResourceIngestion: arg4,
          maxSearchLimit: arg5,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) && // repoIds
      typeof arg2 === 'string' && // ingestStartDatetime
      typeof arg3 === 'function' // iteratee
    ) {
      const iteratee = arg3 as ResourceIteratee<PullRequestResponse>;
      result = await BatchedPullRequestsQuery.iteratePullRequests(
        {
          repoIds: arg1,
          ingestStartDatetime: arg2,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateReviews(
    repoName: string,
    isPublicRepo: boolean,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Review>,
  ): Promise<void>;
  async iterateReviews(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Review>,
  ): Promise<void>;
  async iterateReviews(
    arg1: unknown,
    arg2: unknown,
    arg3?: unknown,
    arg4?: unknown,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' &&
      typeof arg2 === 'boolean' &&
      typeof arg3 === 'number' &&
      typeof arg4 === 'function'
    ) {
      const iteratee = arg4 as ResourceIteratee<Review>;
      result = await ReviewsQuery.iterateReviews(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          isPublicRepo: arg2,
          pullRequestNumber: arg3,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (Array.isArray(arg1) && typeof arg2 === 'function') {
      const iteratee = arg2 as ResourceIteratee<Review>;
      result = await BatchedReviewsQuery.iterateReviews(
        {
          pullRequestIds: arg1,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }
    this.collectRateLimitStatus(result);
  }

  async iterateLabels(
    repoName: string,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Label>,
  ): Promise<void>;
  async iterateLabels(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Label>,
  ): Promise<void>;
  async iterateLabels(
    arg1: unknown,
    arg2: unknown,
    arg3?: unknown,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' &&
      typeof arg2 === 'number' &&
      typeof arg3 === 'function'
    ) {
      const iteratee = arg3 as ResourceIteratee<Label>;
      result = await LabelsQuery.iterateLabels(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          pullRequestNumber: arg2,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (Array.isArray(arg1) && typeof arg2 === 'function') {
      const iteratee = arg2 as ResourceIteratee<Label>;
      result = await BatchedLabelsQuery.iterateLabels(
        {
          pullRequestIds: arg1,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateCommits(
    repoName: string,
    pullRequestNumber: number,
    iteratee: ResourceIteratee<Commit>,
  ): Promise<void>;
  async iterateCommits(
    pullRequestIds: string[],
    iteratee: ResourceIteratee<Commit>,
  ): Promise<void>;
  async iterateCommits(
    arg1: unknown,
    arg2: unknown,
    arg3?: unknown,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' &&
      typeof arg2 === 'number' &&
      typeof arg3 === 'function'
    ) {
      const iteratee = arg3 as ResourceIteratee<Commit>;
      result = await CommitsQuery.iterateCommits(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          pullRequestNumber: arg2,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (Array.isArray(arg1) && typeof arg2 === 'function') {
      const iteratee = arg2 as ResourceIteratee<Commit>;
      result = await BatchedCommitsQuery.iterateCommits(
        {
          pullRequestIds: arg1,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateIssues(
    repoName: string,
    ingestStartDatetime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<void>;
  async iterateIssues(
    repoIds: string[],
    ingestStartDatetime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<void>;
  @AppScopes(['issues'])
  async iterateIssues(
    arg1: unknown,
    ingestStartDatetime: string,
    iteratee: ResourceIteratee<IssueResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await IssuesQuery.iterateIssues(
        {
          login: await this.getOrganizationLogin(),
          repoName: arg1,
          ingestStartDatetime,
          maxLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result = await BatchedIssuesQuery.iterateIssues(
        { repoIds: arg1, ingestStartDatetime },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateIssueLabels(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueLabel>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    const result = await BatchedIssueLabelsQuery.iterateIssueLabels(
      {
        issueIds,
      },
      executor,
      iteratee,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateIssueAssignees(
    issueIds: string[],
    iteratee: ResourceIteratee<IssueAssignee>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    const result = await BatchedIssueAssigneesQuery.iterateIssueAssignees(
      {
        issueIds,
      },
      executor,
      iteratee,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateRepositories(
    lastSuccessfulExecution: RepoConnectionFilters['lastSuccessfulExecution'],
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    const gheServerVersion =
      (await this.getGithubEnterpriseServerVersion()) ?? undefined;
    const result = await OrgRepositoriesQuery.iterateRepositories(
      {
        login: await this.getOrganizationLogin(),
        maxLimit: 50,
        lastSuccessfulExecution,
        alertStates: this.config.dependabotAlertStates ?? [],
        gheServerVersion,
      },
      executor,
      iteratee,
      this.logger,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateTags(
    repoName: string,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<void>;
  async iterateTags(
    repoIds: string[],
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<void>;
  async iterateTags(
    arg1: unknown,
    iteratee: ResourceIteratee<TagQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await TagsQuery.iterateTags(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result = await BatchedTagsQuery.iterateTags(
        { repoIds: arg1 },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateTopics(
    repoName: string,
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ): Promise<void>;
  async iterateTopics(
    repoIds: string[],
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ): Promise<void>;
  async iterateTopics(
    arg1: unknown,
    iteratee: ResourceIteratee<TopicQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await TopicsQuery.iterateTopics(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result = await BatchedTopicsQuery.iterateTopics(
        { repoIds: arg1 },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  public async iterateTeams(
    iteratee: ResourceIteratee<OrgTeamQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    const result = await TeamsQuery.iterateTeams(
      {
        login: await this.getOrganizationLogin(),
        maxLimit: MAX_REQUESTS_LIMIT,
      },
      executor,
      iteratee,
      this.logger,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateCollaborators(
    repoName: string,
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<void>;
  async iterateCollaborators(
    repoIds: string[],
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<void>;
  async iterateCollaborators(
    arg1: unknown,
    iteratee: ResourceIteratee<CollaboratorResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await RepoCollaboratorsQuery.iterateCollaborators(
        {
          login: await this.getOrganizationLogin(),
          repoName: arg1,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result = await BatchedRepoCollaboratorsQuery.iterateCollaborators(
        {
          repoIds: arg1,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateTeamRepositories(
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void>;
  async iterateTeamRepositories(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void>;
  async iterateTeamRepositories(
    arg1: unknown,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // teamSlug
    ) {
      result = await TeamRepositoriesQuery.iterateRepositories(
        {
          login: await this.getOrganizationLogin(),
          teamSlug: arg1,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // teamIds
    ) {
      result = await BatchedTeamRepositoriesQuery.iterateRepositories(
        {
          teamIds: arg1,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }
    this.collectRateLimitStatus(result);
  }

  async iterateMembers(
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    const result = await OrgMembersQuery.iterateMembers(
      {
        login: await this.getOrganizationLogin(),
        maxLimit: MAX_REQUESTS_LIMIT,
      },
      executor,
      iteratee,
      this.logger,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateExternalIdentifiers(
    iteratee: ResourceIteratee<OrgExternalIdentifierQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    const result = await ExternalIdentifiersQuery.iterateExternalIdentifiers(
      {
        login: await this.getOrganizationLogin(),
        enterpriseSlug:
          this.config.selectedAuthType === 'githubEnterpriseToken'
            ? this.config.enterpriseSlug
            : undefined,
        maxLimit: MAX_REQUESTS_LIMIT,
      },
      executor,
      iteratee,
      this.logger,
    );
    this.collectRateLimitStatus(result);
  }

  async iterateTeamMembers(
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<void>;
  async iterateTeamMembers(
    teamIds: string[],
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<void>;
  async iterateTeamMembers(
    arg1: unknown,
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // teamSlug
    ) {
      result = await TeamMembersQuery.iterateMembers(
        {
          login: await this.getOrganizationLogin(),
          teamSlug: arg1,
          maxLimit: MAX_REQUESTS_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // teamIds
    ) {
      result = await BatchedTeamMembersQuery.iterateMembers(
        { teamIds: arg1 },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }
    this.collectRateLimitStatus(result);
  }

  async iterateRepoVulnAlerts(
    repoName: string,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ): Promise<void>;
  async iterateRepoVulnAlerts(
    repoIds: string[],
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ): Promise<void>;
  async iterateRepoVulnAlerts(
    arg1: unknown,
    iteratee: ResourceIteratee<VulnerabilityAlertResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    const gheServerVersion =
      (await this.getGithubEnterpriseServerVersion()) ?? undefined;
    const filters = {
      states: this.config.dependabotAlertStates,
      severities: this.config.dependabotAlertSeverities,
    };

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await RepoVulnAlertsQuery.iterateVulnerabilityAlerts(
        {
          login: await this.getOrganizationLogin(),
          repoName: arg1,
          severityFilter: filters.severities ?? [],
          stateFilter: filters.states ?? [],
          gheServerVersion,
          maxRequestLimit: MAX_SEARCH_LIMIT,
        },
        executor,
        iteratee,
        this.logger,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result = await BatchedRepoVulnAlertsQuery.iterateVulnerabilityAlerts(
        {
          repoIds: arg1,
          severityFilter: filters.severities ?? [],
          stateFilter: filters.states ?? [],
          gheServerVersion,
        },
        executor,
        iteratee,
      );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  async iterateBranchProtectionRules(
    repoName: string,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<void>;
  async iterateBranchProtectionRules(
    repoIds: string[],
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<void>;
  @AppScopes(['organization_administration'])
  async iterateBranchProtectionRules(
    arg1: unknown,
    iteratee: ResourceIteratee<BranchProtectionRuleResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);
    const gheServerVersion =
      (await this.getGithubEnterpriseServerVersion()) ?? undefined;

    let result: RateLimitStepSummary | undefined;
    if (
      typeof arg1 === 'string' // repoName
    ) {
      result = await BranchProtectionRulesQuery.iterateBranchProtectionRules(
        {
          repoOwner: await this.getOrganizationLogin(),
          repoName: arg1,
          gheServerVersion,
        },
        executor,
        iteratee,
      );
    } else if (
      Array.isArray(arg1) // repoIds
    ) {
      result =
        await BatchedBranchProtectionRulesQuery.iterateBranchProtectionRules(
          {
            repoIds: arg1,
            gheServerVersion,
          },
          executor,
          iteratee,
        );
    } else {
      throw new Error('Invalid arguments');
    }

    this.collectRateLimitStatus(result);
  }

  @AppScopes(['organization_administration'])
  async iteratePolicyAllowances(
    branchProtectionRuleIds: string[],
    iteratee: ResourceIteratee<BranchProtectionRuleAllowancesResponse>,
  ): Promise<void> {
    const executor = createQueryExecutor(this, this.logger);

    const gheServerVersion =
      (await this.getGithubEnterpriseServerVersion()) ?? undefined;
    const result =
      await BatchedBranchProtectionRulesAllowancesQuery.iterateBranchProtectionRulesAllowances(
        {
          branchProtectionRuleIds,
          gheServerVersion,
        },
        executor,
        iteratee,
      );
    this.collectRateLimitStatus(result);
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
                  fetch: fetch,
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

let graphqlClientInstance: GithubGraphqlClient | undefined;
export function getOrCreateGraphqlClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): GithubGraphqlClient {
  if (!graphqlClientInstance) {
    graphqlClientInstance = new GithubGraphqlClient(config, logger);
  }

  return graphqlClientInstance;
}
