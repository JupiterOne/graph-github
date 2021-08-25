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
  OrgCollaboratorQueryResponse,
  OrgAppQueryResponse,
  GithubResource,
  OrgSecretQueryResponse,
} from './GraphQLClient';
import {
  RepoEntity,
  ReposCompareCommitsResponseItem,
  DiffFiles,
  ReposListCommitsResponseItem,
} from '../types';
import sha from '../util/sha';
import { request } from '@octokit/request';
import { ResourceIteratee } from '../client';
import { PullRequest, PullRequestQueryResponse } from './GraphQLClient/types';

export default class OrganizationAccountClient {
  authorizedForPullRequests: boolean;

  private account: OrgQueryResponse | undefined;
  private members: OrgMemberQueryResponse[] | undefined;
  private teams: OrgTeamQueryResponse[] | undefined;
  private teamMembers: OrgTeamMemberQueryResponse[] | undefined;
  private teamRepositories: OrgTeamRepoQueryResponse[] | undefined;
  private repositories: OrgRepoQueryResponse[] | undefined;
  private collaborators: OrgCollaboratorQueryResponse[] | undefined;

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

  async getAccount(allData: boolean = true): Promise<OrgQueryResponse> {
    if (!this.account) {
      const fetchResources = allData
        ? [
            GithubResource.OrganizationMembers,
            GithubResource.Teams,
            GithubResource.TeamMembers,
            GithubResource.Repositories,
          ]
        : [];

      await this.queryGraphQL('account and related resources', async () => {
        const {
          organization,
          membersWithRole,
          teams,
          members,
          repositories,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          fetchResources,
          { login: this.login },
        );

        this.members = membersWithRole;
        this.teams = teams;
        this.teamMembers = members;
        this.repositories = repositories;
        this.account = organization![0];

        return rateLimitConsumed;
      });
    }

    return this.account!;
  }

  async getTeams(): Promise<OrgTeamQueryResponse[]> {
    if (!this.teams) {
      await this.queryGraphQL('teams', async () => {
        const {
          teams,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          [GithubResource.Teams],
          { login: this.login },
        );

        this.teams = teams;

        return rateLimitConsumed;
      });
    }
    return this.teams || [];
  }

  async getTeamMembers(): Promise<OrgTeamMemberQueryResponse[]> {
    if (!this.teamMembers) {
      await this.queryGraphQL('team members', async () => {
        const {
          members,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          [GithubResource.TeamMembers],
          { login: this.login },
        );

        this.teamMembers = members;

        return rateLimitConsumed;
      });
    }

    return this.teamMembers || [];
  }

  async getRepositories(slugs?: string[]): Promise<OrgRepoQueryResponse[]> {
    if (!this.repositories) {
      await this.queryGraphQL('repositories', async () => {
        const {
          repositories,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          [GithubResource.Repositories],
          { login: this.login },
        );

        this.repositories = repositories;

        return rateLimitConsumed;
      });
    }

    if (slugs) {
      // TODO: allow selection of specific resources in the GQL. should be p ez
      return (this.repositories || []).filter((repo) =>
        slugs.includes(repo.name),
      );
    } else {
      return this.repositories || [];
    }
  }

  async getTeamRepositories(): Promise<OrgTeamRepoQueryResponse[]> {
    // For certain unusually long account ids, GraphQL has been known to throw errors on this call
    // This is a known bug from the Github side, but the exact triggering details are currently unknown
    // Therefore, the GraphQL call is wrapped here in a try-catch, with a fallback to the REST call
    // Note, however, that there are subtle differences in the response
    // For example, if a team has a child team, and both have access to a CodeRepo, the GraphQL will
    // return two team-repo entries - one showing the parent team allows the repo, and another showing
    // that the child team also does. The REST client will only return the parent team entry.
    if (!this.teamRepositories) {
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
          this.teamRepositories = teamRepositories;
          return rateLimitConsumed;
        });
      } catch (err) {
        if (
          err.message.includes(
            'Organization query for team repositories failed',
          )
        ) {
          return await this.getTeamReposWithRest();
        }
      } //end of catch and REST call
    }

    return this.teamRepositories || [];
  }

  // This is a hack to allow large github accounts to bypass a Github error. Please delete this code once that error is fixed.
  async getTeamReposWithRest(): Promise<OrgTeamRepoQueryResponse[]> {
    if (!this.teams) {
      throw new Error(
        'Do not attempt to call REST version of getTeamRepositories without first calling getTeams!',
      );
    }

    for (const team of this.teams) {
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

        return teamRepositories.map((tr) => {
          let permission: TeamRepositoryPermission;
          if (tr.permissions?.admin) {
            permission = TeamRepositoryPermission.Admin;
          } else if (tr.permissions?.push) {
            permission = TeamRepositoryPermission.Write;
          } else {
            permission = TeamRepositoryPermission.Read;
          }

          return {
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
      } catch (err) {
        throw new IntegrationError(err);
      }
    }

    return this.teamRepositories || [];
  }

  async getRepoCollaboratorsWithRest(
    repoName: string,
  ): Promise<OrgCollaboratorQueryResponse[]> {
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

      this.collaborators = repoCollaborators;
      return this.collaborators || [];
    } catch (err) {
      throw new IntegrationError(err);
    }
  }

  async getMembers(): Promise<OrgMemberQueryResponse[]> {
    if (!this.members) {
      await this.queryGraphQL('members', async () => {
        const {
          membersWithRole,
          rateLimitConsumed,
        } = await this.v4.fetchFromSingle(
          GithubResource.Organization,
          [GithubResource.OrganizationMembers],
          { login: this.login },
        );

        this.members = membersWithRole;

        return rateLimitConsumed;
      });
    }

    return this.members || [];
  }

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
    //the only thing that has worked in this direct call to @octokit/request.
    //This is not ideal, since it is not a paginated call. We could build our own pagination and
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

  async getOrganizationSecrets(ghsToken): Promise<OrgSecretQueryResponse[]> {
    //the endpoint needed is /orgs/{org}/actions/secrets
    //for why we are using request here, see comment on getInstalledApps
    try {
      const reply = await request(`GET /orgs/${this.login}/actions/secrets`, {
        headers: {
          authorization: `Bearer ${ghsToken}`,
        },
        type: 'private',
      });
      if (reply.data) {
        return reply.data.secrets;
      }
      this.logger.info({}, 'Found no organization secrets');
      return [];
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest organization secrets',
      );
      throw new IntegrationError(err);
    }
  }

  async getReposForOrgSecret(
    ghsToken,
    secretName,
  ): Promise<OrgRepoQueryResponse[]> {
    //the endpoint needed is /orgs/{org}/actions/secrets/{secret_name}/repositories
    //for why we are using request here, see comment on getInstalledApps
    try {
      const reply = await request(
        `GET /orgs/${this.login}/actions/secrets/${secretName}/repositories`,
        {
          headers: {
            authorization: `Bearer ${ghsToken}`,
          },
          type: 'private',
        },
      );
      if (reply.data) {
        return reply.data.repositories;
      }
      this.logger.info(
        {},
        `Expected but did not find repos for org secret ${secretName}`,
      );
      return [];
    } catch (err) {
      this.logger.warn(
        {},
        'Error while attempting to ingest repos for an organization secret',
      );
      throw new IntegrationError(err);
    }
  }

  async getRepoSecrets(
    ghsToken: string,
    repo: RepoEntity,
  ): Promise<OrgSecretQueryResponse[]> {
    //the endpoint needed is /repos/{owner}/{repo}/actions/secrets
    //for why we are using request here, see comment on getInstalledApps
    try {
      const reply = await request(
        `GET /repos/${this.login}/${repo.name}/actions/secrets`,
        {
          headers: {
            authorization: `Bearer ${ghsToken}`,
          },
          type: 'private',
        },
      );
      if (reply.data) {
        return reply.data.secrets;
      }
      return [];
    } catch (err) {
      this.logger.warn({}, 'Error while attempting to ingest repo secrets');
      throw new IntegrationError(err);
    }
  }

  async iteratePullRequestEntities(
    repo: RepoEntity,
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<PullRequestQueryResponse> {
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
