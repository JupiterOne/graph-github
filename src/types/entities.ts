import { AccountType } from '.';
import { Entity } from '@jupiterone/integration-sdk-core';

export interface AccountEntity extends Entity {
  accountType: AccountType;
  accountId: string;
  login: string;
  name?: string;
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
  createdAt: string;
  updatedAt: string;
  visibility?: string; // 'private' | 'all' | 'selected'. This means which repos can use this secret. 'private' means only private repos.
  selected_repositories_url?: string;
}

export interface TeamEntity extends Entity {
  name: string;
  displayName: string;
  fullName: string;
}

export interface RepoEntity extends Entity {
  public: boolean;
  name: string;
  fullName: string;
  owner: string;
  archived: boolean | undefined;
  createdOn: number | undefined;
  updatedOn: number | undefined;
}

//to cut down on memory usage, this type will be passed between steps for relationship building
export interface RepoKeyAndName {
  _key: string;
  name: string;
}

export interface UserEntity extends Entity {
  username: string;
  login: string;
  role: string;
  mfaEnabled?: boolean;
  siteAdmin?: boolean;
}

export interface PullRequestEntity extends Entity {
  accountLogin: string;
  repository: string;
  id: string;

  name: string;
  title: string;
  summary?: string;
  description?: string;
  webLink?: string;

  state: string;
  open: boolean;
  merged: boolean;
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
