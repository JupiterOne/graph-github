import {
  findTeamSlugPositionInAscQuery,
  calculateDesQueryPosition,
  tuneTeamQuery,
} from './tuneTeamQueries';

describe('Testing findTeamSlugPositionInAscQuery', () => {
  test('slug is unique', () => {
    const teamNames = ['dev'];
    expect(findTeamSlugPositionInAscQuery('dev', teamNames)).toEqual(1);
  });

  test('slug is not unique but alphabetically first', () => {
    const teamNames = ['dev-test', 'dev'];
    expect(findTeamSlugPositionInAscQuery('dev', teamNames)).toEqual(1);
  });

  test('slug is not unique and alphabetically not first', () => {
    const teamNames = ['alpha-dev', 'dev'];
    expect(findTeamSlugPositionInAscQuery('dev', teamNames)).toEqual(2);
  });
});

describe('Testing calculateDesQueryPosition', () => {
  test('slug is unique', () => {
    const teamNames = ['dev'];
    expect(calculateDesQueryPosition(teamNames.length, 1)).toEqual(1);
  });

  test('slug is not unique but alphabetically first', () => {
    const teamNames = ['dev-test', 'dev'];
    expect(calculateDesQueryPosition(teamNames.length, 1)).toEqual(2);
  });

  test('slug is not unique and alphabetically not first', () => {
    const teamNames = ['alpha-dev', 'dev'];
    expect(calculateDesQueryPosition(teamNames.length, 2)).toEqual(1);
  });
});

describe('Testing tuneTeamQuery', () => {
  test('slug is unique', () => {
    const teamNames = ['dev'];
    expect(tuneTeamQuery('dev', teamNames)).toEqual({
      first: 1,
      direction: 'ASC',
    });
  });

  test('slug is not unique but alphabetically first', () => {
    const teamNames = ['dev-test', 'dev'];
    expect(tuneTeamQuery('dev', teamNames)).toEqual({
      first: 1,
      direction: 'ASC',
    });
  });

  test('slug is not unique and alphabetically not first', () => {
    const teamNames = ['alpha-dev', 'dev'];
    expect(tuneTeamQuery('dev', teamNames)).toEqual({
      first: 1,
      direction: 'DESC',
    });
  });

  test('slug is not unique and alphabetically stuck in the middle but closer to top', () => {
    const teamNames = ['alpha-dev', 'dev', 'dev-beta', 'dev-delta'];
    expect(tuneTeamQuery('dev', teamNames)).toEqual({
      first: 2,
      direction: 'ASC',
    });
  });

  test('slug is not unique and alphabetically stuck in the middle but closer to end', () => {
    const teamNames = ['alpha-dev', 'dev', 'beta-dev', 'dev-delta'];
    expect(tuneTeamQuery('dev', teamNames)).toEqual({
      first: 2,
      direction: 'DESC',
    });
  });
});
