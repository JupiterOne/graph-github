import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext, sleep } from '@lifeomic/attempt';
import { GraphQlQueryResponse } from '@octokit/graphql/dist-types/types';
import { GraphqlResponseError } from '@octokit/graphql';

const handleTypeErrors = (
  errors: GraphQlQueryResponse<never>['errors'],
  logger,
  type: string,
): boolean => {
  if (Array.isArray(errors) && errors?.every((error) => error.type === type)) {
    logger.info(
      { errors, type },
      'The error was found and ignored because of the type.',
    );
    errors.forEach((error) => {
      if (error.message) {
        logger.debug(error.message);
      }
    });

    return true;
  }

  return false;
};

/**
 * Logs NOT_FOUND errors but allows execution to continue.
 * Returns t/f if handled
 */
export const handleNotFoundErrors = (
  errors: GraphQlQueryResponse<never>['errors'],
  logger: IntegrationLogger,
): boolean => {
  return handleTypeErrors(errors, logger, 'NOT_FOUND');
};

/**
 * Logs FORBIDDEN errors but allows execution to continue.
 * Returns t/f if handled
 * @param errors
 * @param logger
 */
export const handleForbiddenErrors = (
  errors: GraphQlQueryResponse<never>['errors'],
  logger: IntegrationLogger,
): boolean => {
  return handleTypeErrors(errors, logger, 'FORBIDDEN');
};

/**
 * Handles known errors.
 * @param error
 * @param logger
 * @param attemptContext
 * @param refreshToken
 */
export const retryErrorHandle = async (
  error,
  logger: IntegrationLogger,
  attemptContext: AttemptContext,
  refreshToken: () => Promise<void>,
) => {
  if (error instanceof GraphqlResponseError) {
    /* GitHub has "Secondary Rate Limits" in case of excessive polling or very costly API calls.
     * GitHub guidance is to "wait a few minutes" when we get one of these errors.
     * https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
     * this link is REST specific - however, the limits might apply to GraphQL as well,
     * and our GraphQL client is not using the @octokit throttling and retry plugins like our REST client
     * therefore some retry logic is appropriate here
     */
    if (
      Array.isArray(error.errors) &&
      error.errors?.some((e) => e.type === 'RATE_LIMITED')
    ) {
      logger.info({ attemptContext, error }, 'Rate limiting message received.');
    }
  } else if (error.message?.includes('Bad credentials')) {
    logger.info({ error }, 'Bad credentials: Refreshing token.');
    await refreshToken();
  } else if (error.message?.includes('exceeded a secondary rate limit')) {
    logger.info(
      { attemptContext, error },
      '"Secondary Rate Limit" message received. Waiting before retrying.',
    );
    await sleep(300_000);
  } else if (
    error.message?.includes('Something went wrong while executing your query')
  ) {
    logger.info(
      { attemptContext, error },
      `A downstream error occurred on the GitHub API. It may have been caused by a large query thus causing a timeout.`,
    );
  }
};
