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
} from './types';
import buildGraphQL from './buildGraphQL';
import {
  extractSelectedResources,
  mapResponseCursorsForQuery,
  mapResponseResourcesForQuery,
} from './response';
import { ResourceIteratee } from '../../client';

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
   * @param iteratee - a callback function for each PullRequestResponse
   */
  public async iteratePullRequests(
    query: string,
    selectedResources: GithubResource[],
    iteratee: ResourceIteratee<PullRequest>,
    limit: number = 100, // This is a temporary limit as a stopgap before we get rolling ingestion working for this integration
  ): Promise<QueryResponse> {
    let queryCursors: ResourceMap<string> = {};
    let rateLimitConsumed = 0;
    let pullRequestsQueried = 0;

    const pullRequestQueryString = buildGraphQL(
      this.resourceMetadataMap,
      GithubResource.PullRequests,
      selectedResources,
    );
    const queryPullRequests = this.graph(pullRequestQueryString);

    do {
      this.logger.info(
        { pullRequestQueryString, query, queryCursors },
        'Fetching batch of pull requests from GraphQL',
      );
      const pullRequestResponse = await this.retryGraphQL(async () => {
        return await queryPullRequests({
          query,
          ...queryCursors,
        });
      });
      pullRequestsQueried += 25; // This is a temporary counter as a stopgap before we get rolling ingestion working for this integration
      const rateLimit = pullRequestResponse.rateLimit;
      this.logger.info(
        { rateLimit },
        'Rate limit response for Pull Request iteration',
      );
      rateLimitConsumed += rateLimit.cost;

      for (const pullRequestQueryData of pullRequestResponse.search.edges) {
        const {
          resources: pageResources,
          cursors: innerResourceCursors,
        } = extractSelectedResources(
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
        if (Object.keys(innerResourceCursors).length) {
          this.logger.info(
            {
              pageCursors: innerResourceCursors,
              pullRequest: pullRequestResponse.title,
            },
            'Unable to fetch all inner resources. Attempting to fetch more.',
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

      // Check to see if we have iterated through every PR yet. We do not need to care about inner resources at this point.
      queryCursors =
        pullRequestResponse.search.pageInfo &&
        pullRequestResponse.search.pageInfo.hasNextPage
          ? {
              [GithubResource.PullRequests]:
                pullRequestResponse.search.pageInfo.endCursor,
            }
          : {};
    } while (
      Object.values(queryCursors).some((c) => !!c) &&
      pullRequestsQueried <= limit
    );

    return {
      rateLimitConsumed,
    };
  }

  /**
   * Iterates through a search request for Pull Requests while handling
   * pagination of both the pull requests and their inner resources.
   *
   * @param query The Github Issue search query with syntax - https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests
   * @param selectedResources - The sub-objects to additionally query for. Ex: [commits]
   * @param iteratee - a callback function for each PullRequestResponse
   */
  public async iterateIssues(
    query: string,
    selectedResources: GithubResource[],
    iteratee: ResourceIteratee<Issue>,
    limit: number = 100, // This is a temporary limit as a stopgap before we get rolling ingestion working for this integration
  ): Promise<QueryResponse> {
    let queryCursors: ResourceMap<string> = {};
    let rateLimitConsumed = 0;
    let issuesQueried = 0;

    const issueQueryString = buildGraphQL(
      this.resourceMetadataMap,
      GithubResource.Issues,
      selectedResources,
    );
    const queryIssues = this.graph(issueQueryString);

    do {
      this.logger.info(
        { issueQueryString, query, queryCursors },
        'Fetching batch of issues from GraphQL',
      );
      const issueResponse = await this.retryGraphQL(async () => {
        return await queryIssues({
          query,
          ...queryCursors,
        });
      });
      issuesQueried += 25; // This is a temporary counter as a stopgap before we get rolling ingestion working for this integration
      const rateLimit = issueResponse.rateLimit;
      this.logger.info(
        { rateLimit },
        'Rate limit response for Issue iteration',
      );
      rateLimitConsumed += rateLimit.cost;

      for (const issueQueryData of issueResponse.search.edges) {
        const { resources: pageResources } = extractSelectedResources(
          selectedResources,
          this.resourceMetadataMap,
          issueQueryData.node,
          GithubResource.Issues,
        );

        // Construct the issue... this echoes the pullRequest code, which does more complicated things
        const issueResponse: Issue = {
          ...pageResources.issues[0], // There will only be one issue because of the for loop
          assignees: pageResources.assignees ?? [],
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
      issuesQueried <= limit
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
    baseResource: T,
    selectedResources: GithubResource[],
    extraQueryParams?: { [k: string]: string | number },
    queryCursors: ResourceMap<string> = {},
  ): Promise<QueryResponse> {
    let resources: ResourceMap<any> = {};
    let queryResources = selectedResources;
    let rateLimitConsumed = 0;

    do {
      const queryString = buildGraphQL(
        this.resourceMetadataMap,
        baseResource,
        queryResources,
      );
      this.logger.info(
        { queryString, extraQueryParams, queryCursors },
        'Querying with GraphQL',
      );
      const query = this.graph(queryString);
      const response = await this.retryGraphQL(async () => {
        return await query({
          ...extraQueryParams,
          ...queryCursors,
        });
      });

      const rateLimit = response.rateLimit;
      this.logger.info(
        { rateLimit },
        'Rate limit response for Pull Request iteration',
      );
      rateLimitConsumed += rateLimit.cost;

      const pathToData = this.resourceMetadataMap[baseResource]
        .pathToDataInGraphQlResponse;
      const data = pathToData ? get(response, pathToData) : response;

      const {
        resources: pageResources,
        cursors: pageCursors,
      } = extractSelectedResources(
        selectedResources,
        this.resourceMetadataMap,
        data,
        baseResource,
      );

      resources = this.extractPageResources(pageResources, resources);
      queryCursors = mapResponseCursorsForQuery(pageCursors, queryCursors);
      queryResources = mapResponseResourcesForQuery(
        pageCursors,
        this.resourceMetadataMap,
        selectedResources,
      ) as GithubResource[];
    } while (Object.values(queryCursors).some((c) => !!c));

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
      maxAttempts: 10,
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
