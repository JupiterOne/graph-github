import TeamRepositoriesQuery from './TeamRepositoriesQuery';
import { emptyTeamRepos, teamRepos } from './testResponses';

describe('TeamRepositoriesQuery', () => {
  test('pagination of team repos', async () => {
    // Arrange
    const login = 'J1-Test';
    const teamSlug = 'eng';
    const executor = jest
      .fn()
      .mockResolvedValueOnce(teamRepos[0])
      .mockResolvedValueOnce(teamRepos[1])
      .mockRejectedValue(
        new Error(
          'Pagination failed to stop! This response should never be reached.',
        ),
      );

    const iteratee = jest.fn();

    // Act
    const { totalCost } = await TeamRepositoriesQuery.iterateRepositories(
      {
        login: 'J1-Test',
        teamSlug: 'eng',
      },
      executor,
      iteratee,
    );

    // Assert
    expect(totalCost).toBe(2);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0].queryVariables).toEqual({
      maxLimit: 100,
      login,
      teamSlug,
    });
    expect(executor.mock.calls[1][0].queryVariables).toEqual({
      maxLimit: 100,
      teamRepoCursor: 'Y3Vyc29yOnYyOpHOG_MJdQ',
      login,
      teamSlug,
    });
    expect(iteratee).toHaveBeenCalledTimes(6);
    expect(iteratee.mock.calls[5][0]).toEqual({
      id: 'R_6',
      permission: 'WRITE',
    });
  });

  test.each([
    [jest.fn(), jest.fn().mockResolvedValueOnce(emptyTeamRepos[0])],
    [jest.fn(), jest.fn().mockResolvedValueOnce(emptyTeamRepos[1])],
    [jest.fn(), jest.fn().mockResolvedValueOnce(emptyTeamRepos[2])],
  ])('team handling empty/partial responses', async (iteratee, executor) => {
    // Act
    const { totalCost } = await TeamRepositoriesQuery.iterateRepositories(
      {
        login: 'J1-Test',
        teamSlug: 'eng',
      },
      executor,
      iteratee,
    );

    // Assert
    expect(totalCost).toBe(1);
    expect(iteratee).not.toHaveBeenCalled();
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
