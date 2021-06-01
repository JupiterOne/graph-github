import getInstallationId from './getInstallationId';

const installationId = '123';
const context = {
  instance: {
    config: {}
  }
} as any;

test('converts string to number', () => {
  context.instance.config.installationId = installationId;
  const id = getInstallationId(context);
  expect(id).toEqual(123);
});

test('error when misconfigured', () => {
  delete context.instance.config.installationId;
  expect(() => getInstallationId(context)).toThrow(/No installationId found/);
});
