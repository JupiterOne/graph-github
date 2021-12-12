import { IntegrationProviderAPIError } from '@jupiterone/integration-sdk-core';

type GraphqlRequestError = Error & {
  retryable: boolean;
  status: number;
  errors?: Error[];
};

export enum GitHubErrorType {
  FATAL,
  RATE_LIMIT,
  INACCESSIBLE_RESOURCE,
  RETRYABLE,
}

function isGraphqlErrorRetryable(err: GraphqlRequestError) {
  return err.retryable === true || (err.status !== 401 && err.status !== 403);
}

function isSecondaryRateLimitError(err: Error) {
  return err.message?.includes('exceeded a secondary rate limit');
}

function isResourceInaccessibleError(err: Error) {
  return err.message?.includes('Resource not accessible by integration');
}

function parseGraphqlRequestError(err: GraphqlRequestError): GitHubErrorType {
  if (!isGraphqlErrorRetryable(err)) return GitHubErrorType.FATAL;
  if (isSecondaryRateLimitError(err)) return GitHubErrorType.RATE_LIMIT;
  if (isResourceInaccessibleError(err))
    return GitHubErrorType.INACCESSIBLE_RESOURCE;
  return GitHubErrorType.RETRYABLE;
}

function composeGraphqlErrorMessage(errors?: Error[]) {
  if (!errors || !errors.length || !errors[0].message) return;

  // Extract message from first GraphQL response (reject(response),
  // unknown response code in graphql.js)
  return `GraphQL errors (${errors.length}), first: ${JSON.stringify(
    errors[0],
  )}`;
}

function stringifyErrorSubstr(err: Error, maxChar: number = 200) {
  return JSON.stringify(err).substring(0, maxChar);
}

function createGraphqlIntegrationApiError(
  graphqlQuery: string,
  err: GraphqlRequestError,
) {
  // Process errors thrown by `this.graph` generated functions
  const message: string | undefined =
    composeGraphqlErrorMessage(err.errors) ||
    // Catch all, we could get an Array from graphql.js (reject(response.errors))
    stringifyErrorSubstr(err);

  return new IntegrationProviderAPIError({
    message,
    status: 'None',
    statusText: `GraphQL query error: ${graphqlQuery}`,
    cause: err,
    endpoint: `retryGraphQL`,
  });
}

function createGraphqlRateLimitExceededIntegrationError(
  responseMessage: string,
  graphqlQuery: string,
) {
  return new IntegrationProviderAPIError({
    message: responseMessage,
    status: 429,
    statusText: `Error msg: ${responseMessage}, query string: ${graphqlQuery}`,
    cause: undefined,
    endpoint: `GraphQL API rate limiting at GitHubGraphQLClient.ts > retryGraphQL`,
  });
}

function createGraphqlCustomIntegrationError(
  responseMessage: string,
  graphqlQuery: string,
) {
  return new IntegrationProviderAPIError({
    message: responseMessage,
    status: '200 error',
    statusText: `Error msg: ${responseMessage}, query string: ${graphqlQuery}`,
    cause: undefined,
    endpoint: `GraphQL API [200] custom error at GitHubGraphQLClient.ts > retryGraphQL`,
  });
}

function createGraphqlUnknownIntegrationError(
  response: any,
  graphqlQuery: string,
) {
  return new IntegrationProviderAPIError({
    message: 'GraphQL reply not valid or in unexpected format',
    status: '200 error',
    statusText: `Raw response properties: ${Object.keys(
      response,
    )}, query string: ${graphqlQuery}`,
    cause: undefined,
    endpoint: `GraphQL API failed to find rate limit info at GitHubGraphQLClient.ts > retryGraphQL`,
  });
}

export {
  parseGraphqlRequestError,
  createGraphqlIntegrationApiError,
  createGraphqlRateLimitExceededIntegrationError,
  createGraphqlCustomIntegrationError,
  createGraphqlUnknownIntegrationError,
};
