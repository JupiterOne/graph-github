export const GithubEntities = {
  GITHUB_ACCOUNT: {
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

  GITHUB_BRANCH_PROTECITON_RULE: {
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
  GITHUB_VULNERABILITY_ALERT: {
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

export const GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE =
  'github_account_has_user';
export const GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE = 'github_account_has_team';
export const GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE = 'github_account_owns_repo';
export const GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE =
  'github_user_manages_account';
export const GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE = 'github_user_manages_team';
export const GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE =
  'github_user_reviewed_pullrequest';
export const GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE =
  'github_user_approved_pullrequest';
export const GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE =
  'github_user_opened_pullrequest';
export const GITHUB_REPO_PR_RELATIONSHIP_TYPE = 'github_repo_has_pullrequest';
export const GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE = 'github_team_has_user';
export const GITHUB_REPO_TEAM_RELATIONSHIP_TYPE = 'github_repo_allows_team';
export const GITHUB_REPO_USER_RELATIONSHIP_TYPE = 'github_repo_allows_user';
export const GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE =
  'github_account_installed_app';

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
export const GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE = 'github_repo_has_issue';
export const GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE =
  'github_user_created_issue';
export const GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE =
  'github_user_assigned_issue';

// vuln alerts
export const GITHUB_REPO_FINDING_RELATIONSHIP_TYPE = 'github_repo_has_finding';
export const GITHUB_FINDING_CVE_RELATIONSHIP_TYPE = 'github_finding_is_cve';
export const GITHUB_FINDING_CWE_RELATIONSHIP_TYPE =
  'github_finding_exploits_cwe';

//branch protection rules
export const GITHUB_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE =
  'github_repo_has_branch_protection_rule';
export const GITHUB_BRANCH_PROTECTION_RULE_MEMBER_OVERRIDE_TYPE =
  'github_user_overrides_branch_protection_rule';
export const GITHUB_BRANCH_PROTECTION_RULE_TEAM_OVERRIDE_TYPE =
  'github_team_overrides_branch_protection_rule';
export const GITHUB_BRANCH_PROTECTION_RULE_APP_OVERRIDE_TYPE =
  'github_app_overrides_branch_protection_rule';

//these constants are names used to save and retrieve data between steps
//they are constants instead of strings so that TypeScript will detect spelling errors
export const GITHUB_MEMBER_BY_LOGIN_MAP = 'GITHUB_MEMBER_BY_LOGIN_MAP';
export const GITHUB_OUTSIDE_COLLABORATOR_ARRAY =
  'GITHUB_OUTSIDE_COLLABORATOR_ARRAY';
export const GITHUB_REPO_TAGS_ARRAY = 'GITHUB_REPO_TAGS_ARRAY';
export const GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP =
  'GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP';
