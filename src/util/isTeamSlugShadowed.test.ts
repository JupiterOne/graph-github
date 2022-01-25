import { isTeamSlugShadowed } from './isTeamSlugShadowed';

describe('test for proper behavior', () => {
  test('slug is unique', () => {
    const teamNames = ['dev'];
    expect(isTeamSlugShadowed('dev', teamNames)).toEqual(false);
  });

  test('slug is not unique but alphabetically first', () => {
    const teamNames = ['dev-test', 'dev'];
    expect(isTeamSlugShadowed('dev', teamNames)).toEqual(false);
  });

  test('slug is not unique and alphabetically not first', () => {
    const teamNames = ['alpha-dev', 'dev'];
    expect(isTeamSlugShadowed('dev', teamNames)).toEqual(true);
  });
});
