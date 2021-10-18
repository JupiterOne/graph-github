import graphql, { GraphQLClient } from 'graphql.js';
import { get } from 'lodash';
import { retry, AttemptContext } from '@lifeomic/attempt';
import { URL } from 'url';

import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import fragments from './fragments';
import {
  ResourceMap,
  ResourceMetadata,
  PullRequest,
  Issue,
  GithubQueryResponse as QueryResponse,
  GithubResource,
  Node,
  CursorHierarchy,
} from './types';

import {
  extractSelectedResources,
  mapResponseCursorsForQuery,
} from './response';
import { ResourceIteratee } from '../../client';
import { SINGLE_PULL_REQUEST_QUERY_STRING } from './queries';
import { LIMITED_REQUESTS_NUM } from './queries';

export class GitHubGraphQLClient {
  private graph: GraphQLClient;
  private resourceMetadataMap: ResourceMap<ResourceMetadata>;
  private logger: IntegrationLogger;

  constructor(
    token: string,
    resourceMetadataMap: ResourceMap<ResourceMetadata>,
    logger: IntegrationLogger,
  ) {
    this.graph = graphql('https://api.github.com/graphql', {
      headers: {
        'User-Agent': 'jupiterone-graph-github',
        Authorization: `token ${token}`,
      },
      asJSON: true,
    });
    this.graph.fragment(fragments);

    this.resourceMetadataMap = resourceMetadataMap;
    this.logger = logger;
  }

  /**
   * Iterates through a search request for Pull Requests while handling
   * pagination of both the pull requests and their inner resources.
   *
   * @param query The Github Issue search query with syntax - https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests
   * @param selectedResources - The sub-objects to additionally query for. Ex: [commits]
   * @param iteratee - a callback function for each PullRequest
   */
  public async iteratePullRequests(
    pullRequestQueryString: string,
    query: string,
    selectedResources: GithubResource[],
    iteratee: ResourceIteratee<PullRequest>,
    limit: number = 500, // requests PRs since last execution time, or upto this limit, whichever is less
  ): Promise<QueryResponse> {
    let queryCursors: ResourceMap<CursorHierarchy> = {};
    let rateLimitConsumed = 0;
    let pullRequestsQueried = 0;
    let hasMorePullRequests = false;

    const queryPullRequests = this.graph(pullRequestQueryString);

    do {
      this.logger.info(
        { queryCursors },
        'Fetching batch of pull requests from GraphQL',
      );
      const pullRequestResponse = await this.retryGraphQL(async () => {
        return await queryPullRequests({
          query,
          ...queryCursors,
        });
      });
      pullRequestsQueried += LIMITED_REQUESTS_NUM;
      const rateLimit = pullRequestResponse.rateLimit;
      this.logger.info(
        { rateLimit },
        'Rate limit response for Pull Request iteration',
      );
      rateLimitConsumed += rateLimit.cost;

      for (const pullRequestQueryData of pullRequestResponse.search.edges) {
        const { resources: pageResources, cursors: innerResourceCursors } =
          extractSelectedResources(
            selectedResources,
            this.resourceMetadataMap,
            pullRequestQueryData.node,
            GithubResource.PullRequests,
          );

        // Construct the pull request
        const pullRequestResponse: PullRequest = {
          ...pageResources.pullRequests[0], // There will only be one PR because of the for loop
          commits: (pageResources.commits ?? []).map((c) => c.commit),
          reviews: pageResources.reviews ?? [],
          labels: pageResources.labels ?? [],
        };

        // This indicates that we were not able to fetch all commits, reviews, etc for this PR
        // in the page of PRs, because some inner resource (eg. commit or review) had more than
        // the limit number of entries (typically) 100. In that case, we have to go make a
        // seperate API call for just that one PR so we can gather up all the inner resources
        // before continuing on to process more PRs. This should be rare.
        if (Object.values(innerResourceCursors).some((c) => c.hasNextPage)) {
          this.logger.info(
            {
              pageCursors: innerResourceCursors,
              pullRequest: pullRequestResponse.title,
            },
            'More inner resources than fit in one page. Attempting to fetch more. (This should be rare).',
          );

          const urlPath = pullRequestResponse.url // ex: https://github.com/JupiterOne/graph-github/pull/1
            ? new URL(pullRequestResponse.url)?.pathname // ex: /JupiterOne/graph-github/pull/4"
            : '';

          // Attempt to pull repo name and owner from graphQL response. If not there, parse the pull request url.
          const repoOwner =
            pullRequestResponse.headRepository?.owner?.login ??
            urlPath.split('/')[1]; // ex: JupiterOne
          const repoName =
            pullRequestResponse.headRepository?.name ?? urlPath.split('/')[2]; // ex: graph-github

          if (!(repoOwner && repoName)) {
            this.logger.warn(
              { pullRequest: pullRequestResponse.title },
              'Unable to fetch all inner resources for this pull request. The owner ' +
                'and repo name could not be determined from the GraphQL response.',
            );
          } else {
            // Fetch the remaining inner resources on this PR (this should be rare)
            const innerResourceResponse = await this.fetchFromSingle(
              SINGLE_PULL_REQUEST_QUERY_STRING,
              GithubResource.PullRequest,
              selectedResources,
              {
                pullRequestNumber: pullRequestResponse.number,
                repoName,
                repoOwner,
              },
              mapResponseCursorsForQuery(innerResourceCursors, {}),
            );

            rateLimitConsumed += innerResourceResponse.rateLimitConsumed;

            // Add the additional inner resources to the initial call
            pullRequestResponse.commits = pullRequestResponse.commits!.concat(
              (innerResourceResponse.commits ?? []).map((c) => c.commit),
            );
            pullRequestResponse.reviews = pullRequestResponse.reviews!.concat(
              innerResourceResponse.reviews ?? [],
            );
            pullRequestResponse.labels = pullRequestResponse.labels!.concat(
              innerResourceResponse.labels ?? [],
            );
          }
        }
        await iteratee(pullRequestResponse);
      }

      hasMorePullRequests =
        pullRequestResponse.search.pageInfo &&
        pullRequestResponse.search.pageInfo.hasNextPage;

      // Check to see if we have iterated through every PR yet. We do not need to care about inner resources at this point.
      queryCursors = hasMorePullRequests
        ? {
            [GithubResource.PullRequests]:
              pullRequestResponse.search.pageInfo.endCursor,
          }
        : {};
    } while (hasMorePullRequests && pullRequestsQueried < limit);

    return {
      rateLimitConsumed,
    };
  }

  /**
   * Iterates through a search request for Issues while handling
   * pagination of both the issues and their inner resources.
   *
   * @param query The Github Issue search query with syntax - https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests
   * @param selectedResources - The sub-objects to additionally query for. Ex: [assignees]
   * @param iteratee - a callback function for each Issue
   */
  public async iterateIssues(
    issueQueryString: string,
    query: string,
    selectedResources: GithubResource[],
    iteratee: ResourceIteratee<Issue>,
    limit: number = 500, // requests issues since last execution time, or upto this limit, whichever is less
  ): Promise<QueryResponse> {
    let queryCursors: ResourceMap<string> = {};
    let rateLimitConsumed = 0;
    let issuesQueried = 0;

    const queryIssues = this.graph(issueQueryString);

    do {
      this.logger.info(
        { queryCursors },
        'Fetching batch of issues from GraphQL',
      );
      const issueResponse = await this.retryGraphQL(async () => {
        return await queryIssues({
          query,
          ...queryCursors,
        });
      });
      issuesQueried += LIMITED_REQUESTS_NUM;
      const rateLimit = issueResponse.rateLimit;
      this.logger.info(
        { rateLimit },
        'Rate limit response for Issue iteration',
      );
      rateLimitConsumed += rateLimit.cost;

      //hack to account for resourceMetadataMap on LabelsForIssues
      selectedResources = selectedResources.map((e) => {
        if (e === GithubResource.LabelsOnIssues) {
          return GithubResource.Labels;
        } else {
          return e;
        }
      });

      for (const issueQueryData of issueResponse.search.edges) {
        const { resources: pageResources } = extractSelectedResources(
          selectedResources,
          this.resourceMetadataMap,
          issueQueryData.node,
          GithubResource.Issues,
        );

        // Construct the issue
        const issueResponse: Issue = {
          ...pageResources.issues[0], // There will only be one issue because of the for loop
          assignees: pageResources.assignees ?? [],
          labels: pageResources.labels ?? [],
        };
        await iteratee(issueResponse);
      }

      // Check to see if we have iterated through every issue yet. We do not need to care about inner resources at this point.
      queryCursors =
        issueResponse.search.pageInfo &&
        issueResponse.search.pageInfo.hasNextPage
          ? {
              [GithubResource.Issues]: issueResponse.search.pageInfo.endCursor,
            }
          : {};
    } while (
      Object.values(queryCursors).some((c) => !!c) &&
      issuesQueried < limit
    );

    return {
      rateLimitConsumed,
    };
  }

  /**
   * Handles GraphQL requests on single resources that may contain
   * many nested resorces that each may need to be cursed through.
   *
   * @param baseResource - The first GraphQL resource to query for. Ex: pullRequests
   * @param selectedResources - The sub-objects to additionally query for. Ex: [commits]
   * @param extraQueryParams - Any additional params need to complete the GraphQL query. Ex: { login: 'coolGuy' }
   * @param queryCursors - Any cursors you have from previous GraphQL searches. Ex: { pullRequests: ==abcdefg }
   * @returns A destructured object that contains all resources that were queried for. Ex: { pullRequests: [{...}], commits: [{...}] }
   */
  public async fetchFromSingle<T extends GithubResource>(
    queryString: string,
    baseResource: T,
    selectedResources: GithubResource[],
    extraQueryParams?: { [k: string]: string | number },
    queryCursors: ResourceMap<string> = {},
  ): Promise<QueryResponse> {
    let resources: ResourceMap<any> = {};
    let rateLimitConsumed = 0;
    let hasMoreResources = false;

    const query = this.graph(queryString);

    do {
      const response = await this.retryGraphQL(async () => {
        return await query({
          ...extraQueryParams,
          ...queryCursors,
        });
      });

      const rateLimit = response.rateLimit;
      this.logger.info({ rateLimit }, `Rate limit response for iteration`);
      rateLimitConsumed += rateLimit.cost;

      const pathToData =
        this.resourceMetadataMap[baseResource].pathToDataInGraphQlResponse;
      const data = pathToData ? get(response, pathToData) : response;

      const { resources: pageResources, cursors: pageCursors } =
        extractSelectedResources(
          selectedResources,
          this.resourceMetadataMap,
          data,
          baseResource,
        );

      resources = this.extractPageResources(pageResources, resources);
      queryCursors = mapResponseCursorsForQuery(pageCursors, queryCursors);
      hasMoreResources = Object.values(pageCursors).some((c) => c.hasNextPage);
    } while (hasMoreResources);

    return {
      ...resources,
      rateLimitConsumed,
    } as QueryResponse;
  }

  private extractPageResources<T extends Node>(
    pageResources: ResourceMap<T[]>,
    resources: ResourceMap<T[]>,
  ): ResourceMap<T[]> {
    for (const [resource, data] of Object.entries(pageResources)) {
      if (!resources[resource]) {
        resources[resource] = data;
        continue;
      }
      for (const item of data) {
        if (
          !resources[resource].find((r: T) => {
            const found = r.id === item.id; // This is enforced with the Node type
            const metadata = this.resourceMetadataMap[resource];
            if (metadata && metadata.parent) {
              return found && r[metadata.parent] === item[metadata.parent];
            } else {
              return found;
            }
          })
        ) {
          resources[resource].push(item);
        }
      }
    }
    return resources;
  }

  private async retryGraphQL(query: () => Promise<any>) {
    const { logger } = this;
    return await retry(query, {
      maxAttempts: 5,
      delay: 60_000,
      handleError(error: any, attemptContext: AttemptContext) {
        // Github has "Secondary Rate Limits" to prevent us from making these costly to Github graphQL calls.
        // From what I can tell, there is no way around it outside of waiting for "a few minutes" when we get
        // one of these errors. I guess checking every minute for 10 minutes seems reasonable.
        // https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
        if (
          error.message?.includes('You have exceeded a secondary rate limit')
        ) {
          logger.warn(
            { attemptContext, error },
            'Hit a "Secondary Rate Limit" when attempting to query GraphQL. Waiting a minute before trying again.',
          );
          // TODO: handle Primary Rate Limit errors as well
        } else {
          throw error;
        }
      },
    });
  }
}
