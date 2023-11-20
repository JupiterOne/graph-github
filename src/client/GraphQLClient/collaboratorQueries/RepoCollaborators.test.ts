import RepoCollaboratorsQuery from './RepoCollaboratorsQuery';
import { repoCollaborators } from './testResponses';

describe('RepoCollaboratorsQuery', () => {
  describe('#iterateCollaborators', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(repoCollaborators[0])
        .mockResolvedValueOnce(repoCollaborators[1]);

      // Act
      const result = await RepoCollaboratorsQuery.iterateCollaborators(
        {
          login: 'J1-Test',
          repoName: 'happy-sunshine',
          maxLimit: 100,
        },
        execute,
        iteratee,
      );

      // Assert
      expect(result.totalCost).toBe(6);
      expect(iteratee).toHaveBeenCalledTimes(4);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[2][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
      expect(execute.mock.calls[1][0]).toMatchSnapshot();
    });
  });
});
