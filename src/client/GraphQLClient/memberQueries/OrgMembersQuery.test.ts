import OrgMembersQuery from './OrgMembersQuery';
import { orgMembers } from './testResponses';

describe('OrgMemberQuery', () => {
  test('pagination of org members', async () => {
    // Arrange
    const login = 'J1-Test';
    const executor = jest
      .fn()
      .mockResolvedValueOnce(orgMembers[0])
      .mockResolvedValueOnce(orgMembers[1])
      .mockRejectedValue(
        new Error(
          'Pagination failed to stop! This response should never be reached.',
        ),
      );
    const iteratee = jest.fn();

    // Act
    const { totalCost } = await OrgMembersQuery.iterateMembers(
      login,
      executor,
      iteratee,
    );

    // Assert
    expect(totalCost).toBe(10);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0].queryVariables).toEqual({
      maxLimit: 100,
      login,
    });
    expect(executor.mock.calls[1][0].queryVariables).toEqual({
      maxLimit: 100,
      memberCursor: 'more2come',
      login,
    });
    expect(executor.mock.calls[1][0].query).toMatchSnapshot();
    expect(iteratee).toHaveBeenCalledTimes(4);
    expect(iteratee.mock.calls[3][0]).toEqual({
      id: 'm_4',
      login: 'spv2',
      name: null,
      isSiteAdmin: false,
      company: null,
      createdAt: '2022-03-10T21:30:13Z',
      databaseId: 101365848,
      email: 'spv2@j1.com',
      isEmployee: false,
      location: null,
      updatedAt: '2022-03-10T21:30:13Z',
      url: 'https://github.com/spv2',
      websiteUrl: null,
      hasTwoFactorEnabled: false,
      role: 'MEMBER',
      organization: 'O_kgDOBfl5ZQ',
    });
  });
});
