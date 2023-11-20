import PullRequestsQuery, {
  buildQuery,
  processResponseData,
} from './PullRequestsQuery';
import { emptyPullRequest, pullRequestsPublic } from './testResponses';

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
  });
});
