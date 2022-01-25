import {
  findTeamSlugPositionInAscQuery,
  calculateDesQueryPosition,
  tuneTeamQuery,
} from './tuneTeamQueries';

const defaultQueryString =
  'teams(first: 1, query: $slug, orderBy: {field: NAME, direction: ASC})';

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
    expect(tuneTeamQuery('dev', teamNames, defaultQueryString)).toEqual(
      defaultQueryString,
    );
  });

  test('slug is not unique but alphabetically first', () => {
    const teamNames = ['dev-test', 'dev'];
    expect(tuneTeamQuery('dev', teamNames, defaultQueryString)).toEqual(
      defaultQueryString,
    );
  });

  test('slug is not unique and alphabetically not first', () => {
    const teamNames = ['alpha-dev', 'dev'];
    const descQuery =
      'teams(first: 1, query: $slug, orderBy: {field: NAME, direction: DESC})';
    expect(tuneTeamQuery('dev', teamNames, defaultQueryString)).toEqual(
      descQuery,
    );
  });

  test('slug is not unique and alphabetically stuck in the middle but closer to top', () => {
    const teamNames = ['alpha-dev', 'dev', 'dev-beta', 'dev-delta'];
    const modQuery =
      'teams(first: 2, query: $slug, orderBy: {field: NAME, direction: ASC})';
    expect(tuneTeamQuery('dev', teamNames, defaultQueryString)).toEqual(
      modQuery,
    );
  });

  test('slug is not unique and alphabetically stuck in the middle but closer to end', () => {
    const teamNames = ['alpha-dev', 'dev', 'beta-dev', 'dev-delta'];
    const modQuery =
      'teams(first: 2, query: $slug, orderBy: {field: NAME, direction: DESC})';
    expect(tuneTeamQuery('dev', teamNames, defaultQueryString)).toEqual(
      modQuery,
    );
  });
});
