import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export type AppScopes =
  | 'members'
  | 'metadata'
  | 'organization_administration'
  | 'organization_secrets'
  | 'secrets'
  | 'environments'
  | 'issues'
  | 'vulnerability_alerts'
  | 'security_events'
  | 'secret_scanning_alerts'
  | 'pages'
  | 'administration'
  | 'discussions';
export type ClassicTokenScopes =
  | 'admin:org'
  | 'read:enterprise'
  | 'read:user'
  | 'repo'
  | 'user:email';
export type Scopes = AppScopes | ClassicTokenScopes;
export type ScopesSet = Set<Scopes>;

export interface IScopes {
  getScopes(): Promise<ScopesSet | undefined>;
}

/**
 * A decorator to check if the client has the required scopes before running the method.
 * @param {Array<Scopes | Array<Scopes>>} requiredScopes - The required scopes to run the method.
 *   The scopes in the main array are evaluated as an OR condition.
 *   The scopes in the sub-arrays are evaluated as an AND condition.
 * @param ingestName The name of the ingestion to log if the client does not have the required scopes.
 */
export function scope(
  requiredScopes: (Scopes | Scopes[])[],
  ingestName: string,
) {
  return function (originalMethod: any, _context: ClassMethodDecoratorContext) {
    return async function (this: IScopes, ...args: any[]) {
      const scopes = await this.getScopes();
      const hasRequiredScopes = requiredScopes.some((requiredScope) => {
        if (Array.isArray(requiredScope)) {
          return requiredScope.every((scope) => scopes?.has(scope as any));
        }
        return scopes?.has(requiredScope as any);
      });

      if (!scopes || !hasRequiredScopes) {
        ((this as any).logger as IntegrationLogger | undefined)?.warn(
          `Skipping ${ingestName} ingestion. Missing required scopes: ${JSON.stringify(
            requiredScopes,
          )}.`,
        );
        return;
      }

      return originalMethod.apply(this, args);
    };
  };
}
