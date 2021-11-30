import { mapResponseCursorsForQuery, responseHasNextPage } from './response';

describe('mapResponseCursorsForQuery', () => {
  test('returns the base cursor', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {},
      },
    };

    expect(mapResponseCursorsForQuery(cursors)).toEqual({
      teams: 'teamsSelfCursor',
    });
  });

  test('returns the base cursor and the child cursors', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              children: {},
            },
          ],
        },
      },
    };

    expect(mapResponseCursorsForQuery(cursors)).toEqual({
      teams: 'teamsSelfCursor',
      teamMembers: 'teamMembersSelfCursorOne',
    });
  });

  test('returns cursors for siblings', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              children: {},
            },
          ],
          teamRepositories: [
            {
              self: 'teamRepositoriesSelfCursor',
              children: {},
            },
          ],
        },
      },
      repositories: {
        self: 'repositoriesSelfCursor',
        children: {},
      },
    };

    expect(mapResponseCursorsForQuery(cursors)).toEqual({
      teams: 'teamsSelfCursor',
      teamMembers: 'teamMembersSelfCursorOne',
      teamRepositories: 'teamRepositoriesSelfCursor',
      repositories: 'repositoriesSelfCursor',
    });
  });

  test('resurns all nested cursors', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              children: {
                teamMemberRepositories: [
                  {
                    self: 'teamMemberRepositoriesSelfCursor',
                    children: {},
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(mapResponseCursorsForQuery(cursors)).toEqual({
      teams: 'teamsSelfCursor',
      teamMembers: 'teamMembersSelfCursorOne',
      teamMemberRepositories: 'teamMemberRepositoriesSelfCursor',
    });
  });
});

describe('responseHasNextPage', () => {
  test('false if parent and child both do not have a next page', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        hasNextPage: false,
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              hasNextPage: false,
              children: {
                teamMemberRepositories: [
                  {
                    self: 'teamMemberRepositoriesSelfCursor',
                    hasNextPage: false,
                    children: {},
                  },
                ],
              },
            },
          ],
        },
      },
    };
    expect(responseHasNextPage(cursors)).toBe(false);
  });

  test('true if nested child has next page', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        hasNextPage: false,
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              hasNextPage: false,
              children: {
                teamMemberRepositories: [
                  {
                    self: 'teamMemberRepositoriesSelfCursor',
                    hasNextPage: true,
                    children: {},
                  },
                ],
              },
            },
          ],
        },
      },
    };
    expect(responseHasNextPage(cursors)).toBe(true);
  });

  test('true if first child has next page', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        hasNextPage: false,
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              hasNextPage: true,
              children: {
                teamMemberRepositories: [
                  {
                    self: 'teamMemberRepositoriesSelfCursor',
                    hasNextPage: false,
                    children: {},
                  },
                ],
              },
            },
          ],
        },
      },
    };
    expect(responseHasNextPage(cursors)).toBe(true);
  });

  test('true if parent has next page', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        hasNextPage: true,
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              hasNextPage: false,
              children: {
                teamMemberRepositories: [
                  {
                    self: 'teamMemberRepositoriesSelfCursor',
                    hasNextPage: false,
                    children: {},
                  },
                ],
              },
            },
          ],
        },
      },
    };
    expect(responseHasNextPage(cursors)).toBe(true);
  });
});
