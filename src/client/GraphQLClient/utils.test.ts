import utils from './utils';

describe('utils', () => {
  test('hasProperties', () => {
    expect(utils.hasProperties(null)).toBeFalsy();
    expect(utils.hasProperties(undefined)).toBeFalsy();
    expect(utils.hasProperties({})).toBeFalsy();
    expect(utils.hasProperties(new Object())).toBeFalsy();
    expect(utils.hasProperties({ dog: 'dog' })).toBeTruthy();
  });
  test('innerResourcePaginationRequired', () => {
    expect(utils.innerResourcePaginationRequired(null)).toBeFalsy();
    expect(utils.innerResourcePaginationRequired(undefined)).toBeFalsy();
    expect(utils.innerResourcePaginationRequired({})).toBeFalsy();
    expect(
      utils.innerResourcePaginationRequired({
        commits: { pageInfo: { hasNextPage: true } },
      }),
    ).toBeTruthy();
    expect(utils.innerResourcePaginationRequired({ commits: {} })).toBeFalsy();
    expect(
      utils.innerResourcePaginationRequired({
        labels: { pageInfo: { hasNextPage: true } },
        commits: { pageInfo: {} },
        reviews: {},
      }),
    ).toBeTruthy();
    expect(
      utils.innerResourcePaginationRequired({
        labels: undefined,
        commits: null,
        reviews: { pageInfo: { hasNextPage: true } },
      }),
    ).toBeTruthy();
  });
});
