import BranchProtectionRulesQuery from './BranchProtectionRulesQuery';
import { branchProtectionRulesReponses } from './testResponses';

describe('BranchProtectionRulesQuery', () => {
  describe('#iterateBranchProtectionRules', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(branchProtectionRulesReponses[0]);

      // Act
      const result =
        await BranchProtectionRulesQuery.iterateBranchProtectionRules(
          {
            repoOwner: 'J1-Test',
            repoName: 'happy-sunshine',
          },
          execute,
          iteratee,
        );

      console.log(`total cost`, result.totalCost);
      // Assert
      expect(result.totalCost).toBe(0);
      expect(iteratee).toHaveBeenCalledTimes(2);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
