/**
 * From the name given to the data for the JupiterOne use case to the specific Github
 * GraphQl query to fetch that data (gotten via graphQL introspection)
 *
 * ex:
 *   Commits: 'commits' implies that there is a Github graphQL command 'commits'
 *   commits(first:100) {
 *     id
 *     message
 *     ...
 *   }
 */
export enum GithubResource {
  Organization = 'organization',
  OrganizationMembers = 'membersWithRole',
  Teams = 'teams',
  TeamMembers = 'members',
  TeamRepositories = 'teamRepositories',
  Repositories = 'repositories',
  Repository = 'repository',
  PullRequests = 'pullRequests',
  PullRequest = 'pullRequest',
  Commits = 'commits',
  Labels = 'labels',
  Reviews = 'reviews',
  Issues = 'issues',
  Assignees = 'assignees',
  Collaborators = 'collaborators',
  LabelsOnIssues = 'labelsOnIssues',
  DependencyGraphManifests = 'dependencyGraphManifests',
  Dependencies = 'dependencies',
}

export enum OrgMemberRole {
  Admin = 'ADMIN',
  Member = 'MEMBER',
}

export enum TeamMemberRole {
  Maintainer = 'MAINTAINER',
  Member = 'MEMBER',
}

export enum TeamRepositoryPermission {
  Admin = 'ADMIN',
  Maintain = 'MAINTAIN',
  Read = 'READ',
  Triage = 'TRIAGE',
  Write = 'WRITE',
}

// All Nodes MUST have an id or else they will not be parsed correctly
export interface Node {
  id: string;
}

interface Actor {
  name?: string | null;
  login: string;
}

export interface OrgQueryResponse extends Node, Actor {
  createdAt: string;
  updatedAt: string;
  description: string;
  email: string;
  databaseId: string;
  isVerified: boolean;
  location: string;
  websiteUrl: string;
  url: string;
}

/**
 * Organization GraphQL Fragment Types
 */

export interface OrgMemberQueryResponse extends Node, Actor {
  hasTwoFactorEnabled: boolean;
  role: OrgMemberRole;
  isSiteAdmin: boolean;
  company: string;
  createdAt: string;
  databaseId: string;
  email: string;
  isEmployee: boolean;
  location: string;
  updatedAt: string;
  url: string;
  websiteUrl: string;
}

export interface OrgTeamQueryResponse extends Node {
  url: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  databaseId: string;
  description: string;
  privacy: string;
}

//this response expresses the association between a team and a member of the team
export interface OrgTeamMemberQueryResponse extends Node {
  //id will be github User's id
  name?: string;
  login: string;
  teams: string; // a single team id, even though it is listed as a plural
  role: TeamMemberRole;
}

export interface OrgRepoQueryResponse extends Node {
  name: string;
  nameWithOwner: string;
  url: string;
  isPrivate: boolean | undefined;
  isArchived: boolean | undefined;
  createdAt: string;
  updatedAt: string;
  node_id?: string;
  autoMergeAllowed?: boolean;
  databaseId?: string;
  deleteBranchOnMerge?: boolean;
  description?: string;
  forkCount?: number;
  forkingAllowed?: boolean;
  homepageUrl?: string;
  isDisabled?: boolean;
  isEmpty?: boolean;
  isFork?: boolean;
  isInOrganization?: boolean;
  isLocked?: boolean;
  isMirror?: boolean;
  isSecurityPolicyEnabled?: boolean;
  isTemplate?: boolean;
  isUserConfigurationRepository?: boolean;
  lockReason?: string;
  mergeCommitAllowed?: boolean;
  pushedAt?: string;
  rebaseMergeAllowed?: boolean;
}

//this is expressing the edge between a repo and a team that it allows
export interface OrgTeamRepoQueryResponse extends Node {
  //property id will be the repo id
  teams: string; // a single team key, even though it sounds plural
  permission: TeamRepositoryPermission;
}

export interface GithubOrganizationResources {
  [GithubResource.Organization]: OrgQueryResponse[];
  [GithubResource.OrganizationMembers]: OrgMemberQueryResponse[];
  [GithubResource.Teams]: OrgTeamQueryResponse[];
  [GithubResource.TeamMembers]: OrgTeamMemberQueryResponse[];
  [GithubResource.TeamRepositories]: OrgTeamRepoQueryResponse[];
  [GithubResource.Repositories]: OrgRepoQueryResponse[];
  // [GithubResource. RepositoryCollaborators]: OrgCollaboratorQueryResponse[];
  // [GithubResource.DependencyGraphManifest]: DependencyGraphManifest[];
}

/**
 * Pull Request GraphQL Fragment Types
 */
export interface PullRequestUser {
  login: string;
  name?: string;
  isSiteAdmin: boolean;
}

export interface repositoryOwner {
  login: string;
  id: string;
  url: string;
}

export interface PullRequestCommitQueryResponse {
  commit: Commit;
}

export interface Commit extends Node {
  id: string;
  oid: string; // This is the sha
  message: string;
  authoredDate: string;
  changedFiles: number;
  commitUrl: string;
  author: {
    date?: string;
    user?: PullRequestUser;
  };
}

export interface Label extends Node {
  id: string;
  name: string;
}

export interface Review extends Node {
  id: string;
  commit?: {
    oid: string; // This is the sha
  };
  author?: PullRequestUser;
  state:
    | 'PENDING'
    | 'COMMENTED'
    | 'APPROVED'
    | 'CHANGES_REQUESTED'
    | 'DISMISSED';
  submittedAt?: string;
  updatedAt: string;
  url: string;
}

export interface PullRequest extends Node {
  id: string;
  additions: number;
  author?: PullRequestUser;
  authorAssociation: string;
  baseRefName: string;
  baseRefOid: string;
  baseRepository: {
    name: string;
    owner: repositoryOwner;
  };
  body?: string;
  changedFiles: number;
  checksUrl: string;
  closed: boolean;
  closedAt?: string;
  createdAt: string;
  databaseId?: string;
  deletions: number;
  editor?: PullRequestUser;
  headRefName: string;
  headRefOid: string;
  headRepository: {
    name: string;
    owner: repositoryOwner;
  };
  isDraft: boolean;
  lastEditedAt?: string;
  locked: boolean;
  mergeCommit?: Commit;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  merged: boolean;
  mergedAt?: string;
  mergedBy?: PullRequestUser;
  number: number;
  permalink: string;
  publishedAt?: string;
  reviewDecision?: 'CHANGES_REQUESTED' | 'APPROVED' | 'REVIEW_REQUIRED';
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  title: string;
  updatedAt: string;
  url: string;
  // Optional extra traversals
  commits?: Commit[];
  labels?: Label[];
  reviews?: Review[];
}

export interface Issue extends Node {
  id: string;
  activeLockReason: string;
  author: {
    name: string;
    login: string;
  };
  authorAssociation: string;
  body: string;
  bodyText: string;
  closed: boolean;
  closedAt: string;
  createdAt: string;
  createdViaEmail: boolean;
  databaseId: string;
  isPinned: boolean;
  lastEditedAt: string;
  locked: boolean;
  number: number;
  publishedAt: string;
  resourcePath: string;
  state: string;
  title: string;
  titleHTML: string;
  updatedAt: string;
  url: string;
  assignees?: Actor[];
  labels?: Label[];
}

export interface Collaborator extends Node {
  permission: string;
  login: string;
  name: string;
  repository: string;
}

export interface GithubSearchResources {
  [GithubResource.Issues]: Issue[];
  [GithubResource.PullRequests]: PullRequest[];
  [GithubResource.PullRequest]: PullRequest;
  [GithubResource.Commits]: PullRequestCommitQueryResponse[];
  [GithubResource.Labels]: Label[];
  [GithubResource.Reviews]: Review[];
  [GithubResource.Assignees]: Actor[];
  [GithubResource.Collaborators]: Collaborator[];
  [GithubResource.DependencyGraphManifests]: any[];
  [GithubResource.Dependencies]: any[];
}

export type GithubQueryResponse = {
  rateLimitConsumed: number;
} & Partial<GithubOrganizationResources> &
  Partial<GithubSearchResources>;

export type RefreshTokenResponse = {
  token: string;
  expiresAt: string;
};
