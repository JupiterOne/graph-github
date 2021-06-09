import {
  IntegrationLogger,
  IntegrationValidationError,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import {
  AccountEntity,
  AccountType,
  IdEntityMap,
  PullRequestEntity,
  RepoEntity,
  TokenPermissions,
  UserEntity,
} from './types';
import getInstallation from './util/getInstallation';
import createGitHubAppClient from './util/createGitHubAppClient';
import OrganizationAccountClient from './client/OrganizationAccountClient';
import {
  GitHubGraphQLClient,
  OrgTeamRepoQueryResponse,
} from './client/GraphQLClient';
import resourceMetadataMap from './client/GraphQLClient/resourceMetadataMap';
import {
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
} from './client/GraphQLClient';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  accountClient: OrganizationAccountClient;
  constructor(
    readonly config: IntegrationConfig,
    readonly logger: IntegrationLogger,
  ) {}

  public async verifyAuthentication(): Promise<void> {
    // the most light-weight request possible to validate
    // authentication works with the provided credentials, throw an err if
    // authentication fails
    await this.setupAccountClient();
  }

  public async getAccountDetails(): Promise<OrgQueryResponse> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    return await this.accountClient.getAccount();
  }

  /**
   * Iterates each member (user) resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateMembers(
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const members: OrgMemberQueryResponse[] = await this.accountClient.getMembers();
    for (const member of members) {
      await iteratee(member);
    }
  }

  /**
   * Iterates each team resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeams(
    iteratee: ResourceIteratee<OrgTeamQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const teams: OrgTeamQueryResponse[] = await this.accountClient.getTeams();
    const allTeamMembers: OrgTeamMemberQueryResponse[] = await this.accountClient.getTeamMembers();
    const allTeamRepos: OrgTeamRepoQueryResponse[] = await this.accountClient.getTeamRepositories();
    for (const team of teams) {
      team.members = [];
      for (const member of allTeamMembers) {
        if (member.teams === team.id) {
          team.members.push(member);
        }
      }
      team.repos = [];
      for (const repo of allTeamRepos) {
        if (repo.teams === team.id) {
          team.repos.push(repo);
        }
      }
      await iteratee(team);
    }
  }

  /**
   * Iterates each repo (CodeRepo) resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateRepos(
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const repos: OrgRepoQueryResponse[] = await this.accountClient.getRepositories();
    for (const repo of repos) {
      await iteratee(repo);
    }
  }

  /**
   * Iterates each pull request (PR) resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iteratePullRequests(
    account: AccountEntity,
    repo: RepoEntity,
    memberEntities: UserEntity[],
    memberByLoginMap: IdEntityMap<UserEntity>,
    iteratee: ResourceIteratee<PullRequestEntity>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }

    const pullrequests = await this.accountClient.getPullRequestEntities(
      account,
      repo,
      memberEntities,
      memberByLoginMap,
    );
    if (pullrequests) {
      for (const pr of pullrequests) {
        await iteratee(pr);
      }
    }
  }

  public async setupAccountClient(): Promise<void> {
    if (isNaN(this.config.installationId)) {
      throw new IntegrationValidationError(
        'Integration id should be a number.',
      );
    }
    const installationId = Number(this.config.installationId);
    const appClient = createGitHubAppClient(this.config, this.logger);
    let myToken: string;
    let myPermissions: TokenPermissions;
    try {
      const { token, permissions } = (await appClient.auth({
        type: 'installation',
      })) as {
        token: string;
        permissions: TokenPermissions;
      };
      myToken = token;
      myPermissions = permissions;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: `https://api.github.com/app/installations/${this.config.installation_id}/access_tokens`,
        status: err.status,
        statusText: err.statusText,
      });
    }

    //checking for proper scopes
    if (
      !(myPermissions.members === 'read' || myPermissions.members === 'write')
    ) {
      throw new IntegrationValidationError(
        'Integration requires read access to organization members. See GitHub App permissions.',
      );
    }

    if (
      !(myPermissions.metadata === 'read' || myPermissions.metadata === 'write')
    ) {
      //as of now, this property has no 'write' value, but just in case
      throw new IntegrationValidationError(
        'Integration requires read access to repository metadata. See GitHub App permissions.',
      );
    }
    //scopes check done

    let login: string = this.config.githubAppDefaultLogin;
    const installation = await getInstallation(appClient, installationId);
    if (installation.target_type !== AccountType.Org) {
      throw new IntegrationValidationError(
        'Integration supports only GitHub Organization accounts.',
      );
    }
    if (installation.account) {
      login = installation.account.login || this.config.githubAppDefaultLogin;
    }

    this.accountClient = new OrganizationAccountClient({
      login: login,
      restClient: appClient,
      graphqlClient: new GitHubGraphQLClient(
        myToken,
        resourceMetadataMap(),
        this.logger,
      ),
      logger: this.logger,
      analyzeCommitApproval: this.config.analyzeCommitApproval,
    });
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
