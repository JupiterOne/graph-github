import {
  handleForbiddenErrors,
  handleNotFoundErrors,
  retryErrorHandle,
} from './errorHandlers';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext } from '@lifeomic/attempt';

describe('errorHandlers', () => {
  describe('handleNotFoundErrors', () => {
    test('contains NOT_FOUND', () => {
      // Arrange
      const errors = [
        {
          type: 'NOT_FOUND',
          path: ['repository', 'pullRequest'],
          message: 'Could not resolve to a PullRequest with the number of 67.',
        },
        {
          type: 'NOT_FOUND',
          message: 'Could not resolve to a PullRequest with the number of 68.',
        },
      ];
      const nonError = { type: 'RATE_LIMITED', message: 'An error message' };
      const warn = jest.fn();
      const logger = {
        warn,
      } as unknown as IntegrationLogger;

      // Act
      expect(handleNotFoundErrors(errors, logger)).toBeTruthy();
      expect(handleNotFoundErrors(errors[0], logger)).toBeTruthy();
      expect(handleNotFoundErrors(nonError, logger)).toBeFalsy();

      // Assert
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });
  describe('handleForbiddenErrors', () => {
    test('contains FORBIDDEN', () => {
      // Arrange
      const errors = [
        {
          type: 'FORBIDDEN',
          path: ['repository', 'pullRequest'],
          message: 'Could not resolve to a PullRequest with the number of 67.',
        },
        {
          type: 'FORBIDDEN',
          message: 'Could not resolve to a PullRequest with the number of 68.',
        },
      ];
      const nonError = { type: 'RATE_LIMITED', message: 'An error message' };
      const warn = jest.fn();
      const logger = {
        warn,
      } as unknown as IntegrationLogger;

      // Act
      expect(handleForbiddenErrors(errors, logger)).toBeTruthy();
      expect(handleForbiddenErrors(errors[0], logger)).toBeTruthy();
      expect(handleForbiddenErrors(nonError, logger)).toBeFalsy();

      // Assert
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });
  describe('#retryErrorHandle', () => {
    test('rate limit', async () => {
      // Arrange
      const errors = [
        { type: 'RATE_LIMITED', path: [''], message: 'rate limit error' },
        { type: 'UNKNOWN', path: [''], message: 'rate limit error' },
      ];
      const abort = jest.fn();
      const info = jest.fn();
      const refresh = jest.fn();
      const logger = {
        info,
      } as unknown as IntegrationLogger;
      const attemptContext = {
        abort,
      } as unknown as AttemptContext;

      // Act
      await retryErrorHandle(errors, logger, attemptContext, refresh);

      // Arrange
      expect(info).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
    test('bad cred', async () => {
      // Arrange
      const errors = { message: 'Bad credentials' };
      const info = jest.fn();
      const abort = jest.fn();
      const refresh = jest.fn();
      const logger = {
        info,
      } as unknown as IntegrationLogger;
      const attemptContext = {
        abort,
      } as unknown as AttemptContext;

      // Act
      await retryErrorHandle(errors, logger, attemptContext, refresh);

      // Arrange
      expect(info).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
    });
    test('secondary rate limit', async () => {
      // Arrange
      const errors = {
        message: 'Bad credentials',
        documentation_url: 'google.it',
      };
      const info = jest.fn();
      const abort = jest.fn();
      const refresh = jest.fn();
      const logger = {
        info,
      } as unknown as IntegrationLogger;
      const attemptContext = {
        abort,
      } as unknown as AttemptContext;

      // Act
      await retryErrorHandle(errors, logger, attemptContext, refresh);

      // Arrange
      expect(info).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
    });
  });
});
