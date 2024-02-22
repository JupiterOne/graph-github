import { request as Request } from '@octokit/request';
import { IntegrationConfig } from '../config';
import { getFromCache } from './cache';
import {
  IntegrationError,
  IntegrationProviderAPIError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';
import { AccountType } from '../types';
import { getAuthStrategy } from './auth';
import fetch from 'node-fetch';

export async function fetchOrganizationLogin(config: IntegrationConfig) {
  const request = Request.defaults({
    request: {
      fetch: fetch,
      hook: getAuthStrategy(config).hook,
    },
  });
  let orgLogin: string | undefined;
  if (config.selectedAuthType === 'githubEnterpriseToken') {
    orgLogin = config.organization;
  } else {
    try {
      const {
        data: installation,
        status,
        url,
      } = await getFromCache(
        'GET /app/installations/{installation_id}',
        async () =>
          request('GET /app/installations/{installation_id}', {
            installation_id: config.installationId,
          }),
      );

      if (!installation) {
        throw new IntegrationProviderAPIError({
          endpoint: url,
          status,
          statusText: String(status),
          message: 'Response from GitHub API did not include installation data',
        });
      }

      if (installation.target_type !== AccountType.Org) {
        throw new IntegrationValidationError(
          'Integration supports only GitHub Organization accounts.',
        );
      }

      // TODO: check how to better handle types here
      orgLogin =
        (installation?.account as { login: string } | null)?.login ??
        config.githubAppDefaultLogin;
    } catch (err) {
      throw new IntegrationError({
        code: 'APP_INSTALLATION_NOT_FOUND',
        message:
          'Github App installation associated with this integration instance no longer exists',
        cause: err,
      });
    }
  }
  return orgLogin;
}
