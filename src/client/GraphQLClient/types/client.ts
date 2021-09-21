import { RepoKeyAndName, TokenPermissions } from '../../../types';

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
  PullRequests = 'pullRequests',
  PullRequest = 'pullRequest',
  Commits = 'commits',
  Labels = 'labels',
  Reviews = 'reviews',
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
export interface OrgCollaboratorQueryResponse extends Actor {
  //choosing not to extend Node here because the REST call that retrieves Collaborators insists that `id` is a number
  id: number;
  permissions?: CollaboratorPermissions | undefined;
  node_id: string; //Collaborator `node_id` matches a User `id`, whereas Collaborator `id` is just a unique index for the Collaborator object
}

export interface CollaboratorPermissions {
  admin: boolean;
  maintain?: boolean;
  push: boolean;
  triage?: boolean;
  pull: boolean;
}

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
  members?: OrgTeamMemberQueryResponse[];
  repos?: OrgTeamRepoQueryResponse[];
}

export interface OrgTeamMemberQueryResponse extends Node {
  name?: string;
  login: string;
  teams: string;
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

export interface OrgSecretRepoQueryResponse {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner?: object | null;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
}

export interface OrgTeamRepoQueryResponse extends OrgRepoQueryResponse {
  teams: string;
  permission: TeamRepositoryPermission;
}

export interface OrgAppQueryResponse {
  //a REST response, not GraphQL
  id: string; //the installation id
  respository_selection: string;
  html_url: string;
  app_id: number;
  app_slug: string; //a name for the app
  target_id: number;
  target_type: string; // typically "Organization"
  permissions: TokenPermissions;
  created_at: string;
  updated_at: string;
  events: string[];
  repository_selection: string; // 'all' || 'selected'  It doesn't actually list which are selected.
  single_file_name: string;
  has_multiple_single_files: boolean;
  single_file_paths: string[];
  suspended_by: string;
  suspended_at: string;
}

export interface OrgSecretQueryResponse {
  //a REST response, not GraphQL
  name: string;
  created_at: string;
  updated_at: string;
  visibility?: string; // 'private' | 'all' | 'selected'. This means how many repos can use this secret
  selected_repositories_url?: string; //a webpage url, not a REST API url
  //the following properties are set by the integration code, not received from the REST API
  orgLogin?: string; //for use in constructing weblinks
  secretOwnerType?: string; // 'org' | 'repo' | 'env'
  secretOwnerName?: string;
  repos?: RepoKeyAndName[]; //to help build relationships with minimal memory footprint, using RepoKeyAndName instead of RepoEntity
}

export interface RepoEnvironmentQueryResponse {
  //a REST response, not GraphQL
  id: string;
  node_id: string;
  name: string;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  protection_rules: ProtectionRule[];
  deployment_branch_policy: {
    protected_branches: boolean;
    custom_branch_policies: boolean;
  };
  //the following property is set by the integration code from another API call, not received from the Environments REST API
  envSecrets?: OrgSecretQueryResponse[];
}

interface ProtectionRule {
  id: string;
  node_id: string;
  type: string; // examples include 'branch_policy', 'required_reviewers', or 'wait_timer'. Existence of other props depends on this.
  wait_timer?: number;
  reviewers?: object[]; //could be users or teams, but not all props found in OrgMemberQueryResponse or OrgTeamQueryResponse
}

interface GithubResources {
  [GithubResource.Organization]: OrgQueryResponse[];
  [GithubResource.OrganizationMembers]: OrgMemberQueryResponse[];
  [GithubResource.Teams]: OrgTeamQueryResponse[];
  [GithubResource.TeamMembers]: OrgTeamMemberQueryResponse[];
  [GithubResource.TeamRepositories]: OrgTeamRepoQueryResponse[];
  [GithubResource.Repositories]: OrgRepoQueryResponse[];
  // [GithubResource. RepositoryCollaborators]: OrgCollaboratorQueryResponse[];
}

export type GithubResourcesQueryResponse = {
  rateLimitConsumed: number;
} & Partial<GithubResources>;

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

interface GithubResources {
  [GithubResource.PullRequests]: PullRequest[];
  [GithubResource.Commits]: PullRequestCommitQueryResponse[];
  [GithubResource.Labels]: Label[];
  [GithubResource.Reviews]: Review[];
}

export type PullRequestQueryResponse = {
  rateLimitConsumed: number;
} & Partial<GithubResources>;
