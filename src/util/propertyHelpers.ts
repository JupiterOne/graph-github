import { PullRequestKey } from '../sync/converters';
import { TokenPermissions } from '../types';

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
