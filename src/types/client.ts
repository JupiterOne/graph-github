import { RestEndpointMethodTypes } from '@octokit/rest';

/*
 * A feature used repeatedly here is lookup types, which allows you to get T
 * from Array<T>.
 *
 * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html#keyof-and-lookup-types
 */
export type AppsGetInstallationResponse = RestEndpointMethodTypes['apps']['getInstallation']['response']['data'];

export type PullsListResponseItem = RestEndpointMethodTypes['pulls']['list']['response']['data'][0];
export type PullsListCommitsResponseItem = RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0];
export type PullsListReviewsResponseItem = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0];

export type OrgsListMembersResponseItem = RestEndpointMethodTypes['orgs']['listMembers']['response']['data'][0];

export type ReposListCommitsResponseItem = RestEndpointMethodTypes['repos']['listCommits']['response']['data'][0];

export type TeamsListReposResponseItem = RestEndpointMethodTypes['teams']['listReposInOrg']['response']['data'][0];

export interface OrgsListMembersResponseItemWithName
  extends OrgsListMembersResponseItem {
  name: string;
}

export enum PRState {
  Open = 'open',
  Closed = 'closed',
}

export interface DiffFiles {
  sha: string;
  patch: string;
}

export interface ReposCompareCommitsResponseItem {
  commits: ReposListCommitsResponseItem[];
  // Not going to type files because we only use it to check for emptiness.
  files: DiffFiles[];
}

export interface TokenPermissions {
  //if there is no access to a certain permission, the property does not come through from the API
  //there are other properties besides these
  //https://github.com/settings/apps/{YOURAPPNAME}/permissions
  administration: string; //'read' or 'write'
  members: string; //we need this to be set to 'read' or 'write'
  metadata: string; //we need this to be set to 'read'
  repository: string;
  organization_administration: string; //'read' or 'write'
  organization_events: string; //'read' or 'write'
  organization_hooks: string; //'read' or 'write'
  organization_packages: string; //'read' or 'write'
  organization_plan: string; //'read'
  organization_projects: string; //'read', 'write', or 'admin'
  organization_secrets: string; //'read' or 'write'
  organization_self_hosted_runners: string; //'read' or 'write'
  organization_user_blocking: string; //'read' or 'write'
  team_discussions: string; //'read' or 'write'
  actions: string;
  checks: string;
  contents: string;
  deployments: string;
  discussions: string;
  environments: string;
  issues: string;
  packages: string;
  pages: string;
  pull_requests: string;
  repository_hooks: string;
  repository_projects: string;
  secrets: string;
  secret_scanning_alerts: string;
  security_events: string;
  statuses: string;
  vulnerability_alerts: string;
  workflows: string;
}
