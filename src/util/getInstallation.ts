import { Octokit } from '@octokit/rest';

import GitHubApp from '../client/GitHubApp';

export default async function getInstallation(
  appClient: Octokit,
  installationId: number
) {
  const app = new GitHubApp(appClient);
  const installation = await app.getInstallation(installationId);
  return installation;
}
