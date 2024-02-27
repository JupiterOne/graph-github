import { request as Request } from '@octokit/request';
import { getAuthStrategy } from './auth';
import { IntegrationConfig } from '../config';
import { getFromCache } from './cache';
import fetch from 'node-fetch';

export async function getMetaResponse(config: IntegrationConfig) {
  const authStrategy = getAuthStrategy(config);
  const request = Request.defaults({
    request: {
      fetch: fetch,
      hook: authStrategy.hook,
    },
  });
  const response = await getFromCache('GET /meta', async () =>
    request('GET /meta'),
  );
  return response;
}
