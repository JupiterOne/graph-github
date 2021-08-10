export enum OrganizationResource {
  Organization = 'organization',
  Members = 'members',
  Teams = 'teams',
  TeamMembers = 'teamMembers',
  TeamRepositories = 'teamRepositories',
  Repositories = 'repositories',
  RepositoryCollaborators = 'repositoryCollaborators',
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

interface Node {
  id: string;
}

interface Actor {
  name?: string;
  login: string;
}

export type OrgQueryResponse = Node & Actor;

export interface OrgCollaboratorQueryResponse extends Node, Actor {
  permissions: CollaboratorPermissions;
  node_id: string; //this matches a member's id, whereas the id here is unique to the collab
}

export interface CollaboratorPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface OrgMemberQueryResponse extends Node, Actor {
  hasTwoFactorEnabled: boolean;
  role: OrgMemberRole;
  isSiteAdmin: boolean;
}

export interface OrgTeamQueryResponse extends Node {
  url: string;
  slug: string;
  name: string;
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
  collaborators: OrgCollaboratorQueryResponse[];
}

export type OrganizationResourcesQueryResponse = {
  rateLimitConsumed: number;
} & Partial<OrganizationResources>;
