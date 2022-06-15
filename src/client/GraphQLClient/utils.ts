import { URL } from 'url';
import { gte } from 'semver';

const innerResourcePaginationRequired = (pullRequest): boolean => {
  if (!pullRequest) {
    return false;
  }
  return (
    pullRequest.commits?.pageInfo?.hasNextPage ||
    pullRequest.reviews?.pageInfo?.hasNextPage ||
    pullRequest.labels?.pageInfo?.hasNextPage
  );
};

const responseToResource = (node) => {
  if (!hasProperties(node)) {
    return null;
  }

  return {
    ...node,
    commits:
      node.commits?.nodes?.filter((node) => node).map((node) => node.commit) ??
      [],
    reviews: node.reviews?.nodes?.filter((node) => node) ?? [],
    labels: node.labels?.nodes?.filter((node) => node) ?? [],
  };
};

const hasRepoOwnerAndName = (node) => {
  const repoOwnerAndName = determineRepoOwnerAndName(node);
  return repoOwnerAndName.repoOwner && repoOwnerAndName.repoName;
};

const determineRepoOwnerAndName = (
  node,
): { repoOwner?: string; repoName?: string } => {
  const urlPath = node.url // ex: https://github.com/JupiterOne/graph-github/pull/1
    ? new URL(node.url)?.pathname // ex: /JupiterOne/graph-github/pull/4"
    : '';

  // Attempt to pull repo name and owner from graphQL response. If not there, parse the pull request url.
  const repoOwner = node.headRepository?.owner?.login ?? urlPath.split('/')[1]; // ex: JupiterOne
  const repoName = node.headRepository?.name ?? urlPath.split('/')[2]; // ex: graph-github

  return {
    repoOwner,
    repoName,
  };
};

const hasProperties = (object: any) => {
  try {
    return Object.keys(object).length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Specifies the version a feature was added to GHE Server.
 */
export enum EnterpriseFeatures {
  REPO_VULN_ALERT_STATE_ARG = '3.5.0',
  REPO_VULN_ALERT_FIELDS = '3.5.0', // fixReason, fixedAt, number, state were added
}

/**
 * Returns t/f if the provided feature is supported for the provided server version.
 * @param featureVersion
 * @param gheServerVersion
 */
const isSupported = (
  featureVersion: EnterpriseFeatures,
  gheServerVersion?: string | null,
): boolean => {
  if (!gheServerVersion || gheServerVersion.length === 0) {
    // All features are supported if on GH Cloud.
    return true;
  }

  return gte(gheServerVersion, featureVersion);
};

export default {
  hasProperties,
  innerResourcePaginationRequired,
  responseToResource,
  findRepoOwnerAndName: determineRepoOwnerAndName,
  hasRepoOwnerAndName,
  isSupported,
};
