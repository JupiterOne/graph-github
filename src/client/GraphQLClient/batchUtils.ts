import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

type BatchingOptions = {
  totalConnectionsById: Map<string, number>;
  threshold: number;
  logger?: IntegrationLogger;
  batchCb: (entityIds: string[]) => Promise<void>;
  singleCb: (entityId: string) => Promise<void>;
};

export const withBatching = async ({
  totalConnectionsById,
  threshold,
  logger,
  batchCb,
  singleCb,
}: BatchingOptions) => {
  const { batchedEntityKeys, singleEntityKeys } = batchSeparateKeys(
    totalConnectionsById,
    threshold,
  );

  const batchLoop = async ({
    batchedEntityKeys,
    totalConnectionsById,
    threshold,
    batchCb,
  }: {
    batchedEntityKeys: string[][];
    totalConnectionsById: Map<string, number>;
    threshold: number;
    batchCb: (entityIds: string[]) => Promise<void>;
  }) => {
    const retrySingleEntityKeys: string[] = [];
    for (const [index, entityIds] of batchedEntityKeys.entries()) {
      try {
        await batchCb(entityIds);
      } catch (err) {
        if (err.message?.includes('This may be the result of a timeout')) {
          const newTotalConnectionsById = batchedEntityKeys
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
          const { batchedEntityKeys: newBatchedEntityKeys, singleEntityKeys } =
            batchSeparateKeys(newTotalConnectionsById, newThreshold);

          logger?.warn(
            {
              threshold: newThreshold,
            },
            'Github timeout on batch query. Retrying query by half the threshold.',
          );

          const innerRetrySingleEntityKeys = await batchLoop({
            batchedEntityKeys: newBatchedEntityKeys,
            totalConnectionsById: newTotalConnectionsById,
            threshold: newThreshold,
            batchCb,
          });
          retrySingleEntityKeys.push(...singleEntityKeys);
          retrySingleEntityKeys.push(...innerRetrySingleEntityKeys);
          break;
        } else {
          throw err;
        }
      }
    }
    return retrySingleEntityKeys;
  };

  const retrySingleEntityKeys = await batchLoop({
    batchedEntityKeys,
    totalConnectionsById,
    threshold,
    batchCb,
  });

  for (const entityId of [...retrySingleEntityKeys, ...singleEntityKeys]) {
    await singleCb(entityId);
  }
};

const batchSeparateKeys = (
  entitiesMap: Map<string, number>,
  threshold: number,
  groupLimit = 80,
): { batchedEntityKeys: string[][]; singleEntityKeys: string[] } => {
  const { lessThanThreshold, moreThanThreshold } = Array.from(
    entitiesMap,
  ).reduce(
    (acc, [entityKey, total]) => {
      if (total === 0) {
        return acc;
      }
      if (total < threshold) {
        acc.lessThanThreshold.set(entityKey, total);
      } else {
        acc.moreThanThreshold.set(entityKey, total);
      }
      return acc;
    },
    { lessThanThreshold: new Map(), moreThanThreshold: new Map() } as {
      lessThanThreshold: Map<string, number>;
      moreThanThreshold: Map<string, number>;
    },
  );
  const batchedEntityKeys = groupEntitiesByTotal(
    lessThanThreshold,
    threshold,
    groupLimit,
  );
  const singleEntityKeys = Array.from(moreThanThreshold.keys());
  return {
    batchedEntityKeys: batchedEntityKeys,
    singleEntityKeys: singleEntityKeys,
  };
};

const groupEntitiesByTotal = (
  entitiesMap: Map<string, number>,
  threshold: number,
  groupLimit: number,
): string[][] => {
  const entityEntries = Array.from(entitiesMap);
  entityEntries.sort((a, b) => a[1] - b[1]);

  const groupedEntityKeys: string[][] = [];
  let currentSum = 0;
  let currentGroup: string[] = [];

  for (const [entityKey, totalCount] of entityEntries) {
    if (
      currentSum + totalCount > threshold ||
      currentGroup.length >= groupLimit
    ) {
      groupedEntityKeys.push(currentGroup);
      currentGroup = [];
      currentSum = 0;
    }
    currentGroup.push(entityKey);
    currentSum += totalCount;
  }

  if (currentGroup.length > 0) {
    groupedEntityKeys.push(currentGroup);
  }

  return groupedEntityKeys;
};
