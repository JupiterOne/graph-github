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
  databaseId?: number;
  verified?: boolean;
  location?: string;
  websiteUrl?: string;
  webLink?: string;
}

export interface AppEntity extends Entity {
  name: string;
  displayName: string;
  webLink: string;
  installationId: string; //the installation id
  appId: number;
  appSlug: string; //a name for the app
  targetId: number;
  targetType: string; // typically "Organization"
  createdOn: number | undefined;
  updatedOn: number | undefined;
  events: string[];
  repositorySelection: string;
  singleFileName: string;
  hasMultipleSingleFiles: boolean;
  singleFilePaths: string[];
  // NOTE: This is an object (a User), and we cannot upload objects. We should
  // actually build a relationship between the GitHub user and the application.
  // See: https://github.com/google/go-github/blob/master/github/apps.go#L118
  // suspendedBy: string;
  suspendedOn: number | undefined;
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
  // parent properties used in creating environmental secret entities
  parentRepoName: string;
  parentRepoKey: string;
  parentRepoDatabaseId: string;
}

export interface TeamEntity extends Entity {
  name: string;
  displayName: string;
  fullName: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  databaseId: number;
  description: string;
  node: string;
  privacy: string;
  webLink: string;
}

export interface BranchProtectionRuleEntity extends Entity {
  name: string;
  displayName: string;
  blockCreations: boolean;
  allowDeletions: boolean;
  allowForcePushes: boolean;
  requiredLinearHistory: boolean;
  enforceAdmins: boolean;
  requiredSignatures: boolean;
  requiredApprovingReviewCount: number;
  requireCodeOwnerReviews: boolean;
  requiredStatusChecks: Array<string> | undefined;
  bypassPullRequestAllowances: Array<string> | undefined;
  requiredConversationResolution: boolean;
}

export interface CodeScanningFindingEntity extends Entity {
  name: string;
  displayName: string;
  summary: string;
  status: string;
  severity: string;
  priority: string;
  state: string;
  weblink: string;
  createdOn: number | undefined;
  dismissedOn?: number | null;
  dismissedReason?: string;
  dismissedComment?: string;
  fixedOn?: number | null;
  toolName: string;
  toolVersion?: string;
}

export interface SecretScanningFindingEntity extends Entity {
  number?: number;
  url?: string;
  state?: 'open' | 'resolved';
  resolution?:
    | 'false_positive'
    | 'wont_fix'
    | 'revoked'
    | 'used_in_tests'
    | null;
  secretType?: string;
  secretTypeDisplayName?: string;
  secret?: string;
  resolvedBy?: string | null;
  resolvedOn?: number;
  resolutionComment?: string | null;
  pushProtectionBypassed?: boolean | null;
  pushProtectionBypassedBy?: string;
  pushProtectionBypassedOn?: number;
  createdOn?: number;
  updatedOn?: number;
}

export interface IssueEntity extends Entity {
  name: string;
  displayName: string;
  webLink: string;
  url: string;
  databaseId: string;
  number: number;
  title: string;
  state: string; //"open" | "closed"
  locked: boolean;
  closed: boolean;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  closedOn: number | undefined;
  authorAssociation: string;
  activeLockReason: string;
  body: string | undefined;
  createdViaEmail: boolean;
  pinned: boolean;
  lastEditedOn: number | undefined;
  publishedOn: number | undefined;
  resourcePath: string;
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
  disabled: boolean | undefined;
  empty: boolean | undefined;
  fork: boolean | undefined;
  forkingAllowed: boolean | undefined;
  forkCount: number | undefined;
  inOrganization: boolean | undefined;
  locked: boolean | undefined;
  mirror: boolean | undefined;
  securityPolicyEnabled: boolean | undefined;
  template: boolean | undefined;
  userConfigurationRepository: boolean | undefined;
  lockReason: string;
  mergeCommitAllowed: boolean | undefined;
  rebaseMergeAllowed: boolean | undefined;
  webLink: string;
  hasPages?: boolean | undefined;
  pagesUrl?: string | undefined;
  visibility?: string;
}

//to cut down on memory usage, this type will be passed between steps for relationship building
export interface RepoData {
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
  databaseId?: number;
  email?: string;
  employee?: boolean;
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

export interface VulnerabilityAlertEntity extends Entity {
  id: string;
  name: string;
  displayName: string;
  summary: string;
  category: string;
  status: string;
  severity: string;
  numericSeverity: number;
  priority: string;
  score;
  impact;
  vector;
  recommendation;
  open;
  references;
  public;
  weblink;
  createdOn;
  dismissedOn;
  dismisserLogin;
  dismissReason;
  number;
  databaseId;
  ghsaId;
  origin;
  publishedOn;
  updatedOn;
  withdrawnOn;
  packageName;
  packageEcosystem;
  vulnerableVersionRange;
  vulnerableManifestFilename;
  vulnerableManifestPath;
  vulnerableRequirements;
}
