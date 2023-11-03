export const separateRepoKeys = (
  reposMap: Map<string, number>,
  threshold: number,
): { batchedRepoKeys: string[][]; singleRepoKeys: string[] } => {
  const { lessThanThreshold, moreThanThreshold } = Array.from(reposMap).reduce(
    (acc, [repoKey, total]) => {
      if (total === 0) {
        return acc;
      }
      if (total < threshold) {
        acc.lessThanThreshold.set(repoKey, total);
      } else {
        acc.moreThanThreshold.set(repoKey, total);
      }
      return acc;
    },
    { lessThanThreshold: new Map(), moreThanThreshold: new Map() } as {
      lessThanThreshold: Map<string, number>;
      moreThanThreshold: Map<string, number>;
    },
  );
  const batchedRepoKeys = groupReposByTotal(lessThanThreshold, threshold);
  const singleRepoKeys = Array.from(moreThanThreshold.keys());
  return { batchedRepoKeys, singleRepoKeys };
};

const groupReposByTotal = (
  reposMap: Map<string, number>,
  threshold: number,
): string[][] => {
  const repoEntries = Array.from(reposMap);
  repoEntries.sort((a, b) => a[1] - b[1]);

  const groupedRepoKeys: string[][] = [];
  let currentSum = 0;
  let currentGroup: string[] = [];

  for (const [repoKey, totalCount] of repoEntries) {
    if (currentSum + totalCount > threshold) {
      groupedRepoKeys.push(currentGroup);
      currentGroup = [];
      currentSum = 0;
    }
    currentGroup.push(repoKey);
    currentSum += totalCount;
  }

  if (currentGroup.length > 0) {
    groupedRepoKeys.push(currentGroup);
  }

  return groupedRepoKeys;
};
