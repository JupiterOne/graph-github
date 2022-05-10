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

export function getAppEntityKey(installId): string {
  return 'GitHubAppInstallation_' + installId;
}

export function getSecretEntityKey({
  name,
  secretOwnerType,
  secretOwnerName,
}): string {
  return (
    'GitHub_' + secretOwnerType + '_' + secretOwnerName + '_Secret_' + name
  );
}

type PullRequestKey = {
  login: string;
  repoName: string;
  pullRequestNumber: number;
};

export function buildPullRequestKey({
  login,
  repoName,
  pullRequestNumber,
}: PullRequestKey): string {
  return `${login}/${repoName}/pull-requests/${pullRequestNumber}`;
}

export function isValidPullRequestKey(key: string): boolean {
  try {
    decomposePullRequestKey(key);
    return true;
  } catch (e) {
    return false;
  }
}

export function decomposePullRequestKey(key: string): PullRequestKey {
  if (!key || !key.split) {
    throw new Error('provided key is invalid');
  }
  const keySegments = key.split('/');

  if (keySegments.length !== 4) {
    throw new Error('provided key is invalid');
  }
  if (keySegments[2] !== 'pull-requests') {
    throw new Error('provided key is invalid');
  }

  return {
    login: keySegments[0],
    repoName: keySegments[1],
    pullRequestNumber: parseInt(keySegments[3], 10),
  };
}
