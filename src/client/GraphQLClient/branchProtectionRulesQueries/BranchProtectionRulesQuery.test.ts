import BranchProtectionRulesQuery from './BranchProtectionRulesQuery';
import { branchProtectionRulesResponses } from './testResponses';
import { validate } from '@octokit/graphql-schema';

describe('BranchProtectionRulesQuery', () => {
  describe('#iterateBranchProtectionRules', () => {
    test('Pulling data out', async () => {
      const mockGheVersions = ['3.4.0', '3.5.0', '3.6.0'];

      for (const version of mockGheVersions) {
        const execute = jest
          .fn()
          .mockResolvedValue(branchProtectionRulesResponses[0]);

        const iteratee = jest.fn();

        // Act
        const result =
          await BranchProtectionRulesQuery.iterateBranchProtectionRules(
            {
              repoOwner: 'J1-Test',
              repoName: 'happy-sunshine',
              gheServerVersion: version,
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
        expect(execute.mock.calls[0][0]).toHaveProperty('query');
        expect(() => validate(execute.mock.calls[0][0].query)).not.toThrow();
        expect(execute.mock.calls[0][0]).toMatchSnapshot();
      }
    });
  });
});
