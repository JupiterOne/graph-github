import {
  aggregateProperties,
  buildPullRequestKey,
  decomposePullRequestKey,
  displayNamesFromLogins,
} from './propertyHelpers';

describe('aggregrateProperties', () => {
  test('returns empty array for undefined collection', () => {
    expect(aggregateProperties('prop', undefined)).toEqual([]);
  });
});

describe('displayNamesFromLogin', () => {
  test('handles missing displayNames', () => {
    expect(
      displayNamesFromLogins(['username1', 'username2'], {
        username1: {
          displayName: 'User Name 1',
        } as any,
        username2: {} as any,
      }),
    ).toEqual(['User Name 1', 'Unknown User']);
  });

  test('handles missing users in map', () => {
    expect(
      displayNamesFromLogins(['username1', 'username2'], {
        username1: {
          displayName: 'User Name 1',
        } as any,
      }),
    ).toEqual(['User Name 1', 'Unknown User']);
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
