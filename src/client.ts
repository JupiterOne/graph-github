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
import resourceMetadataMap from './client/GraphQLClient/resourceMetadataMap';
import {
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
  GitHubGraphQLClient,
  OrgTeamRepoQueryResponse,
  OrgCollaboratorQueryResponse,
  OrgAppQueryResponse,
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
  ghsToken: string;
  scopedForApps: boolean;
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

    // Check 'useRestForTeamRepos' config variable as a hack to allow large github
    // accounts to bypass a Github error. Please delete this code once that error is fixed.
    const allTeamRepos: OrgTeamRepoQueryResponse[] = this.config
      .useRestForTeamRepos
      ? await this.accountClient.getTeamReposWithRest()
      : await this.accountClient.getTeamRepositories();

    for (const team of teams) {
      team.members = allTeamMembers.filter(
        (member) => member.teams === team.id,
      );
      team.repos = allTeamRepos.filter((repo) => repo.teams === team.id);
      await iteratee(team);
    }
  }

  /**
   * Iterates each installed GitHub application.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateApps(
    iteratee: ResourceIteratee<OrgAppQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.scopedForApps) {
      const apps: OrgAppQueryResponse[] = await this.accountClient.getInstalledApps(
        this.ghsToken,
      );
      console.log(`apps: ${JSON.stringify(apps, null, 2)}`);
      /*for (const app of apps) {
        console.log('follows is the app output:');
        console.log(app); //TODO: delete this
        await iteratee(app);
      }*/
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
    logger: IntegrationLogger,
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
      logger,
    );
    if (pullrequests) {
      for (const pr of pullrequests) {
        await iteratee(pr);
      }
    }
  }

  /**
   * Iterates the collaborators for a repo in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateCollaborators(
    repo: RepoEntity,
    iteratee: ResourceIteratee<OrgCollaboratorQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const collaborators: OrgCollaboratorQueryResponse[] = await this.accountClient.getRepoCollaboratorsWithRest(
      repo.name,
    );
    for (const collab of collaborators) {
      await iteratee(collab);
    }

    //we would prefer to use GraphQL to get collabs, but we haven't figured out how to make that work
    //this code for future dev
    /*
    const collabs: OrgCollaboratorQueryResponse[] = await this.accountClient.getRepoCollaborators();
    console.log('GraphQL approach to collabs:');
    console.log(collabs);
    for (const collab of collabs) {
      console.log(collab);
    }
    */
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
      this.ghsToken = token;
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

    //note that ingesting installed applications requires scope organization_administration:read
    if (
      !(
        myPermissions.organization_administration === 'read' ||
        myPermissions.organization_administration === 'write'
      )
    ) {
      this.scopedForApps = false;
      this.logger.warn(
        {},
        'Token does not have organization_administration scope, so installed GitHub Apps cannot be ingested',
      );
    } else {
      this.scopedForApps = true;
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
