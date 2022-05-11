import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';
import { Octokit } from '@octokit/rest';

import { AppsGetInstallationResponse } from '../types';

export default class GitHubApp {
  constructor(
    /**
     * A GitHub API v3 client associated with the GitHub App access token, used
     * for accessing endpoints listed at https://developer.github.com/v3/apps/.
     */
    readonly v3: Octokit,
  ) {}

  /**
   * Get data for an installation of the GitHub App.
   */
  async getInstallation(
    installationId: number,
  ): Promise<AppsGetInstallationResponse> {
    try {
      const installation = await this.v3.apps.getInstallation({
        installation_id: installationId,
      });

      return installation.data;
    } catch (err) {
      throw new IntegrationValidationError(
        'GitHub App installation associated with this integration instance no longer exists',
      );
    }
  }
}
