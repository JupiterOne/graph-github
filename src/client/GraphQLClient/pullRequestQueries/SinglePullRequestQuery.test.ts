import SinglePullRequestQuery, {
  buildQuery,
  processResponseData,
} from './SinglePullRequestQuery';
import {
  singleQueryFullResponse,
  singleQueryInnerResourcePaginationComplete,
  singleQueryWithPartialInnerResources,
} from './testResponses';

describe('SinglePullRequestQuery', () => {
  describe('#buildQuery', () => {
    test('first query - no cursors', () => {
      const executableQuery = buildQuery(
        {
          pullRequestNumber: 5,
          repoName: 'musical-palm-tree',
          repoOwner: 'J1-Test',
        },
        { isInitialQuery: true },
      );

      expect(executableQuery).toMatchSnapshot();
    });

    test('followup query with cursors', () => {
      const queryState = {
        commits: { hasNextPage: false },
        reviews: { hasNextPage: false },
        labels: { hasNextPage: true, endCursor: 'labelsEndCursor' },
      };

      const executableQuery = buildQuery(
        {
          pullRequestNumber: 5,
          repoName: 'musical-palm-tree',
          repoOwner: 'J1-Test',
        },
        queryState,
      );

      expect(executableQuery).toMatchSnapshot();
    });

    test('followup query with partial cursors', () => {
      // 'reviews' was not included in this followup query because
      // there was nothing to paginate.
      const queryState = {
        commits: {
          endCursor: 'MQ',
          hasNextPage: false,
        },
        labels: {
          endCursor: 'Y3Vyc2==',
          hasNextPage: true,
        },
        reviews: undefined,
      };

      const executableQuery = buildQuery(
        {
          pullRequestNumber: 5,
          repoName: 'musical-palm-tree',
          repoOwner: 'J1-Test',
        },
        queryState,
      );

      expect(executableQuery).toMatchSnapshot();
    });
  });

  describe('#processResponseData', () => {
    test('Pulling all data out', () => {
      const result = processResponseData(singleQueryFullResponse);

      expect(result).toMatchSnapshot();
    });
    test('Pulls partial data', () => {
      const result = processResponseData(singleQueryWithPartialInnerResources);

      expect(result).toMatchSnapshot();
    });
  });

  describe('#iteratePullRequest', () => {
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
        .mockResolvedValueOnce(singleQueryInnerResourcePaginationComplete)
        .mockRejectedValue(
          new Error(
            'Pagination failed to stop! This response should never be reached.',
          ),
        );
      const iteratee = jest.fn();

      // Act
      const { totalCost } = await SinglePullRequestQuery.iteratePullRequest(
        repo,
        executor,
        iteratee,
      );

      // Assert
      expect(totalCost).toBe(2);
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

  test('handle incomplete response data', async () => {
    // Arrange
    const repo = {
      pullRequestNumber: 4,
      repoName: 'musical-not-real',
      repoOwner: 'J1-Test',
    };

    const executor = jest
      .fn()
      .mockResolvedValueOnce({
        rateLimit: {
          limit: 5000,
          cost: 1,
          remaining: 4998,
          resetAt: '2022-03-07T22:04:07Z',
        },
      })
      .mockRejectedValue(
        new Error(
          'Pagination failed to stop! This response should never be reached.',
        ),
      );
    const iteratee = jest.fn();

    // Act
    const { totalCost } = await SinglePullRequestQuery.iteratePullRequest(
      repo,
      executor,
      iteratee,
    );
    expect(totalCost).toBe(1);
    expect(iteratee).not.toHaveBeenCalled();
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
