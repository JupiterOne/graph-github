import { TokenPermissions } from '../../../types';

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

export interface OrgAppQueryResponse {
  //a REST response, not GraphQL, but everything else is in this file
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
