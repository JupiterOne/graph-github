import IssuesQuery from './IssuesQuery';
import { issuesResponses } from './testResponses';

describe('IssuesQuery', () => {
  describe('#iterateIssues', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(issuesResponses[0])
        .mockResolvedValueOnce(issuesResponses[1]);

      // Act
      const result = await IssuesQuery.iterateIssues(
        {
          repoFullName: 'J1-Test/happy-sunshine',
          lastExecutionTime: '2011-10-05T14:48:00.000Z',
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
