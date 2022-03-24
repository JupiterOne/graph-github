import utils from './utils';

describe('utils', () => {
  test('hasProperties', () => {
    expect(utils.hasProperties(null)).toBeFalsy();
    expect(utils.hasProperties(undefined)).toBeFalsy();
    expect(utils.hasProperties({})).toBeFalsy();
    expect(utils.hasProperties(new Object())).toBeFalsy();
    expect(utils.hasProperties({ dog: 'dog' })).toBeTruthy();
  });
});
