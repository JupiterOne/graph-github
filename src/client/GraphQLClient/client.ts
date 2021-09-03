import graphql, { GraphQLClient } from 'graphql.js';
import { get } from 'lodash';

import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import fragments from './fragments';
import {
  ResourceMap,
  ResourceMetadata,
  PullRequest,
  PullRequestQueryResponse,
  GithubResourcesQueryResponse,
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

// Conditional type to map the GraphQL response based on the base resource
type QueryResponse<T> = T extends GithubResource
  ? GithubResourcesQueryResponse
  : T extends GithubResource
  ? PullRequestQueryResponse
  : never;

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

  public async iteratePullRequests(
    query: string,
    selectedResources: GithubResource[],
    iteratee: ResourceIteratee<PullRequest>,
  ): Promise<PullRequestQueryResponse> {
    let queryCursors: ResourceMap<string> = {};
    let rateLimitConsumed = 0;

    const pullRequestQueryString = buildGraphQL(
      this.resourceMetadataMap,
      GithubResource.PullRequests,
      selectedResources,
    );
    const queryPullRequests = this.graph(pullRequestQueryString);

    do {
      const pullRequestResponse = await queryPullRequests({
        query,
        ...queryCursors,
      });

      const rateLimit = pullRequestResponse.rateLimit;
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
          if (!pullRequestResponse.headRepository) {
            this.logger.warn(
              { pullRequestUrl: pullRequestResponse.url },
              'Unable to fetch inner resources because there is no headRepository for this pull request',
            );
            await iteratee(pullRequestResponse);
            continue;
          }

          // Fetch the remaining inner resources on this PR (this should be rare)
          const [
            repoOwner,
            repoName,
          ] = pullRequestResponse.headRepository.nameWithOwner.split('/');
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
    } while (Object.values(queryCursors).some((c) => !!c));

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
   * @returns A all resources that were queried for in a destructured object. Ex: { pullRequests: [{...}], commits: [{...}] }
   */
  public async fetchFromSingle<T extends GithubResource>(
    baseResource: T,
    selectedResources: GithubResource[],
    extraQueryParams?: { [k: string]: string | number },
    queryCursors: ResourceMap<string> = {},
  ): Promise<QueryResponse<T>> {
    let resources: ResourceMap<any> = {};
    let queryResources = selectedResources;
    let rateLimitConsumed = 0;

    do {
      const queryString = buildGraphQL(
        this.resourceMetadataMap,
        baseResource,
        queryResources,
      );
      this.logger.info({ queryString }, 'Querying with GraphQL');
      const query = this.graph(queryString);
      const response = await query({
        ...extraQueryParams,
        ...queryCursors,
      });

      const rateLimit = response.rateLimit;
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
    } as QueryResponse<T>;
  }

  // TODO: make sure commits are pulled correctly
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
}
