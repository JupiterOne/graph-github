import { URL } from 'url';

const innerResourcePaginationRequired = (pullRequest): boolean => {
  if (!pullRequest) {
    return false;
  }
  return (
    pullRequest.commits?.pageInfo.hasNextPage ||
    pullRequest.reviews?.pageInfo.hasNextPage ||
    pullRequest.labels?.pageInfo.hasNextPage
  );
};

const responseToResource = (node) => {
  return {
    ...node,
    commits: node.commits?.nodes?.map((node) => node.commit) ?? [],
    reviews: node.reviews?.nodes ?? [],
    labels: node.labels?.nodes ?? [],
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

export default {
  innerResourcePaginationRequired,
  responseToResource,
  findRepoOwnerAndName: determineRepoOwnerAndName,
  hasRepoOwnerAndName,
};
