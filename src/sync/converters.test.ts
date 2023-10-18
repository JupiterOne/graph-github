import {
  toOrganizationMemberEntity,
  toOrganizationCollaboratorEntity,
  toRepositoryEntity,
  toAccountEntity,
  toTeamEntity,
  toOrgSecretEntity,
  toRepoSecretEntity,
  toPullRequestEntity,
  createUnknownUserIssueRelationship,
  toAppEntity,
  toEnvironmentEntity,
  toEnvSecretEntity,
  toIssueEntity,
  createAssociatedMergePullRequestRelationship,
  decorateRepoEntityWithPagesInfo,
  buildPullRequestKey,
} from './converters';
import { EnvironmentEntity } from '../types';
import { PullRequestResponse } from '../client/GraphQLClient/types';
import {
  fixturePullRequest,
  fixtureUser,
  fixtureReviewerUser,
  fixtureCommits,
  fixtureReviews,
} from './fixtures/pullRequest';
import { GithubPagesInfo } from '../client';
import { decomposePullRequestKey } from '../util/propertyHelpers';

describe('toAccountEntity', () => {
  const apiResponse = {
    id: 'account-node-id',
    login: 'account-login',
    name: 'account-name',
    createdAt: '2021-05-27T15:21:12Z',
    updatedAt: '2021-09-16T15:04:20Z',
    description: "Here's my test description",
    email: 'email@email.com',
    databaseId: 12345678,
    isVerified: false,
    location: 'Transylvania',
    websiteUrl: 'www.goclickatesturl.com',
    url: 'https://github.com/SomeOrg',
  };

  test('properties transferred', () => {
    const entity = toAccountEntity(apiResponse as any);
    expect(entity).toEqual({
      _class: ['Account'],
      _type: 'github_account',
      _key: 'account-node-id',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      accountType: 'Organization',
      accountId: 'account-login',
      login: 'account-login',
      name: 'account-name',
      displayName: 'account-name',
      createdOn: 1622128872000,
      updatedOn: 1631804660000,
      description: "Here's my test description",
      email: 'email@email.com',
      node: 'account-node-id',
      databaseId: 12345678,
      verified: false,
      location: 'Transylvania',
      websiteUrl: 'www.goclickatesturl.com',
      webLink: 'https://github.com/SomeOrg',
    });
  });

  test('displayName falls back to login', () => {
    expect(
      toAccountEntity({ ...apiResponse, name: undefined } as any),
    ).toMatchObject({
      displayName: 'account-login',
    });
  });
});

describe('toTeamEntity', () => {
  const apiResponse = {
    id: 'MDQ6VGVhbTQ4NTc0OTU=',
    name: 'Test team',
    url: 'https://github.com/orgs/Kei-Institute/teams/test-team',
    slug: 'test-team',
    createdAt: '2021-06-01T15:45:57Z',
    updatedAt: '2021-06-01T15:45:57Z',
    databaseId: 4857495,
    description: 'Just a test team testing test teams',
    privacy: 'VISIBLE',
    organization: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz',
  };

  test('properties transferred', () => {
    const entity = toTeamEntity(apiResponse as any);
    //update this
    expect(entity).toEqual({
      _class: ['UserGroup'],
      _type: 'github_team',
      _key: 'MDQ6VGVhbTQ4NTc0OTU=',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      webLink: 'https://github.com/orgs/Kei-Institute/teams/test-team',
      name: 'test-team',
      displayName: 'Test team',
      fullName: 'Test team',
      createdOn: 1622562357000,
      updatedOn: 1622562357000,
      databaseId: 4857495,
      description: 'Just a test team testing test teams',
      node: 'MDQ6VGVhbTQ4NTc0OTU=',
      privacy: 'VISIBLE',
    });
  });
});

test('toRepositoryEntities', () => {
  const apiResponse = {
    id: 'repo-node-id',
    name: 'repo-name',
    nameWithOwner: 'owner/repo-name',
    isPrivate: true,
    isArchived: false,
    url: 'web-link',
    createdAt: '2021-05-27T15:23:24Z',
    updatedAt: '2021-05-27T15:23:28Z',
    autoMergeAllowed: false,
    databaseId: 371419598,
    deleteBranchOnMerge: false,
    description: 'This is a test repository',
    forkingAllowed: true,
    forkCount: 1,
    homepageUrl: null,
    isDisabled: false,
    isEmpty: false,
    isFork: false,
    isInOrganization: true,
    isLocked: false,
    isMirror: false,
    isSecurityPolicyEnabled: false,
    isTemplate: false,
    isUserConfigurationRepository: false,
    lockReason: null,
    mergeCommitAllowed: true,
    pushedAt: '2021-06-08T18:12:39Z',
    rebaseMergeAllowed: true,
  };
  const entity = toRepositoryEntity(apiResponse as any);
  expect(entity).toEqual({
    _key: 'repo-node-id',
    _type: 'github_repo',
    _class: ['CodeRepo'],
    _rawData: [
      {
        name: 'default',
        rawData: apiResponse,
      },
    ],
    webLink: 'web-link',
    public: false,
    name: 'repo-name',
    displayName: 'repo-name',
    fullName: 'owner/repo-name',
    owner: 'owner',
    archived: false,
    createdOn: 1622129004000,
    updatedOn: 1622129008000,
    pushedOn: 1623175959000,
    databaseId: 371419598,
    autoMergeAllowed: false,
    deleteBranchOnMerge: false,
    description: 'This is a test repository',
    homepageUrl: '',
    node: 'repo-node-id',
    disabled: false,
    empty: false,
    fork: false,
    forkingAllowed: true,
    forkCount: 1,
    inOrganization: true,
    locked: false,
    mirror: false,
    securityPolicyEnabled: false,
    template: false,
    userConfigurationRepository: false,
    lockReason: '',
    mergeCommitAllowed: true,
    rebaseMergeAllowed: true,
  });
});

test('decorateRepoEntityWithPagesInfo', () => {
  const apiResponse = {
    id: 'repo-node-id',
    name: 'repo-name',
    nameWithOwner: 'owner/repo-name',
    isPrivate: true,
    isArchived: false,
    url: 'web-link',
    createdAt: '2021-05-27T15:23:24Z',
    updatedAt: '2021-05-27T15:23:28Z',
    autoMergeAllowed: false,
    databaseId: 371419598,
    deleteBranchOnMerge: false,
    description: 'This is a test repository',
    forkingAllowed: true,
    forkCount: 1,
    homepageUrl: null,
    isDisabled: false,
    isEmpty: false,
    isFork: false,
    isInOrganization: true,
    isLocked: false,
    isMirror: false,
    isSecurityPolicyEnabled: false,
    isTemplate: false,
    isUserConfigurationRepository: false,
    lockReason: null,
    mergeCommitAllowed: true,
    pushedAt: '2021-06-08T18:12:39Z',
    rebaseMergeAllowed: true,
  };
  const pagesInfo: GithubPagesInfo = {
    hasPages: true,
    pagesUrl: 'thispagerocks.com',
  };
  const entity = toRepositoryEntity(apiResponse as any);
  decorateRepoEntityWithPagesInfo(entity, pagesInfo);
  expect(entity).toEqual({
    _key: 'repo-node-id',
    _type: 'github_repo',
    _class: ['CodeRepo'],
    _rawData: [
      {
        name: 'default',
        rawData: apiResponse,
      },
    ],
    webLink: 'web-link',
    public: false,
    name: 'repo-name',
    displayName: 'repo-name',
    fullName: 'owner/repo-name',
    owner: 'owner',
    archived: false,
    createdOn: 1622129004000,
    updatedOn: 1622129008000,
    pushedOn: 1623175959000,
    databaseId: 371419598,
    autoMergeAllowed: false,
    deleteBranchOnMerge: false,
    description: 'This is a test repository',
    homepageUrl: '',
    node: 'repo-node-id',
    disabled: false,
    empty: false,
    fork: false,
    forkingAllowed: true,
    forkCount: 1,
    inOrganization: true,
    locked: false,
    mirror: false,
    securityPolicyEnabled: false,
    template: false,
    userConfigurationRepository: false,
    lockReason: '',
    mergeCommitAllowed: true,
    rebaseMergeAllowed: true,
    hasPages: true,
    pagesUrl: 'thispagerocks.com',
  });
});

describe('toOrganizationMemberEntity', () => {
  const apiResponse = {
    id: 'member-node-id',
    login: 'user-login',
    name: 'User Flynn',
    hasTwoFactorEnabled: true,
    role: 'Maintainer',
    isSiteAdmin: false,
    company: 'Test Company',
    createdAt: '2020-03-22T02:59:22Z',
    databaseId: 62492097,
    email: 'flynn@test.com',
    isEmployee: false,
    location: 'Best place ever',
    updatedAt: '2021-08-12T18:55:22Z',
    url: 'https://github.com/user-login',
    websiteUrl: 'https://about.me/user-login',
    active: true,
    organization: 'my-org',
  };

  test('properties transferred', () => {
    const entity = toOrganizationMemberEntity(apiResponse as any);
    expect(entity).toEqual({
      _key: 'member-node-id',
      _type: 'github_user',
      _class: ['User'],
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      login: 'user-login',
      username: 'user-login',
      displayName: 'User Flynn',
      name: 'User Flynn',
      mfaEnabled: true,
      role: 'Maintainer',
      siteAdmin: false,
      webLink: 'https://github.com/user-login',
      company: 'Test Company',
      createdOn: 1584845962000,
      updatedOn: 1628794522000,
      databaseId: 62492097,
      email: 'flynn@test.com',
      node: 'member-node-id',
      id: 'member-node-id',
      employee: false,
      location: 'Best place ever',
      websiteUrl: 'https://about.me/user-login',
      active: true,
      organizationId: 'my-org',
    });
  });

  test('displayName falls back to login', () => {
    expect(
      toOrganizationMemberEntity({ ...apiResponse, name: undefined } as any),
    ).toMatchObject({
      displayName: 'user-login',
    });
  });
});

describe('toOrganizationCollaboratorEntity', () => {
  const apiResponse = {
    id: 'member-node-id',
    login: 'user-login',
    name: 'User Flynn',
  };

  test('properties transferred', () => {
    const entity = toOrganizationCollaboratorEntity(
      apiResponse as any,
      'https://api.github.com',
    );
    expect(entity).toEqual({
      _key: 'member-node-id',
      _type: 'github_user',
      _class: ['User'],
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      login: 'user-login',
      username: 'user-login',
      displayName: 'User Flynn',
      name: 'User Flynn',
      mfaEnabled: undefined,
      role: 'OUTSIDE',
      siteAdmin: false,
      webLink: 'https://github.com/user-login',
      node: 'member-node-id',
      id: 'member-node-id',
      active: true,
    });
  });

  test('displayName falls back to login', () => {
    expect(
      toOrganizationMemberEntity({ ...apiResponse, name: undefined } as any),
    ).toMatchObject({
      displayName: 'user-login',
    });
  });
});

describe('toAppEntity', () => {
  const apiResponse = {
    id: 19232829,
    account: {
      login: 'Kei-Institute',
      id: 84923503,
      node_id: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz',
      avatar_url: 'https://avatars.githubusercontent.com/u/84923503?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/Kei-Institute',
      html_url: 'https://github.com/Kei-Institute',
      followers_url: 'https://api.github.com/users/Kei-Institute/followers',
      following_url:
        'https://api.github.com/users/Kei-Institute/following{/other_user}',
      gists_url: 'https://api.github.com/users/Kei-Institute/gists{/gist_id}',
      starred_url:
        'https://api.github.com/users/Kei-Institute/starred{/owner}{/repo}',
      subscriptions_url:
        'https://api.github.com/users/Kei-Institute/subscriptions',
      organizations_url: 'https://api.github.com/users/Kei-Institute/orgs',
      repos_url: 'https://api.github.com/users/Kei-Institute/repos',
      events_url: 'https://api.github.com/users/Kei-Institute/events{/privacy}',
      received_events_url:
        'https://api.github.com/users/Kei-Institute/received_events',
      type: 'Organization',
      site_admin: false,
    },
    repository_selection: 'all',
    access_tokens_url:
      'https://api.github.com/app/installations/19232829/access_tokens',
    repositories_url: 'https://api.github.com/installation/repositories',
    html_url:
      'https://github.com/organizations/Kei-Institute/settings/installations/19232829',
    app_id: 135931,
    app_slug: 'kai-institute-mknoedel',
    target_id: 84923503,
    target_type: 'Organization',
    permissions: {
      members: 'read',
      secrets: 'read',
      metadata: 'read',
      organization_secrets: 'read',
      organization_administration: 'read',
    },
    events: [],
    created_at: '2021-09-02T18:37:08.000Z',
    updated_at: '2021-09-02T18:58:19.000Z',
    single_file_name: null,
    has_multiple_single_files: false,
    single_file_paths: [],
    suspended_by: null,
    suspended_at: null,
  };

  test('properties transferred', () => {
    const entity = toAppEntity(apiResponse as any);
    expect(entity).toEqual({
      _class: ['Application'],
      _type: 'github_app',
      _key: 'GitHubAppInstallation_19232829',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'kai-institute-mknoedel',
      displayName: 'kai-institute-mknoedel',
      webLink:
        'https://github.com/organizations/Kei-Institute/settings/installations/19232829',
      installationId: 19232829,
      appId: 135931,
      appSlug: 'kai-institute-mknoedel',
      targetId: 84923503,
      targetType: 'Organization',
      createdOn: 1630607828000,
      updatedOn: 1630609099000,
      events: [],
      repositorySelection: 'all',
      singleFileName: '',
      hasMultipleSingleFiles: false,
      singleFilePaths: [],
      suspendedOn: undefined,
      'permissions.members': 'read',
      'permissions.secrets': 'read',
      'permissions.metadata': 'read',
      'permissions.organization-secrets': 'read',
      'permissions.organization-administration': 'read',
    });
  });
});

describe('toOrgSecretEntity', () => {
  const apiResponse = {
    name: 'KINDA_SECRET',
    created_at: '2021-08-23T23:42:55Z',
    updated_at: '2021-08-23T23:42:55Z',
    visibility: 'selected',
    selected_repositories_url:
      'https://api.github.com/orgs/SomeOrg/actions/secrets/KINDA_SECRET/repositories',
  };

  test('properties transferred', () => {
    const entity = toOrgSecretEntity(
      apiResponse as any,
      'SomeOrg',
      'https://api.github.com',
    );
    expect(entity).toEqual({
      _class: ['Secret'],
      _type: 'github_org_secret',
      _key: 'GitHub_Org_SomeOrg_Secret_KINDA_SECRET',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'KINDA_SECRET',
      displayName: 'KINDA_SECRET',
      webLink:
        'https://github.com/organizations/SomeOrg/settings/secrets/actions/KINDA_SECRET',
      createdOn: 1629762175000,
      updatedOn: 1629762175000,
      visibility: 'selected',
      selectedRepositoriesLink:
        'https://api.github.com/orgs/SomeOrg/actions/secrets/KINDA_SECRET/repositories',
    });
  });
  test('properties transferred w/GHE server baseUrl', () => {
    const entity = toOrgSecretEntity(
      {
        ...apiResponse,
        selected_repositories_url:
          'https://my.github.com/orgs/SomeOrg/actions/secrets/KINDA_SECRET/repositories',
      } as any,
      'SomeOrg',
      'https://my.github.com',
    );
    expect(entity).toEqual({
      _class: ['Secret'],
      _type: 'github_org_secret',
      _key: 'GitHub_Org_SomeOrg_Secret_KINDA_SECRET',
      _rawData: [
        {
          name: 'default',
          rawData: {
            ...apiResponse,
            selected_repositories_url:
              'https://my.github.com/orgs/SomeOrg/actions/secrets/KINDA_SECRET/repositories',
          },
        },
      ],
      name: 'KINDA_SECRET',
      displayName: 'KINDA_SECRET',
      webLink:
        'https://my.github.com/organizations/SomeOrg/settings/secrets/actions/KINDA_SECRET',
      createdOn: 1629762175000,
      updatedOn: 1629762175000,
      visibility: 'selected',
      selectedRepositoriesLink:
        'https://my.github.com/orgs/SomeOrg/actions/secrets/KINDA_SECRET/repositories',
    });
  });
});

describe('toRepoSecretEntity', () => {
  const apiResponse = {
    name: 'PRETTY_SECRET',
    created_at: '2021-08-23T23:53:00Z',
    updated_at: '2021-08-23T23:53:00Z',
  };

  test('properties transferred', () => {
    const entity = toRepoSecretEntity(
      apiResponse as any,
      'SomeOrg',
      'https://api.github.com',
      'Test-repo',
    );
    expect(entity).toEqual({
      _class: ['Secret'],
      _type: 'github_repo_secret',
      _key: 'GitHub_Repo_Test-repo_Secret_PRETTY_SECRET',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'PRETTY_SECRET',
      displayName: 'PRETTY_SECRET',
      webLink:
        'https://github.com/SomeOrg/Test-repo/settings/secrets/actions/PRETTY_SECRET',
      createdOn: 1629762780000,
      updatedOn: 1629762780000,
      visibility: 'selected',
    });
  });
});

describe('toEnvironmentEntity', () => {
  const apiResponse = {
    id: '288429400',
    node_id: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
    name: 'Ambiente',
    url: 'https://api.github.com/repos/SomeOrg/SomeRepo/environments/Ambiente',
    html_url:
      'https://github.com/SomeOrg/SomeRepo/deployments/activity_log?environments_filter=Ambiente',
    created_at: '2021-08-23T23:53:20Z',
    updated_at: '2021-08-23T23:53:20Z',
    protection_rules: [
      {
        id: 3736,
        node_id: 'MDQ6R2F0ZTM3MzY=',
        type: 'wait_timer',
        wait_timer: 30,
      },
      {
        id: 3755,
        node_id: 'MDQ6R2F0ZTM3NTU=',
        type: 'required_reviewers',
        reviewers: [
          {
            type: 'User',
            reviewer: {
              login: 'octocat',
              id: 1,
              node_id: 'MDQ6VXNlcjE=',
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              gravatar_id: '',
              url: 'https://api.github.com/users/octocat',
              html_url: 'https://github.com/octocat',
              followers_url: 'https://api.github.com/users/octocat/followers',
              following_url:
                'https://api.github.com/users/octocat/following{/other_user}',
              gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
              starred_url:
                'https://api.github.com/users/octocat/starred{/owner}{/repo}',
              subscriptions_url:
                'https://api.github.com/users/octocat/subscriptions',
              organizations_url: 'https://api.github.com/users/octocat/orgs',
              repos_url: 'https://api.github.com/users/octocat/repos',
              events_url:
                'https://api.github.com/users/octocat/events{/privacy}',
              received_events_url:
                'https://api.github.com/users/octocat/received_events',
              type: 'User',
              site_admin: false,
            },
          },
          {
            type: 'Team',
            reviewer: {
              id: 1,
              node_id: 'MDQ6VGVhbTE=',
              url: 'https://api.github.com/teams/1',
              html_url: 'https://github.com/orgs/github/teams/justice-league',
              name: 'Justice League',
              slug: 'justice-league',
              description: 'A great team.',
              privacy: 'closed',
              permission: 'admin',
              members_url: 'https://api.github.com/teams/1/members{/member}',
              repositories_url: 'https://api.github.com/teams/1/repos',
              parent: null,
            },
          },
        ],
      },
      {
        id: 3756,
        node_id: 'MDQ6R2F0ZTM3NTY=',
        type: 'branch_policy',
      },
    ],
    deployment_branch_policy: null,
  };

  test('properties transferred', () => {
    const entity = toEnvironmentEntity(
      apiResponse as any,
      'SomeOrg',
      'https://api.github.com',
      {
        name: 'SomeRepo',
        _key: 'pretendKey',
        databaseId: 'pretendId',
      },
    );
    expect(entity).toEqual({
      _class: ['Configuration'],
      _type: 'github_environment',
      _key: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'Ambiente',
      displayName: 'Ambiente',
      webLink:
        'https://github.com/SomeOrg/SomeRepo/settings/environments/288429400/edit',
      id: '288429400',
      nodeId: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      url: 'https://api.github.com/repos/SomeOrg/SomeRepo/environments/Ambiente',
      htmlUrl:
        'https://github.com/SomeOrg/SomeRepo/deployments/activity_log?environments_filter=Ambiente',
      createdOn: 1629762800000,
      updatedOn: 1629762800000,
      protectionRulesExist: true,
      parentRepoName: 'SomeRepo',
      parentRepoKey: 'pretendKey',
      parentRepoDatabaseId: 'pretendId',
    });
  });

  test('missing protection rules detected', () => {
    apiResponse.protection_rules = [];
    const entity = toEnvironmentEntity(
      apiResponse as any,
      'SomeOrg',
      'https://api.github.com',
      {
        name: 'SomeRepo',
        _key: 'pretendKey',
        databaseId: 'pretendId',
      },
    );
    expect(entity).toEqual({
      _class: ['Configuration'],
      _type: 'github_environment',
      _key: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'Ambiente',
      displayName: 'Ambiente',
      webLink:
        'https://github.com/SomeOrg/SomeRepo/settings/environments/288429400/edit',
      id: '288429400',
      nodeId: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      url: 'https://api.github.com/repos/SomeOrg/SomeRepo/environments/Ambiente',
      htmlUrl:
        'https://github.com/SomeOrg/SomeRepo/deployments/activity_log?environments_filter=Ambiente',
      createdOn: 1629762800000,
      updatedOn: 1629762800000,
      protectionRulesExist: false,
      parentRepoName: 'SomeRepo',
      parentRepoKey: 'pretendKey',
      parentRepoDatabaseId: 'pretendId',
    });
  });
});

describe('toEnvSecretEntity', () => {
  const apiResponse = {
    name: 'ENVIRONMENTAL_SECRET',
    created_at: '2021-08-23T23:53:52Z',
    updated_at: '2021-08-23T23:53:52Z',
  };

  test('properties transferred', () => {
    const environment = {
      _class: ['Configuration'],
      _type: 'github_environment',
      _key: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'Ambiente',
      displayName: 'Ambiente',
      webLink:
        'https://github.com/SomeOrg/Test-repo/settings/environments/288429400/edit',
      id: '288429400',
      nodeId: 'MDExOkVudmlyb25tZW50Mjg4NDI5NDAw',
      url: 'https://api.github.com/repos/SomeOrg/Test-repo/environments/Ambiente',
      htmlUrl:
        'https://github.com/SomeOrg/Test-repo/deployments/activity_log?environments_filter=Ambiente',
      createdOn: 1629762800000,
      updatedOn: 1629762800000,
      protectionRulesExist: false,
      parentRepoName: 'Test-repo',
      parentRepoKey: 'pretendKey',
      parentRepoDatabaseId: 'pretendId',
    } as EnvironmentEntity;
    const entity = toEnvSecretEntity(
      apiResponse as any,
      'SomeOrg',
      'https://api.github.com',
      environment,
    );
    expect(entity).toEqual({
      _class: ['Secret'],
      _type: 'github_env_secret',
      _key: 'GitHub_Env_AmbienteInRepoTest-repo_Secret_ENVIRONMENTAL_SECRET',
      _rawData: [
        {
          name: 'default',
          rawData: apiResponse,
        },
      ],
      name: 'ENVIRONMENTAL_SECRET',
      displayName: 'ENVIRONMENTAL_SECRET',
      webLink:
        'https://github.com/SomeOrg/Test-repo/settings/environments/288429400/edit',
      createdOn: 1629762832000,
      updatedOn: 1629762832000,
      visibility: 'selected',
    });
  });
});

describe('toIssue', () => {
  const apiResponse = {
    id: 'I_kwDOFiNpzs479Jfp',
    activeLockReason: null,
    authorAssociation: 'MEMBER',
    body: 'How can I know what my issue really is?',
    bodyText: 'How can I know what my issue really is?',
    closed: false,
    closedAt: null,
    createdAt: '2021-09-23T22:05:39Z',
    createdViaEmail: false,
    databaseId: 1005885417,
    isPinned: false,
    lastEditedAt: null,
    locked: false,
    number: 3,
    publishedAt: '2021-09-23T22:05:39Z',
    resourcePath: '/Kei-Institute/Test-repo/issues/3',
    state: 'OPEN',
    title: "I've got issues with Issues",
    titleHTML: "I've got issues with Issues",
    updatedAt: '2021-09-24T17:28:10Z',
    author: {
      name: 'Kevin Casey',
      login: 'kevincasey1222',
    },
    bodyUrl:
      'https://github.com/Kei-Institute/Test-repo/issues/3#issue-1005885417',
    url: 'https://github.com/Kei-Institute/Test-repo/issues/3',
    assignees: [
      {
        name: 'Erich Smith',
        login: 'erichs',
        issues: 'I_kwDOFiNpzs479Jfp',
      },
      {
        name: 'Kevin Casey',
        login: 'kevincasey1222',
        issues: 'I_kwDOFiNpzs479Jfp',
      },
    ],
    labels: [
      {
        name: 'bug',
        someotherproperty: 'stuff',
      },
      {
        name: 'enhancement',
        someotherproperty: 'stuff',
      },
    ],
  };

  test('properties transferred', () => {
    const issue = toIssueEntity(apiResponse as any, 'Test-repo');
    expect(issue).toEqual({
      _type: 'github_issue',
      _key: 'I_kwDOFiNpzs479Jfp',
      _class: ['Issue'],
      name: 'Test-repo/3',
      displayName: 'Test-repo/3',
      description: 'How can I know what my issue really is?',
      number: 3,
      databaseId: 1005885417,
      title: "I've got issues with Issues",
      state: 'OPEN',
      locked: false,
      closed: false,
      closedOn: undefined,
      createdOn: 1632434739000,
      updatedOn: 1632504490000,
      lastEditedOn: undefined,
      authorAssociation: 'MEMBER',
      activeLockReason: null,
      body: 'How can I know what my issue really is?',
      createdViaEmail: false,
      pinned: false,
      publishedOn: 1632434739000,
      resourcePath: '/Kei-Institute/Test-repo/issues/3',
      webLink: 'https://github.com/Kei-Institute/Test-repo/issues/3',
      url: 'https://github.com/Kei-Institute/Test-repo/issues/3',
      labels: ['bug', 'enhancement'],
      _rawData: [
        {
          name: 'default',
          rawData: {
            ...apiResponse,
            body: undefined,
            bodyText: undefined,
          },
        },
      ],
    });
  });
});

describe('toPullRequestEntity', () => {
  test('with all commits approved', () => {
    const entity = toPullRequestEntity({
      pullRequest: fixturePullRequest,
      commits: fixtureCommits,
      reviews: fixtureReviews,
      labels: [],
      teamMembersByLoginMap: new Map([
        [fixtureUser.login, fixtureUser._key],
        [fixtureReviewerUser.login, fixtureReviewerUser._key],
      ]),
      allKnownUsersByLoginMap: new Map([
        [fixtureUser.login, fixtureUser._key],
        [fixtureReviewerUser.login, fixtureReviewerUser._key],
      ]),
    });
    expect(entity).toMatchSnapshot();
  });

  test('declined', () => {
    const declinedPullRequest: PullRequestResponse = {
      ...fixturePullRequest,
      state: 'CLOSED',
      merged: false,
      mergedAt: undefined,
      mergeCommit: undefined,
    };
    const entity = toPullRequestEntity({
      pullRequest: declinedPullRequest,
      commits: fixtureCommits,
      reviews: fixtureReviews,
      labels: [],
      teamMembersByLoginMap: new Map([
        [fixtureUser.login, fixtureUser._key],
        [fixtureReviewerUser.login, fixtureReviewerUser._key],
      ]),
      allKnownUsersByLoginMap: new Map([
        [fixtureUser.login, fixtureUser._key],
        [fixtureReviewerUser.login, fixtureReviewerUser._key],
      ]),
    });
    expect(entity).toMatchObject({
      state: 'CLOSED',
      open: false,
      declined: true,
      merged: false,
      mergedOn: undefined,
      mergeCommitHash: undefined,
    });
  });

  test('with no known user approvals', () => {
    const entity = toPullRequestEntity({
      pullRequest: fixturePullRequest,
      commits: fixtureCommits,
      reviews: fixtureReviews,
      labels: [],
      teamMembersByLoginMap: new Map(),
      allKnownUsersByLoginMap: new Map(),
    });
    expect(entity).toMatchObject({
      allCommitsApproved: false,
      validated: false,
      commits: fixtureCommits.map((c) => c.oid),
      commitMessages: fixtureCommits.map((c) => c.message),
      commitsApproved: [],
      commitsNotApproved: fixtureCommits.map((c) => c.oid),
      commitsByUnknownAuthor: fixtureCommits.map((c) => c.oid),
      approvers: [fixtureReviewerUser.displayName],
      approverLogins: [fixtureReviewerUser.login],
      author: fixtureUser.displayName,
      reviewers: [fixtureReviewerUser.displayName],
      _rawData: [
        {
          name: 'default',
          rawData: fixturePullRequest,
        },
      ],
    });
  });

  test('with commits and reviews from users that are contributors but not team members', () => {
    const entity = toPullRequestEntity({
      pullRequest: fixturePullRequest,
      commits: fixtureCommits,
      reviews: fixtureReviews,
      labels: [],
      teamMembersByLoginMap: new Map(),
      allKnownUsersByLoginMap: new Map([
        [fixtureUser.login, fixtureUser._key],
        [fixtureReviewerUser.login, fixtureReviewerUser._key],
      ]),
    });
    expect(entity).toMatchObject({
      allCommitsApproved: false,
      validated: true,
      commits: fixtureCommits.map((c) => c.oid),
      commitMessages: fixtureCommits.map((c) => c.message),
      commitsApproved: [],
      commitsNotApproved: fixtureCommits.map((c) => c.oid),
      commitsByUnknownAuthor: [],
      approvers: [fixtureReviewerUser.displayName],
      approverLogins: [fixtureReviewerUser.login],
      author: fixtureUser.displayName,
      reviewers: [fixtureReviewerUser.displayName],
      _rawData: [
        {
          name: 'default',
          rawData: fixturePullRequest,
        },
      ],
    });
  });
});

describe('createUnknownUserPrRelationship', () => {
  test('properties transferred', () => {
    const relationship = createUnknownUserIssueRelationship(
      'unknownlogin',
      'github_user_approved_pullrequest',
      'APPROVED',
      'somePrEntityKey',
    );
    expect(relationship).toEqual({
      _key: `unknownlogin|approved|somePrEntityKey`,
      _type: 'github_user_approved_pullrequest',
      _class: 'APPROVED',
      _mapping: {
        sourceEntityKey: 'somePrEntityKey',
        relationshipDirection: 'REVERSE',
        targetFilterKeys: [['_type', 'login']],
        targetEntity: {
          _class: 'User',
          _type: 'github_user',
          login: 'unknownlogin',
        },
        skipTargetCreation: false,
      },
      displayName: 'APPROVED',
    });
  });
});

describe('createAssociatedMergePullRequestRelationship', () => {
  test('parameter validation', () => {
    expect(() =>
      createAssociatedMergePullRequestRelationship({} as PullRequestResponse),
    ).toThrow('number is required on the associated pull request');

    expect(() =>
      createAssociatedMergePullRequestRelationship({
        id: '#1',
        mergeCommit: {
          associatedPullRequest: {
            id: '#1',
            number: 1,
          },
        },
      } as PullRequestResponse),
    ).toThrow(
      'associated pull request must be different than source pull request.',
    );
  });
});

describe('pullRequestKey', () => {
  test('buildPullRequestKey', () => {
    expect(
      buildPullRequestKey({
        login: 'J1',
        repoName: 'friendly-octokit',
        pullRequestNumber: 4,
      }),
    ).toBe('J1/friendly-octokit/pull-requests/4');
  });
  test('decomposePullRequestKey', () => {
    expect(
      decomposePullRequestKey('J1/friendly-octokit/pull-requests/4'),
    ).toEqual({
      login: 'J1',
      repoName: 'friendly-octokit',
      pullRequestNumber: 4,
    });

    expect(() => decomposePullRequestKey('J1/friendly-octokit/4')).toThrowError(
      'provided key is invalid',
    );
  });
});
