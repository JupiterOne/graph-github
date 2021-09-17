import {
  toOrganizationMemberEntity,
  toOrganizationCollaboratorEntity,
  toRepositoryEntity,
  toAccountEntity,
  toTeamEntity,
  toOrgSecretEntity,
  toRepoSecretEntity,
  toPullRequestEntity,
} from './converters';
import { UserEntity } from '../types';
import { PullRequest } from '../client/GraphQLClient/types';
import {
  fixturePullRequest,
  fixtureUser,
  fixtureReviewerUser,
} from './fixtures/pullRequest';

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
      isVerified: false,
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
    isDisabled: false,
    isEmpty: false,
    isFork: false,
    isInOrganization: true,
    isLocked: false,
    isMirror: false,
    isSecurityPolicyEnabled: false,
    isTemplate: false,
    isUserConfigurationRepository: false,
    lockReason: '',
    mergeCommitAllowed: true,
    rebaseMergeAllowed: true,
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
      isEmployee: false,
      location: 'Best place ever',
      websiteUrl: 'https://about.me/user-login',
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
    node_id: 'member-node-id',
    login: 'user-login',
    name: 'User Flynn',
  };

  test('properties transferred', () => {
    const entity = toOrganizationCollaboratorEntity(apiResponse as any);
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
    const entity = toOrgSecretEntity(apiResponse as any, 'SomeOrg');
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

describe('toPullRequestEntity', () => {
  test('with all commits approved', () => {
    const entity = toPullRequestEntity(
      fixturePullRequest,
      {
        [fixtureUser.login!]: fixtureUser,
        [fixtureReviewerUser.login!]: fixtureReviewerUser,
      },
      {
        [fixtureUser.login!]: fixtureUser,
        [fixtureReviewerUser.login!]: fixtureReviewerUser,
      },
    );
    expect(entity).toMatchSnapshot();
  });

  test('declined', () => {
    const declinedPullRequest: PullRequest = {
      ...fixturePullRequest,
      state: 'CLOSED',
      merged: false,
      mergedAt: undefined,
      mergeCommit: undefined,
    };
    const entity = toPullRequestEntity(
      declinedPullRequest,
      {
        [fixtureUser.login]: fixtureUser as UserEntity,
        [fixtureReviewerUser.login]: fixtureReviewerUser as UserEntity,
      },
      {
        [fixtureUser.login!]: fixtureUser,
        [fixtureReviewerUser.login!]: fixtureReviewerUser,
      },
    );
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
    const entity = toPullRequestEntity(fixturePullRequest, {}, {});
    expect(entity).toMatchObject({
      allCommitsApproved: false,
      validated: false,
      commits: fixturePullRequest.commits?.map((c) => c.oid),
      commitMessages: fixturePullRequest.commits?.map((c) => c.message),
      commitsApproved: [],
      commitsNotApproved: fixturePullRequest.commits?.map((c) => c.oid),
      commitsByUnknownAuthor: fixturePullRequest.commits?.map((c) => c.oid),
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
    const entity = toPullRequestEntity(
      fixturePullRequest,
      {},
      {
        [fixtureUser.login!]: fixtureUser,
        [fixtureReviewerUser.login!]: fixtureReviewerUser,
      },
    );
    expect(entity).toMatchObject({
      allCommitsApproved: false,
      validated: true,
      commits: fixturePullRequest.commits?.map((c) => c.oid),
      commitMessages: fixturePullRequest.commits?.map((c) => c.message),
      commitsApproved: [],
      commitsNotApproved: fixturePullRequest.commits?.map((c) => c.oid),
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
