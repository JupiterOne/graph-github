import BranchProtectionRulesQuery from './BranchProtectionRulesQuery';
import { branchProtectionRulesResponses } from './testResponses';

describe('BranchProtectionRulesQuery', () => {
  describe('#iterateBranchProtectionRules', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(branchProtectionRulesResponses[0]);

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
