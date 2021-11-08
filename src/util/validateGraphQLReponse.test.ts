import validateGraphQLResponse from './validateGraphQLReponse';
import { createMockIntegrationLogger } from '@jupiterone/integration-sdk-testing';

const logger = createMockIntegrationLogger();
const queryString = 'Not important what the query was';

describe('validateGraphQLResponse', () => {
  test('customErrorRateLimiting', () => {
    const responseWithCustomGraphQLError = {
      message:
        'This is a rate limit message from GraphQL - you are asking too much',
    };
    expect(() => {
      validateGraphQLResponse(
        responseWithCustomGraphQLError,
        logger,
        queryString,
      );
    }).toThrowError(responseWithCustomGraphQLError.message);
  });

  test('customErrorNotRateLimiting', () => {
    const responseWithCustomGraphQLError = {
      message:
        'This is a custom error from GraphQL - I refuse to cooperate for my own reasons',
    };
    expect(() => {
      validateGraphQLResponse(
        responseWithCustomGraphQLError,
        logger,
        queryString,
      );
    }).toThrowError(responseWithCustomGraphQLError.message);
  });

  test('customErrorNotRateLimiting', () => {
    const responseWithNoMessageButNoRateLimitInfo = {
      organization: 'Some stuff',
    };
    expect(() => {
      validateGraphQLResponse(
        responseWithNoMessageButNoRateLimitInfo,
        logger,
        queryString,
      );
    }).toThrowError('GraphQL reply not valid or in unexpected format');
  });

  test('wellFormedResponse', () => {
    const wellFormedResponse = {
      organization: 'Some stuff',
      rateLimit: {
        limit: 5000,
        remaining: 4999,
        resetAt: (Date.now() + 5000).toString(),
      },
    };
    validateGraphQLResponse(wellFormedResponse, logger, queryString); //no error should be thrown
  });
});
