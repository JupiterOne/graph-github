import { AttemptContext, retry } from '@lifeomic/attempt';
import {
  createGraphqlCustomIntegrationError,
  createGraphqlIntegrationApiError,
  createGraphqlRateLimitExceededIntegrationError,
  createGraphqlUnknownIntegrationError,
  GitHubErrorType,
  parseGraphqlRequestError,
} from './error';
import graphql, { GraphQLClient } from 'graphql.js';
import fragments from '../fragments';
import { parseTimePropertyValue } from '@jupiterone/integration-sdk-core';
import { RefreshTokenResponse } from '..';

const TOKEN_EXPIRATION_BUFFER_MS = 300000; // 5 minutes

type GraphqlResponse = {
  message: string;
};

function shouldRefreshToken(expiresTimestamp: number) {
  return expiresTimestamp - TOKEN_EXPIRATION_BUFFER_MS < Date.now();
}

function parseAuthTokenExpiration(expiresTimestamp: string) {
  return parseTimePropertyValue(expiresTimestamp) || 0;
}

async function handleRequest<T>(
  graphqlQuery: string,
  request: () => Promise<T>,
) {
  let response;

  try {
    response = await request();
  } catch (err) {
    throw createGraphqlIntegrationApiError(graphqlQuery, err);
  }

  validateGraphqlResponse(response, graphqlQuery);
  return response;
}

type GraphqlRequestWithRetryParams = {
  graphqlQuery: string;
  request: () => Promise<void>;
  onRequestError: (
    err: Error,
    errorType: GitHubErrorType,
    attemptContext: AttemptContext,
  ) => void;
};

async function graphqlQueryWithRetry<T>({
  graphqlQuery,
  request,
  onRequestError,
}: GraphqlRequestWithRetryParams) {
  return await retry(() => handleRequest(graphqlQuery, request), {
    maxAttempts: 3,
    delay: 30_000, // 30 seconds to start
    timeout: 180_000, // 3 min timeout. We need this in case Node hangs with ETIMEDOUT
    factor: 2, // exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
    handleError: (err, attemptContext) => {
      const errorType = parseGraphqlRequestError(err);
      onRequestError(err, errorType, attemptContext);
    },
  });
}

function isRateLimitResponse(response: GraphqlResponse) {
  return response.message.toLowerCase().includes('rate limit');
}

function validateGraphqlResponse(response: any, graphqlQuery: string) {
  if (response.message) {
    const err = isRateLimitResponse(response)
      ? createGraphqlRateLimitExceededIntegrationError(
          response.message,
          graphqlQuery,
        )
      : createGraphqlCustomIntegrationError(response.message, graphqlQuery);

    throw err;
  }

  /**
   * in the happy path, the raw response should be an object with two properties
   *
   * One is `rateLimit`, and it is an object with rate-limiting-related properties
   * such as 'limit', 'cost', 'remaining' and 'resetAt'
   *
   * The other property will depend on the query. It might be 'organization' for
   * GraphQL queries that start with the org and return entities as sub-objects
   * Or it might be 'search', because the GraphQL query was structured that way
   * for pull-requests or issues. In some inner-resource fetches, it might be
   * the name of the inner resource. In general, the object structure will mirror
   * the query structure found in queries.ts
   */
  if (!response.rateLimit) {
    throw createGraphqlUnknownIntegrationError(response, graphqlQuery);
  }
}

function withRequestHeaders(token: string): Record<string, string> {
  return {
    'User-Agent': 'jupiterone-graph-github',
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.hawkgirl-preview+json',
  };
}

function createGraphqlClient(token: string): GraphQLClient {
  const graphqlClient = graphql('https://api.github.com/graphql', {
    headers: withRequestHeaders(token),
    asJSON: true,
  });

  graphqlClient.fragment(fragments);
  return graphqlClient;
}

type QueryWithTokenRefreshParams = {
  graphqlClient: GraphQLClient;
  graphqlQuery: string;
  tokenExpiresTimestamp: number;
  refreshToken: () => Promise<RefreshTokenResponse>;
};

async function createQueryClientWithTokenRefresh({
  graphqlClient,
  graphqlQuery,
  tokenExpiresTimestamp,
  refreshToken,
}: QueryWithTokenRefreshParams) {
  if (!shouldRefreshToken(tokenExpiresTimestamp)) {
    return {
      query: graphqlClient(graphqlQuery),
      graphqlClient,
      tokenExpiresTimestamp,
    };
  }

  const { token, expiresAt } = await refreshToken();
  graphqlClient = createGraphqlClient(token);

  return {
    query: graphqlClient(graphqlQuery),
    graphqlClient,
    tokenExpiresTimestamp: parseAuthTokenExpiration(expiresAt),
  };
}

export {
  graphqlQueryWithRetry,
  createGraphqlClient,
  createQueryClientWithTokenRefresh,
};
