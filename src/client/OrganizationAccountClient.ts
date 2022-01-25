import { Octokit } from '@octokit/rest';
import {
  IntegrationError,
  IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';

import {
  GitHubGraphQLClient,
  OrgMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgRepoQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamRepoQueryResponse,
  GithubResource,
} from './GraphQLClient';
import {
  OrgAppQueryResponse,
  SecretQueryResponse,
  OrgSecretRepoQueryResponse,
  RepoEnvironmentQueryResponse,
} from './RESTClient/types';
import {
  RepoEntity,
  ReposCompareCommitsResponseItem,
  DiffFiles,
  ReposListCommitsResponseItem,
} from '../types';
import { request } from '@octokit/request';
import { ResourceIteratee } from '../client';
import {
  PullRequest,
  Issue,
  Collaborator,
  GithubQueryResponse as QueryResponse,
} from './GraphQLClient/types';
import {
  ACCOUNT_QUERY_STRING,
  REPOS_QUERY_STRING,
  SINGLE_TEAM_MEMBERS_QUERY_STRING,
  ISSUES_QUERY_STRING,
  PUBLIC_REPO_PULL_REQUESTS_QUERY_STRING,
  TEAMS_QUERY_STRING,
  USERS_QUERY_STRING,
  SINGLE_REPO_COLLABORATORS_QUERY_STRING,
  SINGLE_TEAM_REPOS_QUERY_STRING,
  PRIVATE_REPO_PULL_REQUESTS_QUERY_STRING,
} from './GraphQLClient/queries';
import { formatAndThrowGraphQlError } from '../util/formatAndThrowGraphQlError';

export default class OrganizationAccountClient {
  authorizedForPullRequests: boolean;

  v3RateLimitConsumed: number;
  v4RateLimitConsumed: number;

  readonly login: string;
  readonly v3: Octokit;
  readonly v4: GitHubGraphQLClient;
  readonly logger: IntegrationLogger;

  constructor(options: {
    /**
     * The login of the GitHub account, a required parameter of some endpoints.
     */
    login: string;
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
    this.v3 = options.restClient;
    this.v4 = options.graphqlClient;
    this.logger = options.logger;

    this.authorizedForPullRequests = true;
    this.v3RateLimitConsumed = 0;
    this.v4RateLimitConsumed = 0;
  }

  /**
   * Calls using the Octokit GraphQL client (API v4).
   *
   * GraphQL is the preferred way of accessing the GitHub API, because it calls a hierarchy of
   * resources and only the desired properties. It is therefore more efficient.
   * However, to find a resource in GraphQL, one must know where in the hierarchy that resource
   * lives. Documentation at https://docs.github.com/en/graphql does not list all resources
   * that are available through the REST API (v3).
   *
   */

  async getAccount(): Promise<OrgQueryResponse> {
    let response;
    await this.queryGraphQL('account and related resources', async () => {
      const { organization, rateLimitConsumed } = await this.v4.fetchFromSingle(
        ACCOUNT_QUERY_STRING,
        GithubResource.Organization,
        [],
        {
          login: this.login,
        },
      );
      response = organization;
      return rateLimitConsumed;
    });
    return response[0];
  }

  async getMembers(): Promise<OrgMemberQueryResponse[]> {
    let response: OrgMemberQueryResponse[] = [];

    await this.queryGraphQL('members', async () => {
      const { membersWithRole, rateLimitConsumed } =
        await this.v4.fetchFromSingle(
          USERS_QUERY_STRING,
          GithubResource.Organization,
          [GithubResource.OrganizationMembers],
          { login: this.login },
        );

      if (membersWithRole) {
        response = response.concat(membersWithRole);
      }

      return rateLimitConsumed;
    });

    return response;
  }

  async getTeams(): Promise<OrgTeamQueryResponse[]> {
    let response: OrgTeamQueryResponse[] = [];

    await this.queryGraphQL('teams', async () => {
      const { teams, rateLimitConsumed } = await this.v4.fetchFromSingle(
        TEAMS_QUERY_STRING,
        GithubResource.Organization,
        [GithubResource.Teams],
        { login: this.login },
      );

      if (teams) {
        response = response.concat(teams as OrgTeamQueryResponse[]);
      }

      return rateLimitConsumed;
    });

    return response;
  }

  async getTeamMembers(
    teamSlug: string,
    teamKey: string,
  ): Promise<OrgTeamMemberQueryResponse[]> {
    let response: OrgTeamMemberQueryResponse[] = [];
    await this.queryGraphQL('team members', async () => {
      const { members, teams, rateLimitConsumed } =
        await this.v4.fetchFromSingle(
          SINGLE_TEAM_MEMBERS_QUERY_STRING,
          GithubResource.Organization,
          [GithubResource.TeamMembers],
          {
            login: this.login,
            slug: teamSlug,
          },
        );

      if (members) {
        response = response.concat(members as OrgTeamMemberQueryResponse[]);
      }

      if (!teams?.every((t) => t.id === teamKey)) {
        this.logger.warn(
          { teamSlug, teamKey, teams },
          'Teams contained more than the one expected team',
        );
      }

      return rateLimitConsumed;
    });
    return response.filter((t) => t.teams === teamKey);
  }

  async getRepositories(slugs?: string[]): Promise<OrgRepoQueryResponse[]> {
    let response: OrgRepoQueryResponse[] = [];

    await this.queryGraphQL('repositories', async () => {
      const { repositories, rateLimitConsumed } = await this.v4.fetchFromSingle(
        REPOS_QUERY_STRING,
        GithubResource.Organization,
        [GithubResource.Repositories],
        { login: this.login },
      );

      if (repositories) {
        response = response.concat(repositories as OrgRepoQueryResponse[]);
      }

      return rateLimitConsumed;
    });

    if (slugs) {
      return response.filter((repo) => slugs.includes(repo.name));
    } else {
      return response;
    }
  }

  async getTeamRepositories(
    teamSlug: string,
    teamKey: string,
  ): Promise<OrgTeamRepoQueryResponse[]> {
    let response: OrgTeamRepoQueryResponse[] = [];
    await this.queryGraphQL('team repositories', async () => {
      const { teamRepositories, teams, rateLimitConsumed } =
        await this.v4.fetchFromSingle(
          SINGLE_TEAM_REPOS_QUERY_STRING,
          GithubResource.Organization,
          [GithubResource.TeamRepositories],
          {
            login: this.login,
            slug: teamSlug,
          },
        );

      if (teamRepositories) {
        response = response.concat(
          teamRepositories as OrgTeamRepoQueryResponse[],
        );
      }

      if (!teams) {
        this.logger.info(
          { teamSlug, teamKey, teams },
          'Found no repos for team',
        );
      } else {
        if (!teams?.every((t) => t.id === teamKey)) {
          this.logger.warn(
            { teamSlug, teamKey, teams },
            'Teams contained more than the one expected team',
          );
        }
      }
      return rateLimitConsumed;
    });
    return response.filter((t) => t.teams === teamKey);
  }

  async getRepoCollaborators(repoName: string): Promise<Collaborator[]> {
    let response: Collaborator[] = [];
    await this.queryGraphQL('collaborators', async () => {
      const { collaborators, rateLimitConsumed } =
        await this.v4.fetchFromSingle(
          SINGLE_REPO_COLLABORATORS_QUERY_STRING,
          GithubResource.Repository,
          [GithubResource.Collaborators],
          {
            repoName,
            repoOwner: this.login,
          },
        );

      if (collaborators) {
        response = response.concat(collaborators as Collaborator[]);
      }
      return rateLimitConsumed;
    });
    return response;
  }

  async iteratePullRequestEntities(
    repo: RepoEntity,
    lastExecutionTime: string, //expect Date.toISOString format
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<QueryResponse> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting pull requests.');
      return { rateLimitConsumed: 0 };
    }
    lastExecutionTime = this.sanitizeLastExecutionTime(lastExecutionTime);

    const prGraphQLQueryString = repo.public
      ? PUBLIC_REPO_PULL_REQUESTS_QUERY_STRING
      : PRIVATE_REPO_PULL_REQUESTS_QUERY_STRING;
    const issuesSearchQuery = `is:pr repo:${repo.fullName} updated:>=${lastExecutionTime}`;
    return await this.v4.iteratePullRequests(
      prGraphQLQueryString,
      issuesSearchQuery,
      [GithubResource.Commits, GithubResource.Reviews, GithubResource.Labels],
      iteratee,
    );
  }

  async iterateIssueEntities(
    repo: RepoEntity,
    lastExecutionTime: string, //expect Date.toISOString format
    iteratee: ResourceIteratee<Issue>,
  ): Promise<QueryResponse> {
    //issues and PRs are actually the same in the API
    //we just filter for is:issue instead of is:pr
    //and remove pr-specific children from the request
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { rateLimitConsumed: 0 };
    }
    lastExecutionTime = this.sanitizeLastExecutionTime(lastExecutionTime);
    const query = `is:issue repo:${repo.fullName} updated:>=${lastExecutionTime}`;
    return await this.v4.iterateIssues(
      ISSUES_QUERY_STRING,
      query,
      [GithubResource.Assignees, GithubResource.LabelsOnIssues],
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
          this.logger.info('Fetched page of org secrets');
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return orgSecrets || [];
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest organization secrets',
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
          this.logger.info('Fetched page of repos for a secret');
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

  async getRepoSecrets(repoName: string): Promise<SecretQueryResponse[]> {
    try {
      const repoSecrets = await this.v3.paginate(
        'GET /repos/{owner}/{repo}/actions/secrets', //https://docs.github.com/en/rest/reference/actions#list-repository-secrets
        {
          owner: this.login,
          repo: repoName,
          per_page: 100,
        },
        (response) => {
          this.logger.info('Fetched page of secrets for a repo');
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return repoSecrets || [];
    } catch (err) {
      this.logger.warn({}, 'Error while attempting to ingest repo secrets');
      if (err.status === 403) {
        //this is caused by repos with more restrictive privacy settings
        this.logger.info(
          { repoName },
          `Repo returned a 403 unauthorized when secrets requested.`,
        );
        return [];
      }
      throw new IntegrationError(err);
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
          this.logger.info('Fetched page of environments for a repo');
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
        //not be included in the API rely
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
          this.logger.info('Fetched page of secrets for a repo environment');
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
        endpoint: `https://api.github.com/repositories/${repoDatabaseId}/environments/${envName}/secrets`,
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
        {},
        'Error while attempting to ingest to installed GitHub apps',
      );
      throw new IntegrationError(err);
    }
  }

  /**
   * Helper functions
   */

  async getComparison(
    account: string,
    repository: string,
    base: string,
    head: string,
  ): Promise<ReposCompareCommitsResponseItem> {
    try {
      const comparison = (
        await this.v3.repos.compareCommits({
          owner: account,
          repo: repository,
          base,
          head,
        })
      ).data;

      this.v3RateLimitConsumed++;

      return comparison;
    } catch (err) {
      this.logger.error({ err }, 'repos.compareCommits failed');

      throw err;
    }
  }

  // This is sometimes used by CM bot, but not in the actual integraiton.
  async isEmptyMergeCommit(
    account: string,
    repository: string,
    commit: ReposListCommitsResponseItem,
  ): Promise<boolean> {
    if (commit.parents.length !== 2) {
      return false;
    }

    // Check to see if this is a simple merge where there were no parallel changes
    // in master since the branch being merged was created
    const diffToMergedChanges = await this.getComparison(
      account,
      repository,
      commit.parents[1].sha,
      commit.sha,
    );
    if (!diffToMergedChanges.files || diffToMergedChanges.files.length === 0) {
      return true;
    }

    // Try to detect empty merges in the case of concurrent changes in master and
    // the branch. If the changes between the branch and the latest master commit
    // are the same as between the merge commit and the latest in master, then the
    // merge commit did not try to sneak in any extra changes.
    const diffMergeToMaster = await this.getComparison(
      account,
      repository,
      commit.parents[0].sha,
      commit.sha,
    );
    const diffBranchToMaster = await this.getComparison(
      account,
      repository,
      commit.parents[0].sha,
      commit.parents[1].sha,
    );
    if (
      diffMergeToMaster.files &&
      diffBranchToMaster.files &&
      this.diffsEqual(diffMergeToMaster.files, diffBranchToMaster.files)
    ) {
      return true;
    }

    return false;
  }

  private diffsEqual(a: DiffFiles[], b: DiffFiles[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const aSorted = this.sortFiles(a);
    const bSorted = this.sortFiles(b);

    return aSorted.reduce((equal: boolean, file, index) => {
      return equal && file.patch === bSorted[index].patch;
    }, true);
  }

  private sortFiles(files: DiffFiles[]): DiffFiles[] {
    return files.sort((x, y) => (x.sha > y.sha ? 1 : -1));
  }

  private async queryGraphQL(
    name: string,
    performQuery: () => Promise<number>,
  ) {
    try {
      const rateLimitConsumed = await performQuery();
      this.v4RateLimitConsumed += rateLimitConsumed;
    } catch (err) {
      if (err.message?.startsWith('Retry timeout')) {
        try {
          //one more time in case error was a transient ETIMEDOUT Node error
          const rateLimitConsumed = await performQuery();
          this.v4RateLimitConsumed += rateLimitConsumed;
        } catch (err) {
          formatAndThrowGraphQlError(err, name);
        }
      } else {
        formatAndThrowGraphQlError(err, name);
      }
    }
  }

  private sanitizeLastExecutionTime(lastExecutionTime: string): string {
    // defensive programming just in case of bad code changes later
    // Github expects the query string for the updated parameter to be in format 'YYYY-MM-DD'.
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
