import toTime from './toTime';

test('should return number from string', () => {
  const testData: string = '2019-04-22T21:43:53.000Z';
  expect(toTime(testData)).toEqual(1555969433000);
});

test('should return number from Date', () => {
  const testData: Date = new Date('2019-04-22T21:43:53.000Z');
  expect(toTime(testData)).toEqual(1555969433000);
});

test('should return undefined from undefined', () => {
  const testData = undefined;
  expect(toTime(testData)).toEqual(undefined);
});
