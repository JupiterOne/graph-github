import {
  IntegrationLogger,
  IntegrationValidationError,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import {
  AccountType,
  RepoEntity,
  RepoKeyAndName,
  TokenPermissions,
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
} from './client/GraphQLClient';
import {
  RepoCollaboratorQueryResponse,
  OrgAppQueryResponse,
  SecretQueryResponse,
  RepoEnvironmentQueryResponse,
} from './client/RESTClient/types';
import { PullRequest } from './client/GraphQLClient/types';

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
  orgAdminScope: boolean;
  secretsScope: boolean;
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
      ? await this.accountClient.getTeamReposWithRest(teams)
      : await this.accountClient.getTeamRepositories(teams);

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
    if (this.orgAdminScope) {
      const apps: OrgAppQueryResponse[] = await this.accountClient.getInstalledApps(
        this.ghsToken,
      );
      for (const app of apps) {
        await iteratee(app);
      }
    }
  }

  /**
   * Iterates each Github organization secret.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateOrgSecrets(
    allRepos: RepoKeyAndName[],
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.secretsScope) {
      const secrets: SecretQueryResponse[] = await this.accountClient.getOrganizationSecrets();
      for (const secret of secrets) {
        //set repos that use this secret, so we can make relationships in iteratree
        secret.visibility === 'all'
          ? (secret.repos = allRepos)
          : (secret.repos = []);
        if (
          secret.visibility === 'selected' ||
          secret.visibility === 'private'
        ) {
          //go get the list of repos and add them
          const reposForOrgSecret = await this.accountClient.getReposForOrgSecret(
            secret.name,
          );
          const secretRepos: RepoKeyAndName[] = [];
          for (const repo of reposForOrgSecret) {
            const repoTag = allRepos.find((r) => r._key === repo.node_id);
            if (repoTag) {
              secretRepos.push(repoTag);
            }
          }
          secret.repos = secretRepos;
        }
        await iteratee(secret);
      }
    }
  }

  /**
   * Iterates each Github repo secret.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateRepoSecrets(
    repoName: string,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.secretsScope) {
      const repoSecrets: SecretQueryResponse[] = await this.accountClient.getRepoSecrets(
        repoName,
      );
      for (const secret of repoSecrets) {
        await iteratee(secret);
      }
    }
  }

  /**
   * Iterates each Github environment and ingests any environmental secrets.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateEnvironments(
    repoDatabaseId: string,
    repoName: string,
    iteratee: ResourceIteratee<RepoEnvironmentQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.secretsScope) {
      const environments: RepoEnvironmentQueryResponse[] = await this.accountClient.getEnvironments(
        repoName,
      );
      for (const env of environments) {
        env.envSecrets = [];
        if (this.secretsScope) {
          //go get env secrets and load the env object
          const envSecrets = await this.accountClient.getEnvSecrets(
            repoDatabaseId,
            env.name,
          );
          env.envSecrets = envSecrets;
        }
        await iteratee(env);
      }
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
    repo: RepoEntity,
    logger: IntegrationLogger,
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const {
      rateLimitConsumed,
    } = await this.accountClient.iteratePullRequestEntities(repo, iteratee);
    logger.info(
      { rateLimitConsumed },
      'Rate limit consumed while fetching Pull Requests.',
    );
  }

  /**
   * Iterates the collaborators for a repo in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateCollaborators(
    repo: RepoKeyAndName,
    iteratee: ResourceIteratee<RepoCollaboratorQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const collaborators: RepoCollaboratorQueryResponse[] = await this.accountClient.getRepoCollaboratorsWithRest(
      repo.name,
    );
    for (const collab of collaborators) {
      await iteratee(collab);
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
      this.ghsToken = token;
      myPermissions = permissions;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: `https://api.github.com/app/installations/${this.config.installationId}/access_tokens`,
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
      this.orgAdminScope = false;
      this.logger.info(
        {},
        'Token does not have organization_administration scope. Installed GitHub Apps cannot be ingested',
      );
    } else {
      this.orgAdminScope = true;
    }

    //ingesting org secrets requires scope secrets:read
    if (
      !(myPermissions.secrets === 'read' || myPermissions.secrets === 'write')
    ) {
      this.secretsScope = false;
      this.logger.info(
        {},
        "Token does not have 'secrets' scope. Organization secrets cannot be ingested",
      );
    } else {
      this.secretsScope = true;
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
    });
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
