import { AccountType } from '.';
import {
  Entity,
  Relationship,
  ExplicitRelationship
} from '@jupiterone/integration-sdk-core';

//to simplify diffs:
export interface EntityFromIntegration extends Entity {}

export interface AccountEntity extends EntityFromIntegration {
  accountType: AccountType;
  accountId: string;
  login: string;
  name: string;
}

export type AccountRepoRelationship = Relationship

export type OrganizationMemberRelationship = Relationship

export type OrganizationTeamRelationship = Relationship

export interface TeamEntity extends EntityFromIntegration {
  name: string;
  displayName: string;
  full_name: string;
}

export type TeamMemberRelationship = Relationship

export interface TeamRepoRelationship extends ExplicitRelationship {
  permission: string;
}

export interface RepoEntity extends EntityFromIntegration {
  public: boolean;
  name: string;
  fullName: string;
  owner: string;
  archived: boolean | undefined;
  createdOn: number | undefined;
  updatedOn: number | undefined;
}

export type RepoPullRequestRelationship = Relationship

export interface UserEntity extends EntityFromIntegration {
  username: string;
  login: string;
  role: string;
  mfaEnabled?: boolean;
  siteAdmin?: boolean;
}

export type UserPullRequestRelationship = Relationship

export interface PullRequestEntity extends EntityFromIntegration {
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
