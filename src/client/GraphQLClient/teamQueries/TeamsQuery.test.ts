import TeamsQuery from './TeamsQuery';
import { teams } from './testResponses';

describe('TeamMembersQuery', () => {
  test('pagination of teams', async () => {
    // Arrange
    const login = 'J1-Test';
    const executor = jest
      .fn()
      .mockResolvedValueOnce(teams[0])
      .mockResolvedValueOnce(teams[1])
      .mockRejectedValue(
        new Error(
          'Pagination failed to stop! This response should never be reached.',
        ),
      );

    const iteratee = jest.fn();

    // Act
    const { totalCost } = await TeamsQuery.iterateTeams(
      { login, maxLimit: 100 },
      executor,
      iteratee,
    );

    // Assert
    expect(totalCost).toBe(3);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0].queryVariables).toEqual({
      maxLimit: 100,
      login,
    });
    expect(executor.mock.calls[1][0].queryVariables).toEqual({
      maxLimit: 100,
      teamCursor: 'more2come',
      login,
    });
    expect(executor.mock.calls[1][0].query).toMatchSnapshot();
    expect(iteratee).toHaveBeenCalledTimes(4);
    expect(iteratee.mock.calls[3][0]).toEqual({
      id: 'T_kwDOBfl5Zc4AWFta',
      name: 'j1-nested-team',
      url: 'https://github.com/orgs/j1-ingest/teams/j1-nested-team',
      slug: 'j1-nested-team',
      createdAt: '2022-03-11T22:03:02Z',
      updatedAt: '2022-03-11T22:03:02Z',
      databaseId: 5790554,
      description: 'Is this team nested?',
      privacy: 'VISIBLE',
    });
  });
});
