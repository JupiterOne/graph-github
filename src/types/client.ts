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

export enum PRState {
  Open = 'open',
  Closed = 'closed',
}

export interface DiffFiles {
  sha: string;
  patch?: string;
}

export interface ReposCompareCommitsResponseItem {
  commits: ReposListCommitsResponseItem[];
  // Not going to type files because we only use it to check for emptiness.
  files?: DiffFiles[];
}
