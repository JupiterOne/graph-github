export const GITHUB_ACCOUNT_ENTITY_TYPE = 'github_account';
export const GITHUB_ACCOUNT_ENTITY_CLASS = 'Account';
export const GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE =
  'github_account_has_user';
export const GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE = 'github_account_has_team';
export const GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE = 'github_account_owns_repo';

export const GITHUB_MEMBER_ENTITY_TYPE = 'github_user';
export const GITHUB_MEMBER_ENTITY_CLASS = 'User';
export const GITHUB_COLLABORATOR_ENTITY_TYPE = 'github_collaborator';
export const GITHUB_COLLABORATOR_ENTITY_CLASS = 'User';
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
export const GITHUB_REPO_ENTITY_CLASS = 'CodeRepo';
export const GITHUB_REPO_PR_RELATIONSHIP_TYPE = 'github_repo_has_pullrequest';

export const GITHUB_PR_ENTITY_TYPE = 'github_pullrequest';
export const GITHUB_PR_ENTITY_CLASS = 'PR';

export const GITHUB_TEAM_ENTITY_TYPE = 'github_team';
export const GITHUB_TEAM_ENTITY_CLASS = 'UserGroup';
export const GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE = 'github_team_has_user';
export const GITHUB_REPO_TEAM_RELATIONSHIP_TYPE = 'github_repo_allows_team';
export const GITHUB_REPO_USER_RELATIONSHIP_TYPE = 'github_repo_allows_user';
