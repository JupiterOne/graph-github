/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
import { gte } from 'semver';
import { first } from 'lodash';

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
    ...(node.commits && {
      commits:
        node.commits.nodes?.filter((node) => node).map((node) => node.commit) ??
        [],
    }),
    ...(node.reviews && {
      reviews: node.reviews.nodes?.filter((node) => node) ?? [],
    }),
    ...(node.labels && {
      labels: node.labels.nodes?.filter((node) => node) ?? [],
    }),
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
  REPO_VULN_ALERT_FIELDS = '3.5.0', // fixedAt, number, state were added
  BRANCH_PROTECTION_RULES_BLOCKS_CREATIONS_FIELD = '3.5.0',
  BRANCH_PROTECTION_RULES_APP_MEMBER = '3.6.0',
  /**
   * Docs link: https://docs.github.com/en/enterprise-server@3.5/rest/code-scanning#list-code-scanning-alerts-for-an-organization
   */
  LIST_CODE_SCANNING_ALERT_FOR_ORG = '3.5.0',
  /**
   * Docs link: https://docs.github.com/en/enterprise-server@3.5/rest/secret-scanning/secret-scanning#list-secret-scanning-alerts-for-an-organization
   */
  LIST_SECRET_SCANNING_ALERT_FOR_ORG = '3.5.0',
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
  responseToResource,
  isSupported,
};
