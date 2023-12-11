import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

const GATEWAY_TIMEOUT = 504;

export const buildTimeoutHandler = <P, T>({
  queryParams,
  maxLimitKey,
  logger,
}: {
  queryParams: P;
  maxLimitKey: keyof P;
  logger?: IntegrationLogger;
}) => {
  if (
    queryParams === null ||
    typeof queryParams !== 'object' ||
    !(maxLimitKey in queryParams)
  ) {
    throw new Error(`${String(maxLimitKey)} not found in queryParams`);
  }
  const originalMaxLimit = queryParams[maxLimitKey];
  if (typeof originalMaxLimit !== 'number') {
    throw new Error(`${String(maxLimitKey)} is not a number`);
  }

  let maxLimit = originalMaxLimit as number;

  return async (
    makeRequest: () => Promise<any>,
  ): Promise<{ retry: boolean; response: any }> => {
    let response: any;
    try {
      response = await makeRequest();
    } catch (err) {
      if (
        err.message?.includes('This may be the result of a timeout') ||
        err.status === GATEWAY_TIMEOUT
      ) {
        const newMaxLimit = Math.max(Math.floor(maxLimit / 2), 1);
        if (newMaxLimit === maxLimit) {
          // prevent infinite loop: newMaxLimit is 1 and it already failed using 1
          throw err;
        }
        maxLimit = newMaxLimit;
        queryParams[maxLimitKey] = newMaxLimit as any;
        logger?.warn(
          { queryParams },
          'Github timeout. Start querying by half the search limit.',
        );
        return { retry: true, response: undefined };
      } else {
        throw err;
      }
    }
    return { retry: false, response };
  };
};
