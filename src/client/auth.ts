import { StrategyOptions, createAppAuth } from '@octokit/auth-app';
import { IntegrationConfig } from '../config';
import { createTokenAuth } from '@octokit/auth-token';
import { getFromCacheSync } from './cache';

export function getAuthOptions(config: IntegrationConfig) {
  let authOptions: {
    authStrategy?: typeof createAppAuth;
    auth: string | StrategyOptions;
  };
  if (config.selectedAuthType === 'githubEnterpriseToken') {
    authOptions = { auth: config.enterpriseToken };
  } else {
    authOptions = {
      authStrategy: createAppAuth,
      auth: {
        appId: config.githubAppId,
        privateKey: config.githubAppPrivateKey,
        installationId: config.installationId,
      },
    };
  }
  return authOptions;
}

export function getAuthStrategy(config: IntegrationConfig) {
  return getFromCacheSync('authStrategy', () => {
    if (config.selectedAuthType === 'githubEnterpriseToken') {
      return createTokenAuth(config.enterpriseToken);
    } else {
      return createAppAuth({
        appId: config.githubAppId,
        privateKey: config.githubAppPrivateKey,
        installationId: config.installationId,
      });
    }
  });
}
