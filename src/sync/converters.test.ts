import { parseTimePropertyValue } from '@jupiterone/integration-sdk-core';
import {
  toOrganizationMemberEntity,
  toOrganizationCollaboratorEntity,
  toRepositoryEntity,
  toAccountEntity,
  toPullRequestEntity,
} from './converters';
import { UserEntity, PullsListResponseItem } from '../types';
import { omit } from 'lodash';
import { PullRequest } from '../client/GraphQLClient/types';
import {
  fixturePullRequest,
  fixtureUser,
  fixtureReviewerUser,
  pullRequestReviewer,
  pullRequestUser,
} from './fixtures/pullRequest';
import { toPullRequestEntityOld } from './utils/toPullRequestEntityOld';

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

test('toRepositoryEntities', () => {
  const apiResponse = {
    id: 'repo-node-id',
    name: 'repo-name',
    nameWithOwner: 'owner/repo-name',
    isPrivate: true,
    isArchived: false,
    url: 'web-link',
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

describe('toPullRequestEntity compared against toPullRequestEntityOld', () => {
  const user = ({
    name: 'Some Body',
    displayName: 'Some Body',
    login: 'somebody',
    username: 'somebody',
  } as unknown) as UserEntity;
  const reviewerUser = ({
    name: 'Reviewer User',
    displayName: 'Reviewer User',
    login: 'reviewer-user',
    username: 'reviewer-user',
  } as unknown) as UserEntity;
  const oldApiResponse: PullsListResponseItem = ({
    title: 'The Best PR Ever',
    number: '420',
    user: {
      login: 'somebody',
    },
    requested_reviewers: [
      {
        login: 'reviewer-user',
      },
    ],
    base: {
      ref: 'qwerty098765',
      repo: {
        full_name: 'my-team/my-repo',
        name: 'my-repo',
        owner: {
          login: 'my-team',
        },
      },
    },
    body: 'This is the description',
    state: 'MERGED', // Merged because it hase a merged_at property
    head: {
      ref: 'abcdef123456',
    },
    created_at: '2001-09-11T08:46:00Z',
    updated_at: '2001-09-11T20:30:00Z',
    merged_at: '2021-07-21T14:06:13Z',
    merge_commit_sha: 'f8d8a228a6046ead812d9ea0c457e429342a89f7',
    url: 'https://api.github.com/repos/JupiterOne/jupiter-project-repo/pulls/1',
    html_url: 'https://github.com/JupiterOne/jupiter-project-repo/pulls/1',
  } as unknown) as PullsListResponseItem;

  const newApiResponse: PullRequest = {
    id: 'id',
    additions: 1,
    author: pullRequestUser,
    authorAssociation: 'authorAssociation',
    baseRefName: 'qwerty098765',
    baseRefOid: 'baseRefOid',
    baseRepository: {
      name: 'my-repo',
      owner: {
        login: 'my-team',
        id: '12345',
        url: 'https://github.com/my-team',
      },
    },
    body: 'This is the description',
    changedFiles: 1,
    checksUrl: 'checksUrl',
    closed: false,
    closedAt: undefined,
    createdAt: '2001-09-11T08:46:00Z',
    deletions: 1,
    editor: pullRequestUser,
    headRefName: 'abcdef123456',
    headRefOid: 'headRefOid',
    headRepository: {
      name: 'their-repo',
      owner: {
        login: 'their-team',
        id: '67890',
        url: 'https://github.com/their-team',
      },
    },
    isDraft: false,
    lastEditedAt: undefined,
    locked: false,
    mergeCommit: {
      oid: 'f8d8a228a6046ead812d9ea0c457e429342a89f7',
      id: 'id',
      message: 'message',
      authoredDate: '2001-09-11T20:30:00Z',
      changedFiles: 1,
      commitUrl: 'commitUrl',
      author: { user: pullRequestUser },
    },
    mergeable: 'MERGEABLE',
    merged: true,
    mergedAt: '2021-07-21T14:06:13Z',
    mergedBy: pullRequestUser,
    number: 420,
    permalink: 'permalink',
    publishedAt: undefined,
    reviewDecision: 'REVIEW_REQUIRED',
    state: 'MERGED',
    title: 'The Best PR Ever',
    updatedAt: '2001-09-11T20:30:00Z',
    url: 'https://github.com/JupiterOne/jupiter-project-repo/pulls/1',
    // Optional extra traversals
    commits: undefined,
    labels: undefined,
    reviews: undefined,
  };

  const expectedEntity = {
    _type: 'github_pullrequest',
    _class: ['PR'],
    _key: `my-team/my-repo/pull-requests/420`,
    name: 'The Best PR Ever',
    displayName: `my-repo/420`,
    id: '420',
    number: 420,
    pullRequestId: 'id',
    accountLogin: 'my-team',
    authorLogin: 'somebody',
    author: 'Some Body',
    reviewerLogins: ['reviewer-user'],
    reviewers: ['Reviewer User'],
    approverLogins: ['reviewer-user'],
    approvers: ['Reviewer User'],
    title: 'The Best PR Ever',
    description: `${newApiResponse.body?.substring(0, 80)}...`,
    state: 'MERGED',
    source: 'abcdef123456',
    target: 'qwerty098765',
    repository: 'my-repo',
    createdOn: parseTimePropertyValue(newApiResponse.createdAt),
    updatedOn: parseTimePropertyValue(newApiResponse.updatedAt),
    webLink: 'https://github.com/JupiterOne/jupiter-project-repo/pulls/1',
    commits: ['commit_a', 'commit_b', 'commit_c'],
    commitMessages: ['Commit A', 'Commit B', 'Commit C'],
    commitsApproved: ['commit_a', 'commit_b'],
    commitsNotApproved: ['commit_c'],
    commitsByUnknownAuthor: [],
    approved: false,
    allCommitsApproved: false,
    validated: true,
    open: false,
    merged: true,
    declined: false,
    mergedOn: 1626876373000,
    mergeCommitHash: 'f8d8a228a6046ead812d9ea0c457e429342a89f7',
  };

  test('direct comparison', () => {
    const oldEntity = toPullRequestEntityOld(
      oldApiResponse,
      [
        { sha: 'commit_a', commit: { message: 'Commit A' } } as any,
        { sha: 'commit_b', commit: { message: 'Commit B' } } as any,
        { sha: 'commit_c', commit: { message: 'Commit C' } } as any,
      ],
      [{ sha: 'commit_a' } as any, { sha: 'commit_b' } as any],
      [],
      [{ approverUsernames: ['reviewer-user'] } as any],
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
    );
    const newEntity = toPullRequestEntity(
      {
        ...newApiResponse,
        commits: [
          { oid: 'commit_a', message: 'Commit A', author: { user } } as any,
          { oid: 'commit_b', message: 'Commit B', author: { user } } as any,
          { oid: 'commit_c', message: 'Commit C', author: { user } } as any,
        ],
        reviews: [
          {
            id: 'id',
            state: 'APPROVED',
            updatedAt: 'updatedAt',
            url: 'url',
            author: pullRequestReviewer,
            commit: {
              oid: 'commit_b',
            },
          },
        ],
      },
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
    );

    // Compare against the previous converter
    const newPullRequestProperties = [
      'allCommitsApproved',
      'pullRequestId',
      'number',
    ];
    expect(omit(newEntity, [...newPullRequestProperties, '_rawData'])).toEqual(
      omit(oldEntity, ['_rawData']),
    );

    // Compare with expected
    expect(omit(newEntity, ['_rawData'])).toEqual(expectedEntity);
  });

  test('declined comparison', () => {
    const apiResponseDeclined: PullRequest = {
      ...newApiResponse,
      state: 'CLOSED',
      merged: false,
      mergedAt: undefined,
      mergeCommit: undefined,
    };
    const newEntity = toPullRequestEntity(
      {
        ...apiResponseDeclined,
        commits: [
          { oid: 'commit_a', message: 'Commit A', author: { user } } as any,
          { oid: 'commit_b', message: 'Commit B', author: { user } } as any,
          { oid: 'commit_c', message: 'Commit C', author: { user } } as any,
        ],
        reviews: [
          {
            id: 'id',
            state: 'APPROVED',
            updatedAt: 'updatedAt',
            url: 'url',
            author: pullRequestReviewer,
            commit: {
              oid: 'commit_b',
            },
          },
        ],
      },
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
    );

    expect(omit(newEntity, ['_rawData'])).toEqual({
      ...expectedEntity,
      state: 'CLOSED',
      open: false,
      declined: true,
      merged: false,
      mergedOn: undefined,
      mergeCommitHash: undefined,
    });
  });

  test('without commits or reviews', () => {
    //TODO: fix this
    const entity = toPullRequestEntity(
      newApiResponse,
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
      {
        [user.login]: user,
        [reviewerUser.login]: reviewerUser,
      },
    );
    expect(omit(entity, ['_rawData'])).toEqual({
      ...expectedEntity,
      allCommitsApproved: undefined,
      validated: undefined,
      commits: undefined,
      commitMessages: undefined,
      commitsApproved: undefined,
      commitsNotApproved: undefined,
      commitsByUnknownAuthor: undefined,
      approvers: undefined,
      approverLogins: undefined,
      reviewers: undefined,
      reviewerLogins: undefined,
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
