//core entities
export const GITHUB_ACCOUNT_ENTITY_TYPE = 'github_account';
export const GITHUB_ACCOUNT_ENTITY_CLASS = ['Account'];
export const GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE =
  'github_account_has_user';
export const GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE = 'github_account_has_team';
export const GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE = 'github_account_owns_repo';

export const GITHUB_MEMBER_ENTITY_TYPE = 'github_user';
export const GITHUB_MEMBER_ENTITY_CLASS = ['User'];
export const GITHUB_COLLABORATOR_ENTITY_TYPE = 'github_user';
export const GITHUB_COLLABORATOR_ENTITY_CLASS = ['User'];
export const GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE =
  'github_user_manages_account';
export const GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE = 'github_user_manages_team';
export const GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE =
  'github_user_reviewed_pullrequest';
export const GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE =
  'github_user_approved_pullrequest';
export const GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE =
  'github_user_opened_pullrequest';

export const GITHUB_REPO_ENTITY_TYPE = 'github_repo';
export const GITHUB_REPO_ENTITY_CLASS = ['CodeRepo'];
export const GITHUB_REPO_PR_RELATIONSHIP_TYPE = 'github_repo_has_pullrequest';

export const GITHUB_PR_ENTITY_TYPE = 'github_pullrequest';
export const GITHUB_PR_ENTITY_CLASS = ['PR'];

export const GITHUB_TEAM_ENTITY_TYPE = 'github_team';
export const GITHUB_TEAM_ENTITY_CLASS = ['UserGroup'];
export const GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE = 'github_team_has_user';
export const GITHUB_REPO_TEAM_RELATIONSHIP_TYPE = 'github_repo_allows_team';
export const GITHUB_REPO_USER_RELATIONSHIP_TYPE = 'github_repo_allows_user';

//apps
export const GITHUB_APP_ENTITY_TYPE = 'github_app';
export const GITHUB_APP_ENTITY_CLASS = ['Application'];
export const GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE =
  'github_account_installed_app';

//secrets and environments
export const GITHUB_ORG_SECRET_ENTITY_TYPE = 'github_org_secret';
export const GITHUB_REPO_SECRET_ENTITY_TYPE = 'github_repo_secret';
export const GITHUB_ENV_SECRET_ENTITY_TYPE = 'github_env_secret';
export const GITHUB_SECRET_ENTITY_CLASS = ['Secret'];
export const GITHUB_ENVIRONMENT_ENTITY_TYPE = 'github_environment';
export const GITHUB_ENVIRONMENT_ENTITY_CLASS = ['Configuration'];
//org secrets
export const GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE =
  'github_account_has_org_secret';
export const GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE =
  'github_repo_uses_org_secret';
//repo secrets
export const GITHUB_REPO_SECRET_RELATIONSHIP_TYPE = 'github_repo_has_secret'; //apparently `github_repo HAS github_repo_secret` reduces to 'github_repo_has_secret' and not 'github_repo_has_repo_secret'
export const GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE =
  'github_repo_uses_secret'; //see 'github_repo_has_secret'
export const GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE =
  'github_repo_secret_overrides_org_secret';
//environments and env secrets
export const GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE =
  'github_repo_has_environment';
export const GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE =
  'github_environment_has_env_secret';
export const GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE =
  'github_repo_uses_env_secret';
export const GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE =
  'github_env_secret_overrides_org_secret';
export const GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE =
  'github_env_secret_overrides_repo_secret';

//issues
export const GITHUB_ISSUE_ENTITY_TYPE = 'github_issue';
export const GITHUB_ISSUE_ENTITY_CLASS = ['Issue'];
export const GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE = 'github_repo_has_issue';
export const GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE =
  'github_user_created_issue';
export const GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE =
  'github_user_assigned_issue';

//these constants are names used to save and retrieve data between steps
//they are constants instead of strings so that TypeScript will detect spelling errors
export const GITHUB_MEMBER_BY_LOGIN_MAP = 'GITHUB_MEMBER_BY_LOGIN_MAP';
export const GITHUB_OUTSIDE_COLLABORATOR_ARRAY =
  'GITHUB_OUTSIDE_COLLABORATOR_ARRAY';
export const GITHUB_REPO_TAGS_ARRAY = 'GITHUB_REPO_TAGS_ARRAY';
export const GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP =
  'GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP';
