import sha from './sha';

test('sha', () => {
  expect(sha('yeet')).toEqual(
    '909104cdb5b06af2606ed4a197b07d09d5ef9a4aad97780c2fe48053bce2be52'
  );
});
