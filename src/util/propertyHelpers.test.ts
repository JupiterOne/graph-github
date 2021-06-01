import { aggregateProperties, displayNamesFromLogins } from './propertyHelpers';

describe('aggregrateProperties', () => {
  test('returns empty array for undefined collection', () => {
    expect(aggregateProperties('prop', undefined)).toEqual([]);
  });
});

describe('displayNamesFromLogin', () => {
  test('handles missing displayNames', () => {
    expect(
      displayNamesFromLogins(['username1', 'username2'], {
        username1: {
          displayName: 'User Name 1'
        } as any,
        username2: {} as any
      })
    ).toEqual(['User Name 1', 'Unknown User']);
  });

  test('handles missing users in map', () => {
    expect(
      displayNamesFromLogins(['username1', 'username2'], {
        username1: {
          displayName: 'User Name 1'
        } as any
      })
    ).toEqual(['User Name 1', 'Unknown User']);
  });
});
