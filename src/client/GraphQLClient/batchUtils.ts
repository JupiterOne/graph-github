import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import partition from 'lodash/partition';
import clone from 'lodash/clone';

type BatchingOptions = {
  totalConnectionsById: Map<string, number>;
  threshold: number;
  logger?: IntegrationLogger;
  batchCb: (entityIds: string[]) => Promise<void>;
  singleCb: (entityId: string) => Promise<void>;
};

/**
 * Executes batched and single callbacks based on the total connections of entities and a specified threshold.
 *
 * @param {BatchingOptions} options - Options for batching, including total connections, threshold, logger, batch callback, and single callback.
 * @param {Map<string, number>} options.totalConnectionsById - A map of entity keys to their total connections.
 * @param {number} options.threshold - The threshold value used to categorize entity keys.
 * @param {IntegrationLogger} [options.logger] - An optional logger for logging warnings.
 * @param {(entityIds: string[]) => Promise<void>} options.batchCb - A callback function to process each batch of entity keys.
 * @param {(entityId: string) => Promise<void>} options.singleCb - A callback function to process individual entity keys.
 * @returns {Promise<void>} A promise that resolves once all callbacks have been executed.
 *
 * @description
 * Explanation of Batching Algorithm:
 * Given a map of entity keys and their total connection counts, e.g., Map([['a', 2], ['b', 5], ['c', 89], ['d', 150]])
 * The algorithm separates the keys into two categories: those below a specified threshold and those above the threshold.
 *
 * For keys below the threshold:
 * 1. Groups these keys in a way that the sum of each group is less than or equal to the specified threshold.
 * 2. Calls the batch callback for each of these groups, allowing for efficient batch processing.
 *
 * For keys above the threshold:
 * 1. Calls the single callback for each of these keys individually.
 */
export const withBatching = async ({
  totalConnectionsById,
  threshold,
  logger,
  batchCb,
  singleCb,
}: BatchingOptions): Promise<void> => {
  const { batchedKeys, singleKeys } = separateEntityKeysByThreshold(
    totalConnectionsById,
    threshold,
  );

  const retrySingleEntityKeys = await recursiveBatch({
    batchedKeys,
    totalConnectionsById,
    threshold,
    batchCb,
    logger,
  });

  for (const entityId of [...retrySingleEntityKeys, ...singleKeys]) {
    await singleCb(entityId);
  }
};

/**
 * Recursively processes batched entity keys, handling timeouts and retrying queries with adjusted thresholds.
 *
 * @param {Object} params - Parameters for the recursive batch processing.
 * @param {string[][]} params.batchedKeys - An array of arrays, where each inner array contains entity keys for a batch.
 * @param {Map<string, number>} params.totalConnectionsById - A map of entity keys to their total connections.
 * @param {number} params.threshold - The initial threshold value used to categorize entity keys.
 * @param {(entityIds: string[]) => Promise<void>} params.batchCb - A callback function to process each batch of entity keys.
 * @param {IntegrationLogger} [params.logger] - An optional logger for logging warnings.
 * @returns {Promise<string[]>} An array of entity keys that encountered timeouts and need to be retried individually.
 */
const recursiveBatch = async (params: {
  batchedKeys: string[][];
  totalConnectionsById: Map<string, number>;
  threshold: number;
  batchCb: (entityIds: string[]) => Promise<void>;
  logger?: IntegrationLogger;
}): Promise<string[]> => {
  const { batchedKeys, batchCb } = params;
  const retrySingleEntityKeys: string[] = [];
  for (const [index, entityIds] of batchedKeys.entries()) {
    try {
      await batchCb(entityIds);
    } catch (err) {
      if (err.message?.includes('This may be the result of a timeout')) {
        await handleTimeoutError({
          err,
          index,
          retrySingleEntityKeys,
          ...params,
        });
        break;
      } else {
        throw err;
      }
    }
  }
  return retrySingleEntityKeys;
};

/**
 * Handles a timeout error during batched queries by retrying with adjusted parameters.
 *
 * @param {Object} options - The options object.
 * @param {Error} options.err - The timeout error.
 * @param {number} options.index - The current index in the batchedKeys array.
 * @param {string[]} options.retrySingleEntityKeys - Array of entity keys to retry individually.
 * @param {string[][]} options.batchedKeys - Array of arrays containing batched entity keys.
 * @param {Map<string, number>} options.totalConnectionsById - Map of entity IDs to total connections.
 * @param {number} options.threshold - The current threshold for batched queries.
 * @param {(entityIds: string[]) => Promise<void>} options.batchCb - Callback function for processing batched entities.
 * @param {IntegrationLogger} [options.logger] - Optional logger for logging warnings.
 * @returns {Promise<void>} - Resolves when the retry process is complete.
 * @throws {Error} - Throws the original error if the new threshold is 1, preventing an infinite loop.
 */
async function handleTimeoutError({
  err,
  index,
  retrySingleEntityKeys,
  batchedKeys,
  totalConnectionsById,
  threshold,
  batchCb,
  logger,
}: {
  err: Error;
  index: number;
  retrySingleEntityKeys: string[];
  batchedKeys: string[][];
  totalConnectionsById: Map<string, number>;
  threshold: number;
  batchCb: (entityIds: string[]) => Promise<void>;
  logger?: IntegrationLogger;
}): Promise<void> {
  const newTotalConnectionsById = batchedKeys
    .slice(index)
    .flat()
    .reduce((acc, id) => {
      const total = totalConnectionsById.get(id);
      if (!total) {
        return acc;
      }
      acc.set(id, total);
      return acc;
    }, new Map<string, number>());
  const newThreshold = Math.max(Math.floor(threshold / 2), 1);
  if (newThreshold === threshold) {
    // prevent infinite loop: newThreshold is 1 and it already failed using 1
    // it should never happen because when the threshold is 1 the queries are sent to the single query handler, but just in case.
    throw err;
  }
  const { batchedKeys: newBatchedKeys, singleKeys } =
    separateEntityKeysByThreshold(newTotalConnectionsById, newThreshold);

  logger?.warn(
    {
      threshold: newThreshold,
    },
    'Github timeout on batch query. Retrying query by half the threshold.',
  );

  const innerRetrySingleEntityKeys = await recursiveBatch({
    batchedKeys: newBatchedKeys,
    totalConnectionsById: newTotalConnectionsById,
    threshold: newThreshold,
    batchCb,
    logger,
  });
  retrySingleEntityKeys.push(...singleKeys);
  retrySingleEntityKeys.push(...innerRetrySingleEntityKeys);
}

/**
 * Separates entity keys into batched and single keys based on their total values and a specified threshold.
 *
 * @param {Map<string, number>} entitiesMap - A map of entity keys where keys are entity keys and values are the total count of connections.
 * @param {number} threshold - The threshold value used to categorize entity keys.
 * @param {number} groupLimit - The maximum number of entity keys allowed in each batched subset.
 * @returns {{ batchedKeys: string[][]; singleKeys: string[] }} An object containing batched and single entity keys.
 */
const separateEntityKeysByThreshold = (
  entitiesMap: Map<string, number>,
  threshold: number,
  groupLimit: number = 80,
): { batchedKeys: string[][]; singleKeys: string[] } => {
  const entitiesEntries = Array.from(entitiesMap).filter(
    ([, total]) => total > 0,
  );
  const [lessThanThreshold, moreThanThreshold] = partition(
    entitiesEntries,
    ([, total]) => total < threshold,
  );
  const batchedKeys = getMinimalSubsets(
    lessThanThreshold,
    threshold,
    groupLimit,
  );
  const singleKeys = moreThanThreshold.map(([key]) => key);

  return {
    batchedKeys,
    singleKeys,
  };
};

/**
 * Finds minimal number of subsets of entity keys based on their total counts, subject to specified constraints.
 *
 * @param {Array<[string, number]>} entitiesEntries - An array of key-value pairs representing entity keys and the total count of its connections.
 * @param {number} threshold - The maximum sum of values allowed in each subset.
 * @param {number} groupLimit - The maximum number of entity keys allowed in each subset.
 * @returns {string[][]} An array of subsets, where each subset is an array of entity keys.
 */
const getMinimalSubsets = (
  entitiesEntries: [string, number][],
  threshold: number,
  groupLimit: number,
): string[][] => {
  const entries = clone(entitiesEntries);
  entries.sort((a, b) => b[1] - a[1]);

  const subsets: string[][] = [];
  let currentSubset: string[] = [];
  let currentSum = 0;

  let left = 0;
  let right = entries.length - 1;

  while (left <= right) {
    const leftValue = entries[left][1];
    const rightValue = entries[right][1];

    if (currentSubset.length >= groupLimit) {
      subsets.push(currentSubset);
      currentSubset = [];
      currentSum = 0;
    } else if (currentSum + leftValue <= threshold) {
      currentSubset.push(entries[left][0]);
      currentSum += leftValue;
      left++;
    } else if (currentSum + rightValue <= threshold) {
      currentSubset.push(entries[right][0]);
      currentSum += rightValue;
      right--;
    } else {
      subsets.push(currentSubset);
      currentSubset = [];
      currentSum = 0;
    }
  }

  // Add the last subset if it's not empty
  if (currentSubset.length > 0) {
    subsets.push(currentSubset);
  }

  return subsets;
};
