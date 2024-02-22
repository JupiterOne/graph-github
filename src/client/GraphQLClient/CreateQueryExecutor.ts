import { GithubGraphqlClient } from './client';
import sleepIfApproachingRateLimit from '../../util/sleepIfApproachingRateLimit';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export type QueryExecutor = (executable: ExecutableQuery) => Promise<any>;

export type ExecutableQuery = {
  query: string;
  queryVariables: { [key: string]: string | number | undefined | string[] };
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
};

/**
 * Wraps the client to handle:
 * - Rate limit management
 * - Retry logic
 * - Token refresh logic
 * @param client
 * @param logger
 */
export const createQueryExecutor = (
  client: GithubGraphqlClient,
  logger: IntegrationLogger,
): QueryExecutor => {
  return async (executable): Promise<any> => {
    // client.rateLimit is the known rateLimit when this query executor was created.
    // executable.rateLimit is the know rateLimit within the step, based on the most recent pagination result.
    // Therefore, attempt to use executable.rateLimit first.
    if (executable.rateLimit || client.rateLimit) {
      await sleepIfApproachingRateLimit(
        executable.rateLimit ?? client.rateLimit,
        logger,
      );
    }

    return client.query(executable.query, executable.queryVariables);
  };
};
