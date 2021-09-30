import { Octokit } from '@octokit/rest';
import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

import {
  GitHubGraphQLClient,
  OrgMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgRepoQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamRepoQueryResponse,
  TeamRepositoryPermission,
  GithubResource,
} from './GraphQLClient';
import {
  RepoCollaboratorQueryResponse,
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
import sha from '../util/sha';
import { request } from '@octokit/request';
import { ResourceIteratee } from '../client';
import {
  PullRequest,
  Issue,
  GithubQueryResponse as QueryResponse,
} from './GraphQLClient/types';

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
        GithubResource.Organization,
        [],
        {
          login: this.login,
        },
      );
      response = organization![0] as OrgQueryResponse;
      return rateLimitConsumed;
    });
    return response;
  }

  async getMembers(): Promise<OrgMemberQueryResponse[]> {
    let response;
    await this.queryGraphQL('members', async () => {
      const {
        membersWithRole,
        rateLimitConsumed,
      } = await this.v4.fetchFromSingle(
        GithubResource.Organization,
        [GithubResource.OrganizationMembers],
        { login: this.login },
      );
      response = membersWithRole;
      return rateLimitConsumed;
    });
    return response || [];
  }

  async getTeams(): Promise<OrgTeamQueryResponse[]> {
    let response;
    await this.queryGraphQL('teams', async () => {
      const {
        teams,
        rateLimitConsumed,
      } = await this.v4.fetchFromSingle(
        GithubResource.Organization,
        [GithubResource.Teams],
        { login: this.login },
      );
      response = teams as OrgTeamQueryResponse[];
      return rateLimitConsumed;
    });
    return response || [];
  }

  async getTeamMembers(): Promise<OrgTeamMemberQueryResponse[]> {
    let response;
    await this.queryGraphQL('team members', async () => {
      const {
        members,
        rateLimitConsumed,
      } = await this.v4.fetchFromSingle(
        GithubResource.Organization,
        [GithubResource.TeamMembers],
        { login: this.login },
      );
      response = members as OrgTeamMemberQueryResponse[];
      return rateLimitConsumed;
    });
    return response || [];
  }

  async getRepositories(slugs?: string[]): Promise<OrgRepoQueryResponse[]> {
    let response;
    await this.queryGraphQL('repositories', async () => {
      const {
        repositories,
        rateLimitConsumed,
      } = await this.v4.fetchFromSingle(
        GithubResource.Organization,
        [GithubResource.Repositories],
        { login: this.login },
      );
      response = repositories as OrgRepoQueryResponse[];
      return rateLimitConsumed;
    });

    if (slugs) {
      // TODO: allow selection of specific resources in the GQL. should be p ez
      return (response || []).filter((repo) => slugs.includes(repo.name));
    } else {
      return response || [];
    }
  }

  async getTeamRepositories(
    teams: OrgTeamQueryResponse[],
  ): Promise<OrgTeamRepoQueryResponse[]> {
    // For certain unusually long account ids, GraphQL has been known to throw errors on this call
    // This is a known bug from the Github side, but the exact triggering details are currently unknown
    // Therefore, the GraphQL call is wrapped here in a try-catch, with a fallback to the REST call
    // Note, however, that there are subtle differences in the response
    // For example, if a team has a child team, and both have access to a CodeRepo, the GraphQL will
    // return two team-repo entries - one showing the parent team allows the repo, and another showing
    // that the child team also does. The REST client will only return the parent team entry.
    let response;
    try {
      await this.queryGraphQL('team repositories', async () => {
        const {
          teamRepositories,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          [GithubResource.TeamRepositories],
          { login: this.login },
        );
        response = teamRepositories as OrgTeamRepoQueryResponse[];
        return rateLimitConsumed;
      });
    } catch (err) {
      if (
        err.message.includes('Organization query for team repositories failed')
      ) {
        return await this.getTeamReposWithRest(teams);
      }
    } //end of catch and REST call
    return response || [];
  }

  async iteratePullRequestEntities(
    repo: RepoEntity,
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<QueryResponse> {
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting pull requests.');
      return { rateLimitConsumed: 0 };
    }
    const query = `is:pr repo:${repo.fullName}`;
    return await this.v4.iteratePullRequests(
      query,
      [GithubResource.Commits, GithubResource.Reviews, GithubResource.Labels],
      iteratee,
    );
  }

  async iterateIssueEntities(
    repo: RepoEntity,
    iteratee: ResourceIteratee<Issue>,
  ): Promise<QueryResponse> {
    //issues and PRs are actually the same in the API
    //we just filter for is:issue instead of is:pr
    //and remove pr-specific children from the request
    if (!this.authorizedForPullRequests) {
      this.logger.info('Account not authorized for ingesting issues.');
      return { rateLimitConsumed: 0 };
    }
    const query = `is:issue repo:${repo.fullName}`;
    return await this.v4.iterateIssues(query, [], iteratee);
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

  async getRepoCollaboratorsWithRest(
    repoName: string,
  ): Promise<RepoCollaboratorQueryResponse[]> {
    try {
      const repoCollaborators = await this.v3.paginate(
        'GET /repos/{owner}/{repo}/collaborators', // https://docs.github.com/en/rest/reference/repos#list-repository-collaborators
        {
          owner: this.login,
          repo: repoName,
          per_page: 100,
        },
        (response) => {
          this.logger.info('Fetched page of repo collaborators');
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return repoCollaborators || [];
    } catch (err) {
      //this method is called for every repo in the integration, but some might have special permissions restrictions
      //if we fail for one repo, we don't want to fail the whole collaborators step
      this.logger.warn(
        {
          err: err,
          repo: repoName,
          endpoint: `/repos/${this.login}/${repoName}/collaborators`,
        },
        `Failed to retrieve collaborators for repo ${repoName}, proceeding to other repos`,
      );
      return [];
    }
  }

  // This is a hack to allow large github accounts to bypass a Github error. Please delete this code once that error is fixed.
  // Do not attempt to call REST version of getTeamRepositories without first calling getTeams
  async getTeamReposWithRest(
    teams: OrgTeamQueryResponse[],
  ): Promise<OrgTeamRepoQueryResponse[]> {
    let totalTeamRepos: OrgTeamRepoQueryResponse[] = [];
    for (const team of teams) {
      try {
        const teamRepositories = await this.v3.paginate(
          'GET /orgs/{org}/teams/{team_slug}/repos', // https://docs.github.com/en/rest/reference/teams#list-team-repositories
          {
            org: this.login,
            team_slug: team.slug,
            per_page: 100,
          },
          (response) => {
            this.logger.info(
              {
                teamRepositoriesPageLength: response.data.length,
                team: sha(team.slug),
              },
              'Fetched page of team repositories',
            );
            this.v3RateLimitConsumed++;
            return response.data;
          },
        );
        const processedTeamRepos = teamRepositories.map((tr) => {
          let permission: TeamRepositoryPermission;
          if (tr.permissions?.admin) {
            permission = TeamRepositoryPermission.Admin;
          } else if (tr.permissions?.push) {
            permission = TeamRepositoryPermission.Write;
          } else {
            permission = TeamRepositoryPermission.Read;
          }

          return {
            //more properties are possible, but we're only going to use id to make relationships
            id: tr.node_id,
            teams: team.id,
            url: tr.url,
            name: tr.name,
            nameWithOwner: tr.full_name,
            permission,
            isPrivate: tr.private,
            isArchived: tr.archived,
            createdAt: tr.created_at as string,
            updatedAt: tr.updated_at as string,
          };
        });
        totalTeamRepos = totalTeamRepos.concat(processedTeamRepos);
      } catch (err) {
        throw new IntegrationError(err);
      }
    }
    return totalTeamRepos || [];
  }

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
      throw new IntegrationError(err);
    }
  }

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
      this.logger.warn(
        {},
        'Error while attempting to ingest repo environments',
      );
      throw new IntegrationError(err);
    }
  }

  async getEnvSecrets(
    repoDatabaseId: string,
    envName: string,
  ): Promise<SecretQueryResponse[]> {
    try {
      const repoSecrets = await this.v3.paginate(
        'GET /repositories/{repository_id}/environments/{environment_name}/secrets' as any, //https://docs.github.com/en/rest/reference/actions#list-environment-secrets
        {
          repository_id: repoDatabaseId,
          environment_name: envName,
          per_page: 100,
        },
        (response) => {
          this.logger.info('Fetched page of secrets for a repo environment');
          this.v3RateLimitConsumed++;
          return response.data;
        },
      );
      return repoSecrets || [];
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest repo environment secrets',
      );
      throw new IntegrationError(err);
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
    } catch (responseErrors) {
      throw new IntegrationError(responseErrors);
    }
  }
}
