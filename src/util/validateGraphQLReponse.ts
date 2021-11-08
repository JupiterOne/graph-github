import {
  IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';

export default function validateGraphQLResponse(
  response,
  logger: IntegrationLogger,
  queryString: string,
) {
  /*
   * In the case of a successful connection to the GitHub GraphQL API,
   * (meaning no error thrown during the actual fetching of data),
   * but a problem in processing the query such as rate-limiting or a malformed query,
   * we might get a [200] code HTML response, but the returned response is an object with just
   * an error message as a string property called `message`
   *
   * Example: {"message":"API rate limit exceeded for 98.53.189.133."}
   */

  if (response.message) {
    if (response.message.includes('rate limit')) {
      logger.warn(
        { response },
        'Hit a rate limit message when attempting to query GraphQL. Waiting before trying again.',
      );
      throw new IntegrationProviderAPIError({
        message: response.message,
        status: 429,
        statusText: `Error msg: ${response.message}, query string: ${queryString}`,
        cause: undefined,
        endpoint: `GraphQL API rate limiting at GitHubGraphQLClient.ts > retryGraphQL`,
      });
    } else {
      throw new IntegrationProviderAPIError({
        message: response.message,
        status: '200 error',
        statusText: `Error msg: ${response.message}, query string: ${queryString}`,
        cause: undefined,
        endpoint: `GraphQL API [200] custom error at GitHubGraphQLClient.ts > retryGraphQL`,
      });
    }
  }

  /*
    * in the happy path, the raw response should be an object with two properties

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
    throw new IntegrationProviderAPIError({
      message: 'GraphQL reply not valid or in unexpected format',
      status: '200 error',
      statusText: `Raw response properties: ${Object.keys(
        response,
      )}, query string: ${queryString}`,
      cause: undefined,
      endpoint: `GraphQL API failed to find rate limit info at GitHubGraphQLClient.ts > retryGraphQL`,
    });
  }
}
