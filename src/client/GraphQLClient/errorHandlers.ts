import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext } from '@lifeomic/attempt';
import { GraphQlQueryResponse } from '@octokit/graphql/dist-types/types';
import { GraphqlResponseError } from '@octokit/graphql';

/**
 * If the errors are all the same specified type, ignore them.
 * TODO: (VDubber) Consider reporting this skipped error once capability is available in SDK.
 * @param errors
 * @param logger
 * @param type
 * @return boolean
 */
const handleTypeErrors = (
  errors: GraphQlQueryResponse<never>['errors'],
  logger: IntegrationLogger,
  type: string,
): boolean => {
  if (Array.isArray(errors) && errors?.every((error) => error.type === type)) {
    logger.debug(
      { errors, type },
      'The error was found and ignored because of the type.',
    );
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

type DelayMs = number;

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
): Promise<DelayMs> => {
  let delayMs = 0;
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
      logger.warn({ attemptContext, error }, 'Rate limiting message received.');
    }
  } else if (error.message?.includes('Bad credentials')) {
    logger.warn({ error }, 'Bad credentials: Refreshing token.');
    await refreshToken();
  } else if (error.message?.includes('exceeded a secondary rate limit')) {
    logger.warn(
      { attemptContext, error },
      '"Secondary Rate Limit" message received. Waiting before retrying.',
    );
    const retryAfter =
      (error.response?.headers?.['retry-after'] || 0) * 1000 || 120_000;
    delayMs = retryAfter;
  } else if (
    error.message?.includes('Something went wrong while executing your query')
  ) {
    logger.warn(
      { attemptContext, error },
      `A downstream error occurred on the GitHub API. It may have been caused by a large query thus causing a timeout.`,
    );
  }
  return delayMs;
};
