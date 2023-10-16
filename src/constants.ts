import {
  RelationshipClass,
  StepEntityMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

//these constants are names used to save and retrieve data between steps
//they are constants instead of strings so that TypeScript will detect spelling errors
export const GITHUB_MEMBER_BY_LOGIN_MAP = 'GITHUB_MEMBER_BY_LOGIN_MAP';
export const GITHUB_OUTSIDE_COLLABORATOR_ARRAY =
  'GITHUB_OUTSIDE_COLLABORATOR_ARRAY';
export const GITHUB_REPO_TAGS_ARRAY = 'GITHUB_REPO_TAGS_ARRAY';
export const GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP =
  'GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP';
export const GITHUB_APP_BY_APP_ID = 'GITHUB_APP_BY_APP_ID';

export const Steps = {
  FETCH_ACCOUNT: 'fetch-account',
  FETCH_APPS: 'fetch-apps',
  FETCH_BRANCH_PROTECTION_RULES: 'fetch-branch-protection-rules',
  FETCH_CODE_SCANNING_ALERTS: 'fetch-code-scanning-alerts',
  FETCH_COLLABORATORS: 'fetch-collaborators',
  FETCH_ENVIRONMENTS: 'fetch-environments',
  FETCH_ENV_SECRETS: 'fetch-env-secrets',
  FETCH_ISSUES: 'fetch-issues',
  FETCH_USERS: 'fetch-users',
  FETCH_ORG_SECRETS: 'fetch-org-secrets',
  FETCH_PRS: 'fetch-prs',
  FETCH_REPOS: 'fetch-repos',
  FETCH_REPO_SECRETS: 'fetch-repo-secrets',
  FETCH_TEAM_MEMBERS: 'fetch-team-members',
  FETCH_TEAM_REPOS: 'fetch-team-repos',
  FETCH_TEAMS: 'fetch-teams',
  FETCH_VULNERABILITY_ALERTS: 'fetch-vulnerability-alerts',
};

export const IngestionSources = {
  APPS: 'apps',
  BRANCH_PROTECTION_RULES: 'branch-protection-rules',
  CODE_SCANNING_ALERTS: 'code-scanning-alerts',
  ENVIRONMENTS: 'environments',
  ENV_SECRETS: 'env-secrets',
  ISSUES: 'issues',
  ORG_SECRETS: 'org-secrets',
  REPO_SECRETS: 'repo-secrets',
  VULNERABILITY_ALERTS: 'vulnerability-alerts',
  PRS: 'prs',
};

export const GithubEntities: Record<
  | 'GITHUB_ACCOUNT'
  | 'GITHUB_APP'
  | 'GITHUB_BRANCH_PROTECTION_RULE'
  | 'GITHUB_COLLABORATOR'
  | 'GITHUB_ENV_SECRET'
  | 'GITHUB_ENVIRONMENT'
  | 'GITHUB_ISSUE'
  | 'GITHUB_MEMBER'
  | 'GITHUB_ORG_SECRET'
  | 'GITHUB_PR'
  | 'GITHUB_REPO'
  | 'GITHUB_REPO_SECRET'
  | 'GITHUB_TEAM'
  | 'GITHUB_CODE_SCANNING_ALERT'
  | 'GITHUB_VULNERABILITY_ALERT'
  | 'CVE'
  | 'CWE',
  StepEntityMetadata
> = {
  GITHUB_ACCOUNT: {
    resourceName: 'Account',
    _type: 'github_account',
    _class: ['Account'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_account' },
        accountType: { type: 'string' },
        accountId: { type: 'string' },
        login: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['accountId'],
    },
  },
  GITHUB_APP: {
    resourceName: 'Github App',
    _type: 'github_app',
    _class: ['Application'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_app' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        webLink: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name', 'displayName', 'webLink', 'createdOn'],
    },
  },
  GITHUB_BRANCH_PROTECTION_RULE: {
    resourceName: 'Github Branch Protection Rule',
    _type: 'github_branch_protection_rule',
    _class: ['Rule'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_branch_protection_rule' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name', 'displayName'],
    },
  },
  GITHUB_COLLABORATOR: {
    resourceName: 'GitHub Outside Collaborator',
    _type: 'github_user',
    _class: ['User'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_user' },
        username: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['username', 'displayName'],
    },
  },
  GITHUB_ENV_SECRET: {
    resourceName: 'GitHub Env Secret',
    _type: 'github_env_secret',
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_env_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  },
  GITHUB_ENVIRONMENT: {
    resourceName: 'Github Environment',
    _type: 'github_environment',
    _class: ['Configuration'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_environment' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        webLink: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name', 'displayName', 'webLink', 'createdOn'],
    },
  },
  GITHUB_ISSUE: {
    resourceName: 'Github Issue',
    _type: 'github_issue',
    _class: ['Issue'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_issue' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  },
  GITHUB_MEMBER: {
    resourceName: 'Github User',
    _type: 'github_user',
    _class: ['User'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_user' },
        username: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['username', 'displayName'],
    },
  },
  GITHUB_ORG_SECRET: {
    resourceName: 'Github Org Secret',
    _type: 'github_org_secret',
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_org_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  },
  GITHUB_PR: {
    resourceName: 'Github Pull Request',
    _type: 'github_pullrequest',
    _class: ['PR'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_pullrequest' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  },
  GITHUB_REPO: {
    resourceName: 'Github Repo',
    _type: 'github_repo',
    _class: ['CodeRepo'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_repo' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  },
  GITHUB_REPO_SECRET: {
    resourceName: 'Github Repo Secret',
    _type: 'github_repo_secret',
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_repo_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  },
  GITHUB_TEAM: {
    resourceName: 'Github Team',
    _type: 'github_team',
    _class: ['UserGroup'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_team' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  },
  GITHUB_CODE_SCANNING_ALERT: {
    resourceName: 'GitHub Code Scanning Alerts',
    _type: 'github_code_scanning_finding',
    _class: ['Finding'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_code_scanning_finding' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        severity: { type: 'string' },
        priority: { type: 'string' },
        category: { const: 'application' },
        state: { type: 'string' },
        webLink: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: [
        'severity',
        'state',
        'displayName',
        'category',
        'name',
        'weblink',
        'createdOn',
      ],
    },
  },
  GITHUB_VULNERABILITY_ALERT: {
    resourceName: 'GitHub Vulnerability Alert',
    _type: 'github_finding',
    _class: ['Finding'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_finding' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        category: { const: 'application' },
        severity: { type: 'string' },
        numericSeverity: { type: 'number' },
        open: { type: 'boolean' },
        webLink: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: [
        'category',
        'severity',
        'numericSeverity',
        'open',
        'displayName',
        'name',
        'weblink',
        'createdOn',
      ],
    },
  },
  CVE: {
    resourceName: 'CVE',
    _type: 'cve',
    _class: 'Vulnerability',
    schema: {
      properties: {
        name: { type: 'string' },
        displayName: { type: 'string' },
        cvssScore: { type: 'string' },
        references: { type: 'array', items: { type: 'string' } },
        webLink: { type: 'string' },
      },
      required: ['name', 'displayName', 'cvssScore', 'references', 'weblink'],
    },
  },
  CWE: {
    resourceName: 'CWE',
    _type: 'cwe',
    _class: 'Weakness',
    schema: {
      properties: {
        name: { type: 'string' },
        displayName: { type: 'string' },
        description: { type: 'string' },
        references: { type: 'array', items: { type: 'string' } },
        webLink: { type: 'string' },
      },
      required: ['name', 'displayName', 'description', 'references', 'webLink'],
    },
  },
};

export const Relationships: Record<
  | 'TEAM_HAS_USER'
  | 'USER_MANAGES_TEAM'
  | 'REPO_HAS_PULLREQUEST'
  | 'USER_APPROVED_PULLREQUEST'
  | 'USER_OPENED_PULLREQUEST'
  | 'USER_REVIEWED_PULLREQUEST'
  | 'PULLREQUEST_CONTAINS_PULLREQUEST'
  | 'REPO_HAS_SECRET'
  | 'REPO_USES_SECRET'
  | 'REPO_SECRET_OVERRIDES_ORG_SECRET'
  | 'REPO_HAS_BRANCH_PROTECTION_RULE'
  | 'USER_OVERRIDES_BRANCH_PROTECTION_RULE'
  | 'TEAM_OVERRIDES_BRANCH_PROTECTION_RULE'
  | 'APP_OVERRIDES_BRANCH_PROTECTION_RULE'
  | 'REPO_ALLOWS_TEAM'
  | 'REPO_ALLOWS_USER'
  | 'REPO_HAS_ISSUE'
  | 'USER_CREATED_ISSUE'
  | 'USER_ASSIGNED_ISSUE'
  | 'ENV_SECRET_OVERRIDES_REPO_SECRET'
  | 'ENV_SECRET_OVERRIDES_ORG_SECRET'
  | 'REPO_USES_ENV_SECRET'
  | 'ENVIRONMENT_HAS_ENV_SECRET'
  | 'REPO_HAS_CODE_SCANNING_FINDING'
  | 'ACCOUNT_HAS_USER'
  | 'USER_MANAGES_ACCOUNT'
  | 'ACCOUNT_HAS_TEAM'
  | 'ACCOUNT_INSTALLED_APP'
  | 'ACCOUNT_OWNS_REPO'
  | 'REPO_HAS_ENVIRONMENT'
  | 'REPO_HAS_FINDING'
  | 'FINDING_IS_CVE'
  | 'FINDING_EXPLOITS_CWE'
  | 'ACCOUNT_HAS_ORG_SECRET'
  | 'REPO_USES_ORG_SECRET'
  | 'ACCOUNT_HAS_ORG_SECRET'
  | 'REPO_USES_ORG_SECRET',
  StepRelationshipMetadata
> = {
  TEAM_HAS_USER: {
    _type: 'github_team_has_user',
    sourceType: GithubEntities.GITHUB_TEAM._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_MEMBER._type,
  },
  USER_MANAGES_TEAM: {
    _type: 'github_user_manages_team',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.MANAGES,
    targetType: GithubEntities.GITHUB_TEAM._type,
  },
  REPO_HAS_PULLREQUEST: {
    _type: 'github_repo_has_pullrequest',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_PR._type,
    partial: true,
  },
  USER_APPROVED_PULLREQUEST: {
    _type: 'github_user_approved_pullrequest',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.APPROVED,
    targetType: GithubEntities.GITHUB_PR._type,
    partial: true,
  },
  USER_OPENED_PULLREQUEST: {
    _type: 'github_user_opened_pullrequest',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.OPENED,
    targetType: GithubEntities.GITHUB_PR._type,
    partial: true,
  },
  USER_REVIEWED_PULLREQUEST: {
    _type: 'github_user_reviewed_pullrequest',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.REVIEWED,
    targetType: GithubEntities.GITHUB_PR._type,
    partial: true,
  },
  PULLREQUEST_CONTAINS_PULLREQUEST: {
    _type: 'github_pullrequest_contains_pullrequest',
    sourceType: GithubEntities.GITHUB_PR._type,
    _class: RelationshipClass.CONTAINS,
    targetType: GithubEntities.GITHUB_PR._type,
  },
  REPO_HAS_SECRET: {
    _type: 'github_repo_has_secret',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_REPO_SECRET._type,
  },
  REPO_USES_SECRET: {
    _type: 'github_repo_uses_secret',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.USES,
    targetType: GithubEntities.GITHUB_REPO_SECRET._type,
  },
  REPO_SECRET_OVERRIDES_ORG_SECRET: {
    _type: 'github_repo_secret_overrides_org_secret',
    sourceType: GithubEntities.GITHUB_REPO_SECRET._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_ORG_SECRET._type,
  },
  REPO_HAS_BRANCH_PROTECTION_RULE: {
    _type: 'github_repo_has_branch_protection_rule',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
  },
  USER_OVERRIDES_BRANCH_PROTECTION_RULE: {
    _type: 'github_user_overrides_branch_protection_rule',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
  },
  TEAM_OVERRIDES_BRANCH_PROTECTION_RULE: {
    _type: 'github_team_overrides_branch_protection_rule',
    sourceType: GithubEntities.GITHUB_TEAM._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
  },
  APP_OVERRIDES_BRANCH_PROTECTION_RULE: {
    _type: 'github_app_overrides_branch_protection_rule',
    sourceType: GithubEntities.GITHUB_APP._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
  },
  REPO_ALLOWS_TEAM: {
    _type: 'github_repo_allows_team',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.ALLOWS,
    targetType: GithubEntities.GITHUB_TEAM._type,
  },
  REPO_ALLOWS_USER: {
    _type: 'github_repo_allows_user',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.ALLOWS,
    targetType: 'github_user',
  },
  REPO_HAS_ISSUE: {
    _type: 'github_repo_has_issue',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_ISSUE._type,
    partial: true,
  },
  USER_CREATED_ISSUE: {
    _type: 'github_user_created_issue',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.CREATED,
    targetType: GithubEntities.GITHUB_ISSUE._type,
    partial: true,
  },
  USER_ASSIGNED_ISSUE: {
    _type: 'github_user_assigned_issue',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.ASSIGNED,
    targetType: GithubEntities.GITHUB_ISSUE._type,
    partial: true,
  },
  ENVIRONMENT_HAS_ENV_SECRET: {
    _type: 'github_environment_has_env_secret',
    sourceType: GithubEntities.GITHUB_ENVIRONMENT._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_ENV_SECRET._type,
  },
  REPO_USES_ENV_SECRET: {
    _type: 'github_repo_uses_env_secret',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.USES,
    targetType: GithubEntities.GITHUB_ENV_SECRET._type,
  },
  ENV_SECRET_OVERRIDES_ORG_SECRET: {
    _type: 'github_env_secret_overrides_org_secret',
    sourceType: GithubEntities.GITHUB_ENV_SECRET._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_ORG_SECRET._type,
  },
  ENV_SECRET_OVERRIDES_REPO_SECRET: {
    _type: 'github_env_secret_overrides_repo_secret',
    sourceType: GithubEntities.GITHUB_ENV_SECRET._type,
    _class: RelationshipClass.OVERRIDES,
    targetType: GithubEntities.GITHUB_REPO_SECRET._type,
  },
  REPO_HAS_CODE_SCANNING_FINDING: {
    _type: 'github_repo_has_code_scanning_finding',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_CODE_SCANNING_ALERT._type,
  },
  ACCOUNT_HAS_USER: {
    _type: 'github_account_has_user',
    sourceType: GithubEntities.GITHUB_ACCOUNT._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_MEMBER._type,
  },
  USER_MANAGES_ACCOUNT: {
    _type: 'github_user_manages_account',
    sourceType: GithubEntities.GITHUB_MEMBER._type,
    _class: RelationshipClass.MANAGES,
    targetType: GithubEntities.GITHUB_ACCOUNT._type,
  },
  ACCOUNT_HAS_TEAM: {
    _type: 'github_account_has_team',
    sourceType: GithubEntities.GITHUB_ACCOUNT._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_TEAM._type,
  },
  ACCOUNT_INSTALLED_APP: {
    _type: 'github_account_installed_app',
    sourceType: GithubEntities.GITHUB_ACCOUNT._type,
    _class: RelationshipClass.INSTALLED,
    targetType: GithubEntities.GITHUB_APP._type,
  },
  ACCOUNT_OWNS_REPO: {
    _type: 'github_account_owns_repo',
    sourceType: GithubEntities.GITHUB_ACCOUNT._type,
    _class: RelationshipClass.OWNS,
    targetType: GithubEntities.GITHUB_REPO._type,
  },
  REPO_HAS_ENVIRONMENT: {
    _type: 'github_repo_has_environment',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_ENVIRONMENT._type,
  },
  REPO_HAS_FINDING: {
    _type: 'github_repo_has_finding',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_VULNERABILITY_ALERT._type,
  },
  FINDING_IS_CVE: {
    _type: 'github_finding_is_cve',
    sourceType: GithubEntities.GITHUB_VULNERABILITY_ALERT._type,
    _class: RelationshipClass.IS,
    targetType: GithubEntities.CVE._type,
  },
  FINDING_EXPLOITS_CWE: {
    _type: 'github_finding_exploits_cwe',
    sourceType: GithubEntities.GITHUB_VULNERABILITY_ALERT._type,
    _class: RelationshipClass.EXPLOITS,
    targetType: GithubEntities.CWE._type,
  },
  ACCOUNT_HAS_ORG_SECRET: {
    _type: 'github_account_has_org_secret',
    sourceType: GithubEntities.GITHUB_ACCOUNT._type,
    _class: RelationshipClass.HAS,
    targetType: GithubEntities.GITHUB_ORG_SECRET._type,
  },
  REPO_USES_ORG_SECRET: {
    _type: 'github_repo_uses_org_secret',
    sourceType: GithubEntities.GITHUB_REPO._type,
    _class: RelationshipClass.USES,
    targetType: GithubEntities.GITHUB_ORG_SECRET._type,
  },
};
