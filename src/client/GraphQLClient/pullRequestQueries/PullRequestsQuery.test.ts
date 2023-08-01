import PullRequestsQuery, {
  buildQuery,
  processResponseData,
} from './PullRequestsQuery';
import {
  emptyPullRequest,
  pullRequestsPublic,
  oneByOneResponses,
} from './testResponses';

describe('PullRequestsQuery', () => {
  describe('#buildQuery', () => {
    test('first query - no query state', () => {
      // Act
      const executableQuery = buildQuery({
        fullName: 'J1-Test/musical-palm-tree',
        public: true,
        ingestStartDatetime: '2011-10-05T14:48:00.000Z',
        maxResourceIngestion: 500,
        maxSearchLimit: 25,
      });

      // Assert
      expect(executableQuery).toMatchSnapshot();
    });

    test('first private query - no query state', () => {
      // Act
      const executableQuery = buildQuery({
        fullName: 'J1-Test/musical-palm-tree',
        public: false,
        ingestStartDatetime: '2011-10-05T14:48:00.000Z',
        maxResourceIngestion: 500,
        maxSearchLimit: 25,
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
          ingestStartDatetime: '2011-10-05T14:48:00.000Z',
          maxResourceIngestion: 500,
          maxSearchLimit: 25,
        },
        queryState,
      );

      // Assert
      expect(executableQuery).toMatchSnapshot();
    });
  });

  describe('#processResponseData', () => {
    test('Pulling data out', async () => {
      // Arrange
      const iteratee = jest.fn();

      // Act
      const result = await processResponseData(pullRequestsPublic[0], iteratee);

      // Assert
      expect(result).toMatchSnapshot();
      expect(iteratee).toHaveBeenCalledTimes(2);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
    });
  });

  describe('#iteratePullRequests', () => {
    test('Pulling data out', async () => {
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
          ingestStartDatetime: '2011-10-05T14:48:00.000Z',
          maxResourceIngestion: 500,
          maxSearchLimit: 25,
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

    test('handle empty/partial responses', async () => {
      // Arrange
      const iteratee = jest.fn();
      const execute = jest.fn().mockResolvedValueOnce(emptyPullRequest[0]);

      // Act
      const { totalCost } = await PullRequestsQuery.iteratePullRequests(
        {
          fullName: 'J1-Test/happy-sunshine',
          public: true,
          ingestStartDatetime: '2011-10-05T14:48:00.000Z',
          maxResourceIngestion: 500,
          maxSearchLimit: 25,
        },
        execute,
        iteratee,
      );

      // Assert
      expect(totalCost).toBe(1);
      expect(iteratee).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    });

    test('fetch one-by-one when it receives timeout issue', async () => {
      // Arrange
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(oneByOneResponses[0])
        .mockRejectedValueOnce(new Error('This may be the result of a timeout'))
        .mockResolvedValueOnce(oneByOneResponses[1])
        .mockResolvedValueOnce(oneByOneResponses[2])
        .mockResolvedValueOnce(oneByOneResponses[3]);

      // Act
      const { totalCost } = await PullRequestsQuery.iteratePullRequests(
        {
          fullName: 'jupiterone-sandbox/test-repo1',
          public: false,
          ingestStartDatetime: '1970-01-01T00:00:00.000Z',
          maxResourceIngestion: 500,
          maxSearchLimit: 2,
        },
        execute,
        iteratee,
      );

      // Assert
      expect(totalCost).toBe(4);
      expect(execute).toHaveBeenCalledTimes(5);
      // Start with default maxSearchLimit = 2
      expect(execute.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          queryVariables: expect.objectContaining({
            maxSearchLimit: 2,
          }),
        }),
      );
      // Receives error on second call
      expect(execute.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          queryVariables: expect.objectContaining({
            maxSearchLimit: 2,
          }),
        }),
      );
      // Start request with maxSearchLimit = 1
      expect(execute.mock.calls[2][0]).toEqual(
        expect.objectContaining({
          queryVariables: expect.objectContaining({
            maxSearchLimit: 1,
          }),
        }),
      );
      // Last request with maxSearchLimit = 1
      expect(execute.mock.calls[3][0]).toEqual(
        expect.objectContaining({
          queryVariables: expect.objectContaining({
            maxSearchLimit: 1,
          }),
        }),
      );
      // Go back to request with maxSearchLimit = 2
      expect(execute.mock.calls[4][0]).toEqual(
        expect.objectContaining({
          queryVariables: expect.objectContaining({
            maxSearchLimit: 2,
          }),
        }),
      );
      expect(iteratee).toHaveBeenCalledTimes(6);
    });
  });
});
