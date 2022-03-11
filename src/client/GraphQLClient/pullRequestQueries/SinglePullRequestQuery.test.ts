import SinglePullRequestQuery from './SinglePullRequestQuery';
import {
  singleQueryFullResponse,
  singleQueryInnerResourcePaginationComplete,
  singleQueryWithPartialInnerResources,
} from './testResponses';

describe('SinglePullRequestQuery', () => {
  describe('#buildQuery', () => {
    test('first query - no cursors', () => {
      const executableQuery = SinglePullRequestQuery.buildQuery(
        5,
        'musical-palm-tree',
        'J1-Test',
      );

      expect(executableQuery).toMatchSnapshot();
    });

    test('followup query with cursors', () => {
      const queryState = {
        commits: { hasNextPage: false },
        reviews: { hasNextPage: false },
        labels: { hasNextPage: true, endCursor: 'labelsEndCursor' },
      };

      const executableQuery = SinglePullRequestQuery.buildQuery(
        5,
        'musical-palm-tree',
        'J1-Test',
        queryState,
      );

      expect(executableQuery).toMatchSnapshot();
    });
  });

  describe('#processResponseData', () => {
    test('Pulling all data out', () => {
      const result = SinglePullRequestQuery.processResponseData(
        singleQueryFullResponse,
      );

      expect(result).toMatchSnapshot();
    });
    test('Pulls partial data', () => {
      const result = SinglePullRequestQuery.processResponseData(
        singleQueryWithPartialInnerResources,
      );

      expect(result).toMatchSnapshot();
    });
  });

  describe('#query', () => {
    test('successfully paginates', async () => {
      // Arrange
      const repo = {
        pullRequestNumber: 4,
        repoName: 'musical-palm-tree',
        repoOwner: 'J1-Test',
      };

      const executor = jest
        .fn()
        .mockResolvedValueOnce(singleQueryFullResponse)
        .mockResolvedValueOnce(singleQueryInnerResourcePaginationComplete);
      const iteratee = jest.fn();

      // Act
      const { rateLimitConsumed } = await SinglePullRequestQuery.query(
        repo,
        iteratee,
        executor,
      );

      // Assert
      expect(rateLimitConsumed).toBe(2);
      expect(executor).toHaveBeenCalledTimes(2);
      expect(executor.mock.calls[0][0].queryVariables).toEqual({
        // no cursors are include on initial call
        maxLimit: 100,
        pullRequestNumber: 4,
        repoName: 'musical-palm-tree',
        repoOwner: 'J1-Test',
      });
      expect(executor.mock.calls[1][0].queryVariables).toEqual({
        // commitsCursor is not included
        labelsCursor: 'Y3Vyc2==',
        reviewsCursor: 'Y3Vyc29yOnYyOpO0M',
        maxLimit: 100,
        pullRequestNumber: 4,
        repoName: 'musical-palm-tree',
        repoOwner: 'J1-Test',
      });

      expect(iteratee).toHaveBeenCalledTimes(1);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
