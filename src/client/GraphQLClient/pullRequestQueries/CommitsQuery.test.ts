import CommitsQuery from './CommitsQuery';
import { commitsQueryResponse } from './testResponses';

describe('CommitsQuery', () => {
  describe('#iterateCommits', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(commitsQueryResponse[0])
        .mockResolvedValueOnce(commitsQueryResponse[1]);

      // Act
      const result = await CommitsQuery.iterateCommits(
        {
          repoOwner: 'J1-Test',
          repoName: 'happy-sunshine',
          pullRequestNumber: 2,
          maxLimit: 25,
        },
        execute,
        iteratee,
      );

      // Assert
      expect(result.totalCost).toBe(3);
      expect(iteratee).toHaveBeenCalledTimes(3);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[2][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
      expect(execute.mock.calls[1][0]).toMatchSnapshot();
    });
  });
});
