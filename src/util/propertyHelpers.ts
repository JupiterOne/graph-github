import { IdEntityMap, UserEntity } from '../types';

export function aggregateProperties<T>(
  property: string,
  collection?: any[]
): T[] {
  if (!collection) {
    return [];
  }

  return collection.reduce((aggregatedProperties: T[], source: any) => {
    aggregatedProperties.push(source[property]);
    return aggregatedProperties;
  }, []);
}

export function flattenMatrix<T>(matrix: T[][]): T[] {
  return matrix.reduce((flatArray: T[], row) => {
    flatArray.push(...row);
    return flatArray;
  }, []);
}

export function displayNamesFromLogins(
  logins: string[],
  usersByLogin: IdEntityMap<UserEntity>
): string[] {
  return logins.reduce((approverNames: string[], approverLogins) => {
    const approver = usersByLogin[approverLogins];
    if (approver && approver.displayName) {
      approverNames.push(approver.displayName);
    } else {
      approverNames.push('Unknown User');
    }
    return approverNames;
  }, []);
}
