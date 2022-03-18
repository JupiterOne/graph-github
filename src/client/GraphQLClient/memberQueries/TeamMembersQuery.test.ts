import TeamMembersQuery from './TeamMembersQuery';
import { teamMembers } from './testResponses';

describe('TeamMemberQuery', () => {
  test('pagination of team members', async () => {
    // Arrange
    const login = 'J1-Test';
    const teamSlug = 'j1-ingest-eng';
    const executor = jest
      .fn()
      .mockResolvedValueOnce(teamMembers[0])
      .mockResolvedValueOnce(teamMembers[1])
      .mockRejectedValue(
        new Error(
          'Pagination failed to stop! This response should never be reached.',
        ),
      );
    const iteratee = jest.fn();

    // Act
    const { rateLimitConsumed } = await TeamMembersQuery.iterateMembers(
      { login, teamSlug },
      executor,
      iteratee,
    );

    // Assert
    expect(rateLimitConsumed).toBe(3);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0].queryVariables).toEqual({
      maxLimit: 100,
      login,
      teamSlug,
    });
    expect(executor.mock.calls[1][0].queryVariables).toEqual({
      maxLimit: 100,
      memberCursor: 'more2come',
      login,
      teamSlug,
    });
    expect(executor.mock.calls[1][0].query).toMatchSnapshot();
    expect(iteratee).toHaveBeenCalledTimes(4);
    expect(iteratee.mock.calls[3][0]).toEqual({
      id: 'm4',
      login: 'SSM',
      name: 'Silvia Smith',
      role: 'MAINTAINER',
      teamId: 'T_kwDOBfl5Zc4AWFtb',
    });
  });
});
