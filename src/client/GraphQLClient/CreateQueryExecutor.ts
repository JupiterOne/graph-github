import { GitHubGraphQLClient } from './client';
import sleepIfApproachingRateLimit from '../../util/sleepIfApproachingRateLimit';

export type QueryExecutor = (executable: ExecutableQuery) => Promise<any>;

export type ExecutableQuery = {
  query: string;
  queryVariables: { [key: string]: string | number | undefined };
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
  client: GitHubGraphQLClient,
  logger,
): QueryExecutor => {
  return async (executable): Promise<any> => {
    if (executable.rateLimit) {
      await sleepIfApproachingRateLimit(executable.rateLimit, logger);
    }

    return client.query(executable.query, executable.queryVariables);
  };
};
