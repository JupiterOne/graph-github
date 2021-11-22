import { mapResponseCursorsForQuery } from './response';

describe('mapResponseCursorsForQuery', () => {
  test('returns self when hierarchy has no children', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {},
      },
    };

    expect(mapResponseCursorsForQuery(cursors, {})).toEqual({
      teams: 'teamsSelfCursor',
    });
  });

  test('returns cursor of first child', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {
          teamMembers: [
            {
              self: 'teamMembersSelfCursorOne',
              children: {},
            },
            {
              self: 'teamMembersSelfCursorTwo',
              children: {},
            },
          ],
        },
      },
    };

    expect(mapResponseCursorsForQuery(cursors, {})).toEqual({
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
            {
              self: 'teamMembersSelfCursorTwo',
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

    expect(mapResponseCursorsForQuery(cursors, {})).toEqual({
      teamMembers: 'teamMembersSelfCursorOne',
      teamRepositories: 'teamRepositoriesSelfCursor',
      repositories: 'repositoriesSelfCursor',
    });
  });

  test('returns most nested cursor', () => {
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

    expect(mapResponseCursorsForQuery(cursors, {})).toEqual({
      teamMemberRepositories: 'teamMemberRepositoriesSelfCursor',
    });
  });

  test("returns parent's previous cursor when child is introduced", () => {
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

    expect(
      mapResponseCursorsForQuery(cursors, {
        teams: 'teamsPreviousCursor',
      }),
    ).toEqual({
      teams: 'teamsPreviousCursor',
      teamMembers: 'teamMembersSelfCursorOne',
    });
  });

  test('return new cursor if hierarchy has no children', () => {
    const cursors = {
      teams: {
        self: 'teamsSelfCursor',
        children: {},
      },
    };

    expect(
      mapResponseCursorsForQuery(cursors, {
        teams: 'teamsPreviousCursor',
      }),
    ).toEqual({
      teams: 'teamsSelfCursor',
    });
  });
});
