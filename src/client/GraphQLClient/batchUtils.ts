export const batchSeparateKeys = (
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
