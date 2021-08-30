import { AccountType } from '.';
import { Entity } from '@jupiterone/integration-sdk-core';

export interface AccountEntity extends Entity {
  accountType: AccountType;
  accountId: string;
  login: string;
  name?: string | null;
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
  suspendedBy: string;
  suspendedAt: string;
  //plus permissions.{fieldname} fields drawn from the permissions API object
  //for example, 'permissions.members', 'permissions.metadata', or 'permissions.organization-administration'
  //for a more complete list of possibilities, see src/types/integration.ts/TokenPermissions
  //note that TokenPermissions with underscores are modified to use dashes instead,
  //in src/util/propertyHelpers.ts/decomposePermissions
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
