import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';

import GitHubApp from './GitHubApp';

const installationData = {};
const installationResponse = {
  data: installationData,
};

const mockGitHub: any = {
  apps: {
    getInstallation: jest.fn().mockResolvedValue(installationResponse),
  },
};

test('getInstallation calls GitHub API', async () => {
  const app = new GitHubApp(mockGitHub);
  const installationId = 456;
  const installation = await app.getInstallation(installationId);
  expect(mockGitHub.apps.getInstallation).toHaveBeenCalledWith({
    installation_id: installationId,
  });
  expect(installation).toBe(installationData);
});

test('getInstallation throws IntegrationValidationError', async () => {
  const app = new GitHubApp(mockGitHub);
  mockGitHub.apps.getInstallation.mockImplementation(() => {
    throw new Error('404');
  });
  await expect(app.getInstallation(123)).rejects.toThrow(
    IntegrationValidationError
  );
});
