import OrgRepositoriesQuery from './OrgRepositoriesQuery';
import { emptyOrgRepos, orgRepos } from './testResponses';

describe('OrgRepositoriesQuery', () => {
  test('pagination of org repos', async () => {
    // Arrange
    const login = 'J1-Test';
    const executor = jest
      .fn()
      .mockResolvedValueOnce(orgRepos[0])
      .mockResolvedValueOnce(orgRepos[1]);
    const iteratee = jest.fn();

    // Act
    const { rateLimitConsumed } =
      await OrgRepositoriesQuery.iterateRepositories(login, iteratee, executor);

    // Assert
    expect(rateLimitConsumed).toBe(6);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0].queryVariables).toEqual({
      maxLimit: 100,
      login,
    });
    expect(executor.mock.calls[1][0].queryVariables).toEqual({
      maxLimit: 100,
      repoCursor: 'orgRepoCursorEnd',
      login,
    });
    expect(iteratee).toHaveBeenCalledTimes(5);
    expect(iteratee.mock.calls[4][0]).toEqual({
      id: 'R_5',
      name: 'jumping-shrimp',
    });
  });

  test.each([
    [jest.fn(), jest.fn().mockResolvedValueOnce(emptyOrgRepos[0])],
    [jest.fn(), jest.fn().mockResolvedValueOnce(emptyOrgRepos[1])],
  ])('org handling empty/partial responses', async (iteratee, executor) => {
    // Act
    const { rateLimitConsumed } =
      await OrgRepositoriesQuery.iterateRepositories(
        'J1-Test',
        iteratee,
        executor,
      );

    // Assert
    expect(rateLimitConsumed).toBe(1);
    expect(iteratee).not.toHaveBeenCalled();
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
