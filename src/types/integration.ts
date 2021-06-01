import { IntegrationExecutionContext } from '@jupiterone/integration-sdk-core';
import {
  AccountEntity,
  UserEntity,
  RepoEntity,
  TeamEntity,
  PullRequestEntity,
  AccountRepoRelationship,
  OrganizationMemberRelationship,
  RepoPullRequestRelationship,
  UserPullRequestRelationship,
  OrganizationTeamRelationship,
} from './';
import OrganizationAccountClient from '../client/OrganizationAccountClient';
import { TeamMemberRelationship, TeamRepoRelationship } from './persister';

/**
 * The type of GitHub account the integration is synchronizing.
 */
export enum AccountType {
  Org = 'Organization',
  User = 'User',
}

/**
 * A temporary API access token created by GitHub.
 */
export interface AccessToken {
  token: string;
  expiresAt: string;
}

/**
 * Access information for a GitHub App, used to make API calls that provide info
 * about the app or allow the app to create installation access tokens.
 */
export interface AppAccess extends AccessToken {
  appId: number;
}

/**
 * Access information for an installation of a GitHub App, used to make API
 * calls that provide info about the GitHub account where the app is installed.
 */
export interface AppInstallationAccess extends AccessToken {
  installationId: number;
}

/**
 * An extension of `IntegrationExecutionContext` to include a GitHub API client
 * configured to authenticate according to the access mechanism determined by
 * the kind of account and authentication mechanism specified by the instance
 * configuration.
 */
export interface GitHubIntegrationExecutionContext
  extends IntegrationExecutionContext {
  //graph: GraphClient;
  //persister: PersisterClient;
  accountType: AccountType;
  github: OrganizationAccountClient;
}

export interface IdEntityMap<V> {
  [key: string]: V;
}
