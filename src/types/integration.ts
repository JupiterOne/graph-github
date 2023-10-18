/**
 * The type of GitHub account the integration is synchronizing.
 */
export enum AccountType {
  Org = 'Organization',
  User = 'User',
}

export type IdEntityMap<V> = Map<string, V>;

export interface OutsideCollaboratorData {
  key: string;
  login: string;
}

/**
 * The permissions that come back with an access token in an auth call.
 * This list is not exhaustive; if the token doesn't have access to a certain
 * scope, the property simply does not come through in the permissions object
 * for possible permissions, the App owner can check:
 * https://github.com/settings/apps/{YOURAPPNAME}/permissions
 */
export interface TokenPermissions {
  members?: string; //we need this to be set to 'read' or 'write'
  metadata?: string; //we need this to be set to 'read'
  repository?: string;
  organization_administration?: string; //'read' or 'write'
  organization_events?: string; //'read' or 'write'
  organization_hooks?: string; //'read' or 'write'
  organization_packages?: string; //'read' or 'write'
  organization_plan?: string; //'read'
  organization_projects?: string; //'read', 'write', or 'admin'
  organization_secrets?: string; //'read' or 'write'
  organization_self_hosted_runners?: string; //'read' or 'write'
  organization_user_blocking?: string; //'read' or 'write'
  team_discussions?: string; //'read' or 'write'
  administration?: string; //'read' or 'write'
  actions?: string;
  blocking?: string;
  checks?: string;
  contents?: string;
  deployments?: string;
  discussions?: string;
  emails?: string;
  environments?: string;
  followers?: string;
  gists?: string;
  gpg_keys?: string;
  interaction_limits?: string;
  issues?: string;
  keys?: string;
  packages?: string;
  pages?: string;
  plan?: string;
  profile?: string;
  pull_requests?: string;
  repository_hooks?: string;
  repository_projects?: string;
  secrets?: string;
  secret_scanning_alerts?: string;
  security_events?: string;
  starring?: string;
  statuses?: string;
  vulnerability_alerts?: string;
  watching?: string;
  workflows?: string;
}
