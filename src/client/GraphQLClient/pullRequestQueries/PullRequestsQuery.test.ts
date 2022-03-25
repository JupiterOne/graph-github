import PullRequestsQuery, {
  buildQuery,
  processResponseData,
} from './PullRequestsQuery';
import {
  emptyPullRequest,
  pullRequestsPublic,
  pullRequestsPublicInnerPagination,
  singleQueryFullResponse,
  singleQueryInnerResourcePaginationComplete,
} from './testResponses';

describe('PullRequestsQuery', () => {
  describe('#buildQuery', () => {
    test('first query - no query state', () => {
      // Act
      const executableQuery = buildQuery({
        fullName: 'J1-Test/musical-palm-tree',
        public: true,
        lastExecutionTime: '2011-10-05T14:48:00.000Z',
      });

      // Assert
      expect(executableQuery).toMatchSnapshot();
    });

    test('query with query state', () => {
      // Arrange
      const queryState = {
        pullRequests: { hasNextPage: true, endCursor: 'endCursor' },
      };

      // Act
      const executableQuery = buildQuery(
        {
          fullName: 'J1-Test/musical-palm-tree',
          public: true,
          lastExecutionTime: '2011-10-05T14:48:00.000Z',
        },
        queryState,
      );

      // Assert
      expect(executableQuery).toMatchSnapshot();
    });
  });

  describe('#processResponseData', () => {
    test('Pulling data out with no inner resource pagination', async () => {
      // Arrange
      const iteratee = jest.fn();
      const addToQueue = jest.fn();

      // Act
      const result = await processResponseData(
        pullRequestsPublic[0],
        iteratee,
        addToQueue,
      );

      // Assert
      expect(result).toMatchSnapshot();
      expect(iteratee).toHaveBeenCalledTimes(2);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
      expect(addToQueue).not.toHaveBeenCalled();
    });
    test('Skips resources with inner resource pagination', async () => {
      // Arrange
      const iteratee = jest.fn();
      const addToQueue = jest.fn();

      // Act
      const result = await processResponseData(
        pullRequestsPublicInnerPagination,
        iteratee,
        addToQueue,
      );

      // Assert
      expect(result).toMatchSnapshot();
      expect(iteratee).toHaveBeenCalledTimes(0);
      expect(addToQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('#iteratePullRequests', () => {
    test('Pulling data out with no inner resource pagination', async () => {
      // Arrange
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(pullRequestsPublic[0])
        .mockResolvedValueOnce(pullRequestsPublic[1]);

      // Act
      const result = await PullRequestsQuery.iteratePullRequests(
        {
          fullName: 'J1-Test/happy-sunshine',
          public: true,
          lastExecutionTime: '2011-10-05T14:48:00.000Z',
        },
        execute,
        iteratee,
      );

      // Assert
      expect(result.totalCost).toBe(3);
      expect(iteratee).toHaveBeenCalledTimes(3);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
      expect(execute.mock.calls[1][0]).toMatchSnapshot();
    });

    test('Pulling data out with inner resource pagination', async () => {
      // Arrange
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(pullRequestsPublicInnerPagination) // Entity is not used, but queued for single query
        .mockResolvedValueOnce(singleQueryFullResponse) // Part 1 of inner resources single query
        .mockResolvedValueOnce(singleQueryInnerResourcePaginationComplete) // Part 2 of inner resources single query
        .mockRejectedValue(
          new Error(
            'Pagination failed to stop! This response should never be reached.',
          ),
        );

      // Act
      const { totalCost } = await PullRequestsQuery.iteratePullRequests(
        {
          fullName: 'J1-Test/happy-sunshine',
          public: true,
          lastExecutionTime: '2011-10-05T14:48:00.000Z',
        },
        execute,
        iteratee,
      );

      // Assert
      expect(totalCost).toBe(3);
      expect(iteratee).toHaveBeenCalledTimes(1);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(3);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
      expect(execute.mock.calls[1][0]).toMatchSnapshot();
      expect(execute.mock.calls[2][0]).toMatchSnapshot();
    });

    test('handle empty/partial responses', async () => {
      // Arrange
      const iteratee = jest.fn();
      const execute = jest.fn().mockResolvedValueOnce(emptyPullRequest[0]);

      // Act
      const { totalCost } = await PullRequestsQuery.iteratePullRequests(
        {
          fullName: 'J1-Test/happy-sunshine',
          public: true,
          lastExecutionTime: '2011-10-05T14:48:00.000Z',
        },
        execute,
        iteratee,
      );

      // Assert
      expect(totalCost).toBe(1);
      expect(iteratee).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
