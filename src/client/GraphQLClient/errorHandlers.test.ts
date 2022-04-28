import {
  handleForbiddenErrors,
  handleNotFoundErrors,
  retryErrorHandle,
} from './errorHandlers';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext } from '@lifeomic/attempt';
import { GraphqlResponseError } from '@octokit/graphql';

describe('errorHandlers', () => {
  describe('handleNotFoundErrors', () => {
    test('contains NOT_FOUND', () => {
      // Arrange
      const errors: any = [
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
      const nonError = {
        type: 'RATE_LIMITED',
        message: 'An error message',
      } as any;
      const debug = jest.fn();
      const info = jest.fn();
      const logger = {
        debug,
        info,
      } as unknown as IntegrationLogger;

      // Act
      expect(handleNotFoundErrors(errors, logger)).toBeTruthy();
      expect(handleNotFoundErrors(errors[0], logger)).toBeFalsy();
      expect(handleNotFoundErrors(nonError, logger)).toBeFalsy();

      // Assert
      expect(debug).toHaveBeenCalledTimes(2);
    });
  });
  describe('handleForbiddenErrors', () => {
    test('contains FORBIDDEN', () => {
      // Arrange
      const errors: any = [
        {
          type: 'FORBIDDEN',
          path: ['pullRequest'],
          message: 'Could not resolve to a PullRequest with the number of 67.',
          extensions: ['one', 'two'],
          locations: [{ column: 123, line: 233 }],
        },
        {
          type: 'FORBIDDEN',
          path: ['pullRequest'],
          message: 'Could not resolve to a PullRequest with the number of 32.',
          extensions: ['one', 'two'],
          locations: [{ column: 33, line: 44 }],
        },
      ];
      const nonError = {
        type: 'RATE_LIMITED',
        message: 'An error message',
      } as any;
      const info = jest.fn();
      const debug = jest.fn();
      const logger = {
        info,
        debug,
      } as unknown as IntegrationLogger;

      // Act
      expect(handleForbiddenErrors(errors, logger)).toBeTruthy();
      expect(handleForbiddenErrors(errors[0], logger)).toBeFalsy();
      expect(handleForbiddenErrors(nonError, logger)).toBeFalsy();

      // Assert
      expect(debug).toHaveBeenCalledTimes(2);
    });
  });
  describe('#retryErrorHandle', () => {
    test('rate limit', async () => {
      // Arrange
      const response = {
        errors: [
          { type: 'RATE_LIMITED', path: [''], message: 'rate limit error' },
          { type: 'UNKNOWN', path: [''], message: 'rate limit error' },
        ],
      } as any;

      const error = new GraphqlResponseError({} as any, {} as any, response);
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
      await retryErrorHandle(error, logger, attemptContext, refresh);

      // Arrange
      expect(info).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
    test('bad cred', async () => {
      // Arrange
      const error = new Error('Bad credentials');
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
      await retryErrorHandle(error, logger, attemptContext, refresh);

      // Arrange
      expect(info).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
    });
  });
});
