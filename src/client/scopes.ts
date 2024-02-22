import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../config';
import { request as Request } from '@octokit/request';
import { getFromCache } from './cache';
import { getAuthStrategy } from './auth';
import fetch from 'node-fetch';

const appScopes = [
  'actions',
  'administration',
  'discussions',
  'environments',
  'issues',
  'members',
  'metadata',
  'organization_administration',
  'organization_secrets',
  'pages',
  'secret_scanning_alerts',
  'secrets',
  'security_events',
  'vulnerability_alerts',
] as const;
const classicTokenScopes = [
  'admin:org',
  'public_repo',
  'read:enterprise',
  'read:org',
  'read:user',
  'repo',
  'user:email',
] as const;

export type AppScopes = (typeof appScopes)[number];
export type ClassicTokenScopes = (typeof classicTokenScopes)[number];

export type Scopes = AppScopes | ClassicTokenScopes;
export type ScopesSet = Set<Scopes>;

export interface IScopes {
  getScopes(): Promise<ScopesSet | undefined>;
}

export async function fetchScopes(
  config: IntegrationConfig,
): Promise<ScopesSet | undefined> {
  let scopes: ScopesSet | undefined;
  const request = Request.defaults({
    request: {
      fetch: fetch,
      hook: getAuthStrategy(config).hook,
    },
  });

  if (config.selectedAuthType === 'githubEnterpriseToken') {
    const response = await getFromCache('HEAD /', async () =>
      request('HEAD /'),
    );
    const scopesHeader = response.headers['x-oauth-scopes'];
    scopes = scopesHeader
      ? new Set(scopesHeader.split(/,\s+/) as ClassicTokenScopes[])
      : undefined;
  } else {
    const response = await getFromCache(
      'GET /app/installations/{installation_id}',
      async () =>
        request('GET /app/installations/{installation_id}', {
          installation_id: config.installationId,
        }),
    );
    const permissions = Object.keys(response.data.permissions) as AppScopes[];
    scopes = permissions.length ? new Set(permissions) : undefined;
  }
  return scopes;
}

/**
 * A decorator to check if the client has the required scopes before running the method.
 * @param {Array<Scopes | Array<Scopes>>} requiredScopes - The required scopes to run the method.
 *   The scopes in the main array are evaluated as an OR condition.
 *   The scopes in the sub-arrays are evaluated as an AND condition.
 * @param ingestName The name of the ingestion to log if the client does not have the required scopes.
 */
export function AppScopes(requiredScopes: (Scopes | Scopes[])[]) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    return async function (
      this: IScopes & { config: IntegrationConfig; logger: IntegrationLogger },
      ...args: any[]
    ) {
      if (
        !['githubCloud', 'githubEnterpriseServer'].includes(
          this.config.selectedAuthType,
        )
      ) {
        return originalMethod.apply(this, args);
      }

      const scopes = await this.getScopes();
      const { skip } = validateScopes(
        scopes,
        requiredScopes,
        context.name as string,
        this.logger,
      );

      if (skip) {
        return;
      }
      return originalMethod.apply(this, args);
    };
  };
}

export function TokenScopes(requiredScopes: (Scopes | Scopes[])[]) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    return async function (
      this: IScopes & { config: IntegrationConfig; logger: IntegrationLogger },
      ...args: any[]
    ) {
      if (!['githubEnterpriseToken'].includes(this.config.selectedAuthType)) {
        return originalMethod.apply(this, args);
      }

      const scopes = await this.getScopes();
      const { skip } = validateScopes(
        scopes,
        requiredScopes,
        context.name as string,
        this.logger,
      );

      if (skip) {
        return;
      }

      return originalMethod.apply(this, args);
    };
  };
}

function validateScopes(
  currentScopes: ScopesSet | undefined,
  requiredScopes: (Scopes | Scopes[])[],
  methodName: string,
  logger: IntegrationLogger,
) {
  const hasRequiredScopes = requiredScopes.some((requiredScope) => {
    if (Array.isArray(requiredScope)) {
      return requiredScope.every((scope) => currentScopes?.has(scope as any));
    }
    return currentScopes?.has(requiredScope as any);
  });

  if (!currentScopes || !hasRequiredScopes) {
    logger.warn(
      `Skipping ${methodName}. Missing required scopes: ${JSON.stringify(
        requiredScopes,
      )}.`,
    );
    return { skip: true };
  }
  return { skip: false };
}
