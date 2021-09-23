import { RepoKeyAndName, TokenPermissions } from '../../../types';

export interface RepoCollaboratorQueryResponse {
  id: number;
  name?: string | null;
  login: string;
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

export interface RepoIssueQueryResponse {
  id: number;
  node_id: string;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  number: number;
  state: string; // such as "open"
  title: string;
  body?: string | undefined;
  user: IssueActor | null;
  labels: IssueLabel[];
  assignee: IssueActor | null;
  assignees?: IssueActor[] | null | undefined;
  milestone: IssueMilestone | null;
  locked: boolean;
  active_lock_reason: string;
  comments: number;
  pull_request: IssuePullRequest;
  closed_at: string;
  created_at: string;
  updated_at: string;
  author_association: string;
}

interface IssueActor {
  login: string;
  id: number;
  node_id: string;
  type: string;
  site_admin: boolean;
  name?: string | null | undefined;
}

interface IssueLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

interface IssueMilestone {
  url: string;
  html_url: string;
  labels_url: string;
  id: number;
  node_id: string;
  number: number;
  state: string;
  title: string;
  description: string | null;
  creator: IssueActor | null | undefined;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  updated_at: string;
  closed_at: string;
  starred_at?: string;
  due_on?: string;
}

interface IssuePullRequest {
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
}

export interface OrgSecretRepoQueryResponse {
  //the repos that have been granted permission to an org secret
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

export interface OrgAppQueryResponse {
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

export interface SecretQueryResponse {
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
  id: string;
  node_id: string;
  name: string;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  protection_rules: ProtectionRule[];
  deployment_branch_policy: {
    //sometimes null object
    protected_branches: boolean;
    custom_branch_policies: boolean;
  };
  //the following property is set by the integration code from another API call, not received from the Environments REST API
  envSecrets?: SecretQueryResponse[];
}

interface ProtectionRule {
  id: string;
  node_id: string;
  type: string; // examples include 'branch_policy', 'required_reviewers', or 'wait_timer'. Existence of other props depends on this.
  wait_timer?: number;
  reviewers?: object[]; //could be users or teams, but not all props found in OrgMemberQueryResponse or OrgTeamQueryResponse
}
