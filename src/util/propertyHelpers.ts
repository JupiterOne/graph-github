import { IdEntityMap, UserEntity, TokenPermissions } from '../types';

export function aggregateProperties<T>(
  property: string,
  collection?: any[],
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
    return flatArray.concat(row);
  }, []);
}

export function displayNamesFromLogins(
  logins: string[],
  usersByLogin: IdEntityMap<UserEntity>,
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

export function decomposePermissions(permissions: TokenPermissions) {
  const theKeys = Object.keys(permissions);
  const returnObj = {};
  const replaceRegex = new RegExp('_', 'g');
  for (const key of theKeys) {
    const newKey = 'permissions.' + key.replace(replaceRegex, '-');
    returnObj[newKey] = permissions[key];
  }
  return returnObj;
}
