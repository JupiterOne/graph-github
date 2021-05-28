export enum OrganizationResource {
  Organization = 'organization',
  Members = 'members',
  Teams = 'teams',
  TeamMembers = 'teamMembers',
  TeamRepositories = 'teamRepositories',
  Repositories = 'repositories'
}

export enum OrgMemberRole {
  Admin = 'ADMIN',
  Member = 'MEMBER'
}

export enum TeamMemberRole {
  Maintainer = 'MAINTAINER',
  Member = 'MEMBER'
}

export enum TeamRepositoryPermission {
  Admin = 'ADMIN',
  Maintain = 'MAINTAIN',
  Read = 'READ',
  Triage = 'TRIAGE',
  Write = 'WRITE'
}

interface Node {
  id: string;
}

interface Actor {
  login: string;
  name: string;
}

export type OrgQueryResponse = Node & Actor;

export interface OrgMemberQueryResponse extends Node, Actor {
  hasTwoFactorEnabled: boolean;
  role: OrgMemberRole;
  isSiteAdmin: boolean;
}

export interface OrgTeamQueryResponse extends Node {
  url: string;
  slug: string;
  name: string;
}

export interface OrgTeamMemberQueryResponse extends Node {
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
}

export interface OrgTeamRepoQueryResponse extends OrgRepoQueryResponse {
  teams: string;
  permission: TeamRepositoryPermission;
}

interface OrganizationResources {
  organization: OrgQueryResponse[];
  members: OrgMemberQueryResponse[];
  teams: OrgTeamQueryResponse[];
  teamMembers: OrgTeamMemberQueryResponse[];
  teamRepositories: OrgTeamRepoQueryResponse[];
  repositories: OrgRepoQueryResponse[];
}

export type OrganizationResourcesQueryResponse = {
  rateLimitConsumed: number;
} & Partial<OrganizationResources>;
