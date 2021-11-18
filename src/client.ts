import {
  IntegrationLogger,
  IntegrationValidationError,
  IntegrationProviderAuthenticationError,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import {
  AccountType,
  EnvironmentEntity,
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
  OrgAppQueryResponse,
  SecretQueryResponse,
  RepoEnvironmentQueryResponse,
} from './client/RESTClient/types';
import { PullRequest, Issue, Collaborator } from './client/GraphQLClient/types';

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
  scopes: {
    orgAdmin: boolean;
    orgSecrets: boolean;
    repoSecrets: boolean;
    repoEnvironments: boolean;
    repoIssues: boolean;
  };
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
    const members: OrgMemberQueryResponse[] =
      await this.accountClient.getMembers();
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
    for (const team of teams) {
      await iteratee(team);
    }
  }

  /**
   * Iterates each team-repo association from the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeamRepos(
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }

    const allTeamRepos: OrgTeamRepoQueryResponse[] =
      await this.accountClient.getTeamRepositories();

    for (const teamRepoAssociation of allTeamRepos) {
      await iteratee(teamRepoAssociation);
    }
  }

  /**
   * Iterates each team-member association from the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateTeamMembers(
    iteratee: ResourceIteratee<OrgTeamMemberQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }

    const allTeamMembers: OrgTeamMemberQueryResponse[] =
      await this.accountClient.getTeamMembers();

    for (const teamUserAssociation of allTeamMembers) {
      await iteratee(teamUserAssociation);
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
    if (this.scopes.orgAdmin) {
      const apps: OrgAppQueryResponse[] =
        await this.accountClient.getInstalledApps(this.ghsToken);
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
    if (this.scopes.orgSecrets) {
      const secrets: SecretQueryResponse[] =
        await this.accountClient.getOrganizationSecrets();
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
          const reposForOrgSecret =
            await this.accountClient.getReposForOrgSecret(secret.name);
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
    if (this.scopes.repoSecrets) {
      const repoSecrets: SecretQueryResponse[] =
        await this.accountClient.getRepoSecrets(repoName);
      for (const secret of repoSecrets) {
        await iteratee(secret);
      }
    }
  }

  /**
   * Iterates each Github environment.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateEnvironments(
    repoName: string,
    iteratee: ResourceIteratee<RepoEnvironmentQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoEnvironments) {
      const environments: RepoEnvironmentQueryResponse[] =
        await this.accountClient.getEnvironments(repoName);
      for (const env of environments) {
        await iteratee(env);
      }
    }
  }

  /**
   * Iterates each Github environmental secret.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateEnvSecrets(
    envEntity: EnvironmentEntity,
    iteratee: ResourceIteratee<SecretQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoSecrets) {
      const envSecrets = await this.accountClient.getEnvSecrets(
        envEntity.parentRepoDatabaseId,
        envEntity.name,
        envEntity.parentRepoName,
      );
      for (const envSecret of envSecrets) {
        await iteratee(envSecret);
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
    const repos: OrgRepoQueryResponse[] =
      await this.accountClient.getRepositories();
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
    lastSuccessfulExecution: string,
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const { rateLimitConsumed } =
      await this.accountClient.iteratePullRequestEntities(
        repo,
        lastSuccessfulExecution,
        iteratee,
      );
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
    iteratee: ResourceIteratee<Collaborator>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }

    const collaborators = await this.accountClient.getCollaborators();
    for (const collab of collaborators) {
      await iteratee(collab);
    }
  }

  /**
   * Iterates the issues for a repo in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateIssues(
    repo: RepoEntity,
    lastSuccessfulExecution: string,
    iteratee: ResourceIteratee<Issue>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    if (this.scopes.repoIssues) {
      const { rateLimitConsumed } =
        await this.accountClient.iterateIssueEntities(
          repo,
          lastSuccessfulExecution,
          iteratee,
        );
      this.logger.info(
        { rateLimitConsumed },
        'Rate limit consumed while fetching Issues.',
      );
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
    let tokenExpires: number;
    let myPermissions: TokenPermissions;
    try {
      const { token, permissions, expiresAt } = (await appClient.auth({
        type: 'installation',
      })) as {
        token: string;
        permissions: TokenPermissions;
        expiresAt: string;
      };
      this.ghsToken = token;
      myPermissions = permissions;
      tokenExpires = parseTimePropertyValue(expiresAt) || 0;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: `https://api.github.com/app/installations/${this.config.installationId}/access_tokens`,
        status: err.status,
        statusText: err.statusText,
      });
    }

    if (myPermissions) {
      this.processScopes(myPermissions);
    } else {
      throw new IntegrationValidationError(
        'Installed GitHub app did not provide any permissions. Aborting step.',
      );
    }

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
        this.ghsToken,
        tokenExpires,
        resourceMetadataMap(),
        this.logger,
        appClient,
      ),
      logger: this.logger,
    });
  }

  private processScopes(perms: TokenPermissions) {
    if (!this.scopes) {
      this.scopes = {
        orgAdmin: false,
        orgSecrets: false,
        repoSecrets: false,
        repoEnvironments: false,
        repoIssues: false,
      };
    }
    //checking for proper scopes
    if (!(perms.members === 'read' || perms.members === 'write')) {
      throw new IntegrationValidationError(
        'Integration requires read access to organization members. See GitHub App permissions.',
      );
    }

    if (!(perms.metadata === 'read' || perms.metadata === 'write')) {
      //as of now, this property has no 'write' value, but just in case
      throw new IntegrationValidationError(
        'Integration requires read access to repository metadata. See GitHub App permissions.',
      );
    }

    //note that ingesting installed applications requires scope organization_administration:read
    if (
      !(
        perms.organization_administration === 'read' ||
        perms.organization_administration === 'write'
      )
    ) {
      this.scopes.orgAdmin = false;
      this.logger.info(
        {},
        'Token does not have organization_administration scope. Installed GitHub Apps cannot be ingested',
      );
    } else {
      this.scopes.orgAdmin = true;
    }

    //ingesting org secrets requires scope organization_secrets:read
    if (
      !(
        perms.organization_secrets === 'read' ||
        perms.organization_secrets === 'write'
      )
    ) {
      this.scopes.orgSecrets = false;
      this.logger.info(
        {},
        "Token does not have 'organization_secrets' scope. Org secrets cannot be ingested",
      );
    } else {
      this.scopes.orgSecrets = true;
    }

    //ingesting repo and env secrets requires scope secrets:read
    if (!(perms.secrets === 'read' || perms.secrets === 'write')) {
      this.scopes.repoSecrets = false;
      this.logger.info(
        {},
        "Token does not have 'secrets' scope. Repo and environmental secrets cannot be ingested",
      );
    } else {
      this.scopes.repoSecrets = true;
    }

    //ingesting environments or environmental secrets requires scope environments:read
    if (!(perms.environments === 'read' || perms.environments === 'write')) {
      this.scopes.repoEnvironments = false;
      this.logger.info(
        {},
        "Token does not have 'environments' scope. Environments and environmental secrets cannot be ingested",
      );
    } else {
      this.scopes.repoEnvironments = true;
    }

    //ingesting repo issues requires scope issues:read
    if (!(perms.issues === 'read' || perms.issues === 'write')) {
      this.scopes.repoIssues = false;
      this.logger.info(
        {},
        "Token does not have 'issues' scope. Repo issues cannot be ingested",
      );
    } else {
      this.scopes.repoIssues = true;
    }
    //scopes check done
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
