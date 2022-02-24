import {
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';
import { createMockExecutionContext } from '@jupiterone/integration-sdk-testing';
import { integrationConfig } from '../test/config';
import {
  IntegrationConfig,
  validateInvocation,
  validateBaseUrl,
} from './config';

describe('#validateBaseUrl', () => {
  test('handles no protocol', () => {
    expect(validateBaseUrl('api.test.com:3839/path/')).toBe(
      'https://api.test.com:3839',
    );
  });
  test('handles complete url', () => {
    expect(validateBaseUrl('https://test.com/path/')).toBe('https://test.com');
  });
  test('throws error if invalid URL is supplied', () => {
    expect(() => validateBaseUrl('httpexample/test')).toThrowError(
      'Config requires valid URL for githubApiBaseUrl.',
    );
  });
});

describe('#validateInvocation', () => {
  test('throws error if invalid url is supplied', async () => {
    process.env['GITHUB_API_BASE_URL'] = 'httpsdl;we';
    const executionContext = createMockExecutionContext<IntegrationConfig>({
      instanceConfig: {
        githubAppId: 234,
        githubAppPrivateKey: '123',
        githubAppDefaultLogin: '534',
        installationId: 432,
      } as IntegrationConfig,
    });
    await expect(validateInvocation(executionContext)).rejects.toThrow(
      IntegrationValidationError,
    );
    delete process.env['GITHUB_API_BASE_URL'];
  });
  test('requires valid config', async () => {
    const executionContext = createMockExecutionContext<IntegrationConfig>({
      instanceConfig: {} as IntegrationConfig,
    });

    await expect(validateInvocation(executionContext)).rejects.toThrow(
      IntegrationValidationError,
    );
  });

  test('auth error', async () => {
    const config = integrationConfig;
    config.githubAppPrivateKey = 'Iwanttofailauthen';
    const executionContext = createMockExecutionContext({
      instanceConfig: config,
    });

    await expect(validateInvocation(executionContext)).rejects.toThrow(
      IntegrationProviderAuthenticationError,
    );
  });
});
