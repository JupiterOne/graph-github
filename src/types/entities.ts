import { AccountType } from '.';
import { Entity } from '@jupiterone/integration-sdk-core';

export interface AccountEntity extends Entity {
  accountType: AccountType;
  accountId: string;
  login: string;
  name?: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  description?: string;
  email?: string;
  node?: string;
  databaseId?: string;
  isVerified?: boolean;
  location?: string;
  websiteUrl?: string;
  webLink?: string;
}

export interface AppEntity extends Entity {
  name: string;
  displayName: string;
  webLink: string;
  installationId: string; //the installation id
  respositorySelection: string;
  appId: number;
  appSlug: string; //a name for the app
  targetId: number;
  targetType: string; // typically "Organization"
  createdAt: string;
  updatedAt: string;
  events: string[];
  repositorySelection: string;
  singleFileName: string;
  hasMultipleSingleFiles: boolean;
  singleFilePaths: string[];
  // NOTE: This is an object (a User), and we cannot upload objects. We should
  // actually build a relationship between the GitHub user and the application.
  // See: https://github.com/google/go-github/blob/master/github/apps.go#L118
  // suspendedBy: string;
  suspendedAt: string;
  //plus permissions.{fieldname} fields drawn from the permissions API object
  //for example, 'permissions.members', 'permissions.metadata', or 'permissions.organization-administration'
  //for a more complete list of possibilities, see src/types/integration.ts/TokenPermissions
  //note that TokenPermissions with underscores are modified to use dashes instead,
  //in src/util/propertyHelpers.ts/decomposePermissions
}

export interface SecretEntity extends Entity {
  name: string;
  displayName: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  visibility?: string; // 'private' | 'all' | 'selected'. This means which repos can use this secret. 'private' means only private repos.
  selected_repositories_url?: string;
}

export interface EnvironmentEntity extends Entity {
  nodeId: string;
  name: string;
  webLink: string;
  url: string;
  htmlUrl: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  protectionRulesExist: boolean;
}

export interface TeamEntity extends Entity {
  name: string;
  displayName: string;
  fullName: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  databaseId: string;
  description: string;
  node: string;
  privacy: string;
  webLink: string;
}

export interface RepoEntity extends Entity {
  public: boolean;
  name: string;
  fullName: string;
  owner: string;
  archived: boolean | undefined;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  pushedOn: number | undefined;
  autoMergeAllowed: boolean | undefined;
  databaseId: string;
  deleteBranchOnMerge: boolean | undefined;
  description: string;
  homepageUrl: string;
  node: string;
  isDisabled: boolean | undefined;
  isEmpty: boolean | undefined;
  isFork: boolean | undefined;
  isInOrganization: boolean | undefined;
  isLocked: boolean | undefined;
  isMirror: boolean | undefined;
  isSecurityPolicyEnabled: boolean | undefined;
  isTemplate: boolean | undefined;
  isUserConfigurationRepository: boolean | undefined;
  lockReason: string;
  mergeCommitAllowed: boolean | undefined;
  rebaseMergeAllowed: boolean | undefined;
  webLink: string;
}

//to cut down on memory usage, this type will be passed between steps for relationship building
export interface RepoKeyAndName {
  _key: string; // an alphanumeric, used for most repo indexing
  name: string; // a string, used for some REST API calls
  databaseId: string; // typically an integer, used to retrieve env secrets REST API call
}

export interface UserEntity extends Entity {
  username: string;
  login: string;
  role: string;
  node: string;
  mfaEnabled?: boolean;
  siteAdmin?: boolean;
  company?: string;
  createdOn?: number | undefined;
  updatedOn?: number | undefined;
  databaseId?: string;
  email?: string;
  isEmployee?: boolean;
  location?: string;
  websiteUrl?: string;
}

export interface PullRequestEntity extends Entity {
  accountLogin: string;
  repository: string;
  id: string;

  name: string;
  title: string;
  summary?: string;
  databaseId?: string;
  description?: string;
  webLink?: string;

  state: string;
  open: boolean;
  merged: boolean;
  node?: string;
  declined: boolean;
  approved?: boolean;
  validated?: boolean;

  commits?: string[];
  commitMessages?: string[];
  commitsApproved?: string[];
  commitsNotApproved?: string[];
  commitsByUnknownAuthor?: string[];

  source: string;
  target: string;

  createdOn?: number;
  updatedOn?: number;

  authorLogin: string;
  author: string;
  reviewerLogins: string[];
  reviewers: string[];
  approverLogins?: string[];
  approvers?: string[];
}
