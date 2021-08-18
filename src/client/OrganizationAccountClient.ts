import pMap from 'p-map';
import { Octokit } from '@octokit/rest';
import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

import {
  GitHubGraphQLClient,
  OrganizationResource,
  OrgMemberQueryResponse,
  OrgTeamQueryResponse,
  OrgRepoQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamRepoQueryResponse,
  TeamRepositoryPermission,
  OrgCollaboratorQueryResponse,
} from './GraphQLClient';
import {
  UserEntity,
  RepoEntity,
  AccountEntity,
  IdEntityMap,
  PullRequestEntity,
  ReposCompareCommitsResponseItem,
  DiffFiles,
  PullsListResponseItem,
  PullsListReviewsResponseItem,
  PullsListCommitsResponseItem,
  ReposListCommitsResponseItem,
} from '../types';
import collectCommitsForPR from '../approval/collectCommitsForPR';
import { toPullRequestEntity } from '../sync/converters';
import sha from '../util/sha';

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
  readonly analyzeCommitApproval: boolean;

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
    /**
     * Whether or not pull request commits should be analyzed for approval.
     *
     * Specifically, if this boolean is true, two additional calls to the
     * API are executed, and the results processed to give values for the
     * following properties to the pullrequest entity:
     *  approved
     *  validated
     *  commits
     *  commitMessages
     *  commitsApproved
     *  commitsNotApproved
     *  commitsByUnknownAuthor
     *  approvers
     *  approverLogins
     *
     * All these properties will be set to undefined if analyzeCommitApproval
     * is false.
     */
    analyzeCommitApproval: boolean;
  }) {
    this.login = options.login;
    this.v3 = options.restClient;
    this.v4 = options.graphqlClient;
    this.logger = options.logger;
    this.analyzeCommitApproval = options.analyzeCommitApproval;

    this.authorizedForPullRequests = true;
    this.v3RateLimitConsumed = 0;
    this.v4RateLimitConsumed = 0;
  }

  async getAccount(allData: boolean = true): Promise<OrgQueryResponse> {
    if (!this.account) {
      const fetchResources = allData
        ? [
            OrganizationResource.Members,
            OrganizationResource.Teams,
            OrganizationResource.TeamMembers,
            OrganizationResource.Repositories,
          ]
        : [];

      await this.queryGraphQL('account and related resources', async () => {
        const {
          organization,
          members,
          teams,
          teamMembers,
          repositories,
          rateLimitConsumed,
        } = await this.v4.fetchOrganization(this.login, fetchResources);

        this.members = members;
        this.teams = teams;
        this.teamMembers = teamMembers;
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
        } = await this.v4.fetchOrganization(this.login, [
          OrganizationResource.Teams,
        ]);

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
          teamMembers,
          rateLimitConsumed,
        } = await this.v4.fetchOrganization(this.login, [
          OrganizationResource.TeamMembers,
        ]);

        this.teamMembers = teamMembers;

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
        } = await this.v4.fetchOrganization(this.login, [
          OrganizationResource.Repositories,
        ]);

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
          } = await this.v4.fetchOrganization(this.login, [
            OrganizationResource.TeamRepositories,
          ]);
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

  async getRepoDirectCollaboratorsWithRest(repoName: string): Promise<any> {
    try {
      const repoCollaborators = await this.v3.paginate(
        'GET /repos/{owner}/{repo}/collaborators', // https://docs.github.com/en/rest/reference/repos#list-repository-collaborators
        {
          owner: this.login,
          repo: repoName,
          per_page: 100,
          affiliation: 'direct', //'direct' means directly assigned members or outside collaborators
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

  /* currently not being used because GraphQL is not cooperating, but here's the code for future research
  async getRepoCollaborators(): Promise<OrgCollaboratorQueryResponse[]> {
    if (!this.collaborators) {
      await this.queryGraphQL('collaborators', async () => {
        const {
          collaborators,
          rateLimitConsumed,
        } = await this.v4.fetchOrganization(this.login, [
          OrganizationResource.RepositoryCollaborators,
        ]);

        this.collaborators = collaborators;

        return rateLimitConsumed;
      });
    }

    return this.collaborators || [];
  }
  */

  async getMembers(): Promise<OrgMemberQueryResponse[]> {
    if (!this.members) {
      await this.queryGraphQL('members', async () => {
        const {
          members,
          rateLimitConsumed,
        } = await this.v4.fetchOrganization(this.login, [
          OrganizationResource.Members,
        ]);

        this.members = members;

        return rateLimitConsumed;
      });
    }

    return this.members || [];
  }

  async getPullRequestEntity(
    account: AccountEntity,
    repo: RepoEntity,
    id: number,
    teamMembers: UserEntity[],
    teamMemberMap: IdEntityMap<UserEntity>,
  ): Promise<PullRequestEntity | undefined> {
    // This function is meant to be used for ingesting a single
    //specific PR on-demand. For that reason, it automatically
    //does the commit and approval analysis regardless of the
    //analyzeCommitApproval config boolean
    if (!this.authorizedForPullRequests) {
      return undefined;
    }

    try {
      const pullRequests = (
        await this.v3.pulls.list({
          //changed from .get to .list for typing reasons
          owner: account.login,
          repo: repo.name,
          pull_number: id,
        })
      ).data;
      const pullRequest = pullRequests[0];

      this.v3RateLimitConsumed++;

      const {
        allCommits,
        approvedCommits,
        commitsByUnknownAuthor,
        approvals,
      } = await collectCommitsForPR(this, account, pullRequest, teamMembers);
      return toPullRequestEntity(
        pullRequest,
        allCommits,
        approvedCommits,
        commitsByUnknownAuthor,
        approvals,
        teamMemberMap,
      );
    } catch (err) {
      this.logger.info({ err }, 'pulls.get failed');

      if (err.status === 403) {
        this.authorizedForPullRequests = false;
      }
    }
  }

  async getPullRequestEntities(
    account: AccountEntity,
    repo: RepoEntity,
    teamMembers: UserEntity[],
    teamMemberMap: IdEntityMap<UserEntity>,
    logger: IntegrationLogger,
  ): Promise<Array<PullRequestEntity> | undefined> {
    if (!this.authorizedForPullRequests) {
      return undefined;
    }

    let pullRequests: PullsListResponseItem[];

    try {
      logger.info(
        { repoName: repo.name },
        'fetching batch of pull requests from repo',
      );
      const prCount = 100;
      pullRequests = (
        await this.v3.pulls.list({
          owner: account.login,
          repo: repo.name,
          per_page: prCount,
          state: 'all',
        })
      ).data;

      this.v3RateLimitConsumed++;

      return pMap(
        pullRequests,
        async (pullRequest) => {
          // This is incredibly slow thanks to Github's rate and abuse limiting. Be careful when turning this on!
          if (this.analyzeCommitApproval) {
            const {
              allCommits,
              approvedCommits,
              commitsByUnknownAuthor,
              approvals,
            } = await collectCommitsForPR(
              this,
              account,
              pullRequest,
              teamMembers,
            );
            return toPullRequestEntity(
              pullRequest,
              allCommits,
              approvedCommits,
              commitsByUnknownAuthor,
              approvals,
              teamMemberMap,
            );
          } else {
            return toPullRequestEntity(pullRequest);
          }
        },
        { concurrency: 1 },
      );
    } catch (err) {
      this.logger.info({ err }, 'pulls.list failed');

      if (err.status === 403) {
        this.authorizedForPullRequests = false;
      }
    }
  }

  async getPullRequestReviews(
    account: AccountEntity,
    pullRequest: PullsListResponseItem,
  ): Promise<PullsListReviewsResponseItem[]> {
    const listOptions = {
      owner: account.login,
      repo: pullRequest.base.repo.name,
      pull_number: pullRequest.number,
    };

    try {
      const reviews = (await this.v3.pulls.listReviews(listOptions)).data;

      this.v3RateLimitConsumed++;
      return reviews;
    } catch (err) {
      this.logger.info({ err }, 'pulls.listReviews failed');
      return [];
    }
  }

  async getPullRequestCommits(
    account: AccountEntity,
    pullRequest: PullsListResponseItem,
  ): Promise<PullsListCommitsResponseItem[]> {
    const listOptions = {
      owner: account.login,
      repo: pullRequest.base.repo.name,
      pull_number: pullRequest.number,
    };

    try {
      const commits = (
        await this.v3.pulls.listCommits({
          ...listOptions,
          /**
           * This is the maximum number of commits we're allowed to fetch from
           * this endpoint. If we for some reason need to fetch more than 250, we
           * need to use the commits endpoint.
           */
          per_page: 250,
        })
      ).data;

      this.v3RateLimitConsumed++;
      return commits;
    } catch (err) {
      this.logger.info({ err, listOptions }, 'pulls.listCommits failed');

      return [];
    }
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
