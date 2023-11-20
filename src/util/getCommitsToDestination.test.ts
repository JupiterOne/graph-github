import { Commit } from '../client/GraphQLClient';
import getCommitsToDestination from './getCommitsToDestination';

describe('getCommitsToDestination', () => {
  test('should return an empty array when there is no destination commit sha', () => {
    const commits: Commit[] = [
      {
        pullRequestId: 'test-id',
        oid: 'oid',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
    ];
    const destination = undefined;
    expect(getCommitsToDestination(commits, destination)).toHaveLength(0);
  });

  test('should return an empty array when the destination commit is not found', () => {
    const commits: Commit[] = [
      {
        pullRequestId: 'test-id',
        oid: 'oid1',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid2',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid3',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
    ];
    const destination = 'oid4';
    expect(getCommitsToDestination(commits, destination)).toHaveLength(0);
  });

  test('should return the correct commits when all shas are the same size', () => {
    const commits: Commit[] = [
      {
        pullRequestId: 'test-id',
        oid: 'oid1',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid2',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid3',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
    ];
    const destination = 'oid2';
    expect(getCommitsToDestination(commits, destination)).toEqual(
      commits.slice(0, 2),
    );
  });

  test('should return the correct commits with shortened shas', () => {
    const commits: Commit[] = [
      {
        pullRequestId: 'test-id',
        oid: 'oid1oid1oid1oid1oid1',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid2oid2oid2oid2oid2',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
      {
        pullRequestId: 'test-id',
        oid: 'oid3oid3oid3oid3oid3',
        message: 'message',
        authoredDate: 'authoredDate',
        author: {},
      },
    ];
    const destination = 'oid2';
    expect(getCommitsToDestination(commits, destination)).toEqual(
      commits.slice(0, 2),
    );
  });
});
