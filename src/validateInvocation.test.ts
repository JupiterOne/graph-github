import {
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';
import {
  createMockExecutionContext,
  setupRecording,
} from '@jupiterone/integration-sdk-testing';
import { integrationConfig } from '../test/config';
import {
  IntegrationConfig,
  validateInvocation,
  validateBaseUrl,
} from './config';

describe('#validateBaseUrl', () => {
  it('handles no protocol', () => {
    expect(validateBaseUrl('api.test.com:3839/path/')).toBe(
      'https://api.test.com:3839',
    );
  });
  it('handles complete url', () => {
    expect(validateBaseUrl('https://test.com/path/')).toBe('https://test.com');
  });
  it('throws error if invalid URL is supplied', () => {
    expect(() => validateBaseUrl('httpexample/test')).toThrowError(
      'Config requires valid URL for githubApiBaseUrl.',
    );
  });
});

describe('#validateInvocation', () => {
  it('throws error if invalid url is supplied', async () => {
    const executionContext = createMockExecutionContext<IntegrationConfig>({
      instanceConfig: {
        githubAppId: 234,
        githubAppPrivateKey: '123',
        githubAppDefaultLogin: '534',
        installationId: 432,
        githubApiBaseUrl: 'http82/invalid',
      } as IntegrationConfig,
    });
    await expect(validateInvocation(executionContext)).rejects.toThrow(
      IntegrationValidationError,
    );
  });
  it('requires valid config', async () => {
    const executionContext = createMockExecutionContext<IntegrationConfig>({
      instanceConfig: {} as IntegrationConfig,
    });

    await expect(validateInvocation(executionContext)).rejects.toThrow(
      IntegrationValidationError,
    );
  });

  it.skip('auth error', async () => {
    const recording = setupRecording({
      directory: '__recordings__',
      name: 'client-auth-error',
    });

    recording.server.any().intercept((req, res) => {
      res.status(401);
    });

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
