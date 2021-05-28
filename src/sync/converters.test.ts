import {
  toAccountOwnsRepoRelationship,
  toOrganizationMemberEntity,
  toOrganizationHasMemberRelationship,
  toRepositoryEntity,
  toAccountEntity,
  toPullRequestEntity,
  toRepoHasPullRequestRelationship,
  toUserOpenedPullRequestRelationship,
} from './converters';
import { RepoEntity, PullRequestEntity, UserEntity, PRState } from '../types';
import toTime from '../../util/toTime';

test('toAccountEntity', () => {
  const apiResponse = {
    id: 'account-node-id',
    login: 'account-login',
    name: 'account-name',
  };
  const entity = toAccountEntity(apiResponse as any);
  expect(entity).toEqual({
    _class: 'Account',
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
    _class: 'CodeRepo',
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

test('toOrganizationMemberEntities', () => {
  const apiResponse = {
    id: 'member-node-id',
    login: 'user-login',
    name: 'User Flynn',
    hasTwoFactorEnabled: true,
    role: 'Maintainer',
    isSiteAdmin: false,
  };
  const entity = toOrganizationMemberEntity(apiResponse as any);
  expect(entity).toEqual({
    _key: 'member-node-id',
    _type: 'github_user',
    _class: 'User',
    _rawData: [
      {
        name: 'default',
        rawData: apiResponse,
      },
    ],
    login: 'user-login',
    username: 'user-login',
    displayName: 'User Flynn',
    mfaEnabled: true,
    role: 'Maintainer',
    siteAdmin: false,
  });
});

describe('toPullRequestEntity', () => {
  const user = {
    displayName: 'Some Body',
    login: 'somebody',
    username: 'somebody',
  };
  const reviewerUser = {
    displayName: 'Reviewer User',
    login: 'reviewer-user',
    username: 'reviewer-user',
  };
  const apiResponse = {
    title: 'The Best PR Ever',
    number: 420,
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
          login: 'me',
        },
      },
    },
    body: 'This is the description',
    state: 'open',
    head: {
      ref: 'abcdef123456',
    },
    created_at: '2001-09-11T08:46:00Z',
    updated_at: '2001-09-11T20:30:00Z',
    merged_at: null,
    url: 'https://api.github.com/repos/JupiterOne/jupiter-project-repo/pulls/1',
    html_url: 'https://github.com/JupiterOne/jupiter-project-repo/pulls/1',
  };

  const expectedEntity = {
    _type: 'github_pullrequest',
    _class: 'PR',
    _key: `my-team/my-repo/pull-requests/420`,
    name: 'The Best PR Ever',
    displayName: `my-repo/420`,
    id: 420,
    accountLogin: 'me',
    authorLogin: 'somebody',
    author: 'Some Body',
    reviewerLogins: ['reviewer-user'],
    reviewers: ['Reviewer User'],
    approverLogins: ['reviewer-user'],
    approvers: ['Reviewer User'],
    title: 'The Best PR Ever',
    description: `${apiResponse.body.substring(0, 80)}...`,
    state: 'open',
    source: 'abcdef123456',
    target: 'qwerty098765',
    repository: 'my-repo',
    createdOn: toTime(apiResponse.created_at),
    updatedOn: toTime(apiResponse.updated_at),
    webLink: 'https://github.com/JupiterOne/jupiter-project-repo/pulls/1',
    commits: ['commit_a', 'commit_b', 'commit_c'],
    commitMessages: ['Commit A', 'Commit B', 'Commit C'],
    commitsApproved: ['commit_a', 'commit_b'],
    commitsNotApproved: ['commit_c'],
    commitsByUnknownAuthor: [],
    approved: false,
    validated: true,
    _rawData: [
      {
        name: 'default',
        rawData: apiResponse,
      },
    ],
    open: true,
    merged: false,
    declined: false,
  };

  test('with description', () => {
    const entity = toPullRequestEntity(
      apiResponse as any,
      [
        { sha: 'commit_a', commit: { message: 'Commit A' } } as any,
        { sha: 'commit_b', commit: { message: 'Commit B' } } as any,
        { sha: 'commit_c', commit: { message: 'Commit C' } } as any,
      ],
      [{ sha: 'commit_a' } as any, { sha: 'commit_b' } as any],
      [],
      [{ approverUsernames: ['reviewer-user'] } as any],
      {
        [user.login]: user as UserEntity,
        [reviewerUser.login]: reviewerUser as UserEntity,
      }
    );
    expect(entity).toEqual(expectedEntity);
  });

  test('without description', () => {
    const apiResponseWithoutDescription = {
      ...apiResponse,
      body: null,
    };
    const entity = toPullRequestEntity(
      apiResponseWithoutDescription as any,
      [
        { sha: 'commit_a', commit: { message: 'Commit A' } } as any,
        { sha: 'commit_b', commit: { message: 'Commit B' } } as any,
        { sha: 'commit_c', commit: { message: 'Commit C' } } as any,
      ],
      [{ sha: 'commit_a' } as any, { sha: 'commit_b' } as any],
      [],
      [{ approverUsernames: ['reviewer-user'] } as any],
      {
        [user.login]: user as UserEntity,
        [reviewerUser.login]: reviewerUser as UserEntity,
      }
    );
    expect(entity).toEqual({
      ...expectedEntity,
      description: undefined,
      _rawData: [
        {
          name: 'default',
          rawData: apiResponseWithoutDescription,
        },
      ],
    });
  });

  test('declined', () => {
    const apiResponseDeclined = {
      ...apiResponse,
      state: PRState.Closed,
    };
    const entity = toPullRequestEntity(
      apiResponseDeclined as any,
      [
        { sha: 'commit_a', commit: { message: 'Commit A' } } as any,
        { sha: 'commit_b', commit: { message: 'Commit B' } } as any,
        { sha: 'commit_c', commit: { message: 'Commit C' } } as any,
      ],
      [{ sha: 'commit_a' } as any, { sha: 'commit_b' } as any],
      [],
      [{ approverUsernames: ['reviewer-user'] } as any],
      {
        [user.login]: user as UserEntity,
        [reviewerUser.login]: reviewerUser as UserEntity,
      }
    );
    expect(entity).toEqual({
      ...expectedEntity,
      state: PRState.Closed,
      open: false,
      declined: true,
      _rawData: [
        {
          name: 'default',
          rawData: apiResponseDeclined,
        },
      ],
    });
  });

  test('without commit analysis', () => {
    const entity = toPullRequestEntity(apiResponse as any);
    expect(entity).toEqual({
      ...expectedEntity,
      approved: undefined,
      validated: undefined,
      commits: undefined,
      commitMessages: undefined,
      commitsApproved: undefined,
      commitsNotApproved: undefined,
      commitsByUnknownAuthor: undefined,
      approvers: undefined,
      approverLogins: undefined,
      author: 'somebody',
      reviewers: ['reviewer-user'],
    });
  });
});

test('toOrganizationMemberRelationships', () => {
  const relationship = toOrganizationHasMemberRelationship(
    { _key: 'account-key' } as any,
    { _key: 'user-key' } as any
  );
  expect(relationship).toEqual({
    _key: 'account-key|has|user-key',
    _type: 'github_account_has_user',
    _class: 'HAS',
    _fromEntityKey: 'account-key',
    _toEntityKey: 'user-key',
  });
});

test('toAccountRepoRelationships', () => {
  const relationship = toAccountOwnsRepoRelationship(
    { _key: 'account-key' } as any,
    { _key: 'repo-key' } as any
  );
  expect(relationship).toEqual({
    _key: 'account-key|owns|repo-key',
    _type: 'github_account_owns_repo',
    _class: 'OWNS',
    _fromEntityKey: 'account-key',
    _toEntityKey: 'repo-key',
  });
});

test('toRepoPullRequestRelationship', () => {
  const relationship = toRepoHasPullRequestRelationship(
    { _key: 'repo-key' } as RepoEntity,
    { _key: 'pr-key' } as PullRequestEntity
  );
  expect(relationship).toEqual({
    _key: 'repo-key|has|pr-key',
    _type: 'github_repo_has_pullrequest',
    _class: 'HAS',
    _fromEntityKey: 'repo-key',
    _toEntityKey: 'pr-key',
  });
});

test('toUserPullRequestRelationship', () => {
  const relationship = toUserOpenedPullRequestRelationship(
    { _key: 'user-key' } as UserEntity,
    { _key: 'pr-key' } as PullRequestEntity
  );
  expect(relationship).toEqual({
    _key: 'user-key|opened|pr-key',
    _type: 'github_user_opened_pullrequest',
    _class: 'OPENED',
    _fromEntityKey: 'user-key',
    _toEntityKey: 'pr-key',
  });
});
