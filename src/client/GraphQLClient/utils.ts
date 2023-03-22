import { URL } from 'url';
import { gte } from 'semver';
import { first } from 'lodash';

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

  const associatedPullRequest = first(
    node.mergeCommit?.associatedPullRequests?.nodes,
  );

  delete node.mergeCommit?.associatedPullRequests;

  return {
    ...node,
    ...(node.mergeCommit && {
      mergeCommit: {
        ...node.mergeCommit,
        associatedPullRequest,
      },
    }),
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
  REPO_VULN_ALERT_FIELDS = '3.5.0', // fixReason, number, state were added
  BRANCH_PROTECTION_RULES_BLOCKS_CREATIONS_FIELD = '3.5.0',
  BRANCH_PROTECTION_RULES_APP_MEMBER = '3.6.0',
  /**
   * Docs link: https://docs.github.com/en/enterprise-server@3.5/rest/code-scanning#list-code-scanning-alerts-for-an-organization
   */
  LIST_CODE_SCANNING_ALERT_FOR_ORG = '3.5.0',
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
