import graphql, { GraphQLClient } from 'graphql.js';
import { get } from 'lodash';
import { retry, sleep, AttemptContext } from '@lifeomic/attempt';
import { URL } from 'url';

import {
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

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
import { Octokit } from '@octokit/rest';

export class GitHubGraphQLClient {
  private graph: GraphQLClient;
  private resourceMetadataMap: ResourceMap<ResourceMetadata>;
  private logger: IntegrationLogger;
  private authClient: Octokit;
  private tokenExpires: number;

  constructor(
    token: string,
    tokenExpires: number,
    resourceMetadataMap: ResourceMap<ResourceMetadata>,
    logger: IntegrationLogger,
    authClient: Octokit,
  ) {
    this.graph = graphql('https://api.github.com/graphql', {
      headers: {
        'User-Agent': 'jupiterone-graph-github',
        Authorization: `token ${token}`,
      },
      asJSON: true,
    });
    this.graph.fragment(fragments);
    this.tokenExpires = tokenExpires;
    this.resourceMetadataMap = resourceMetadataMap;
    this.logger = logger;
    this.authClient = authClient;
  }

  private async refreshToken() {
    try {
      const { token, expiresAt } = (await this.authClient.auth({
        type: 'installation',
        refresh: true, //required or else client will return the previous token from cache
      })) as {
        token: string;
        expiresAt: string;
      };
      this.graph = graphql('https://api.github.com/graphql', {
        headers: {
          'User-Agent': 'jupiterone-graph-github',
          Authorization: `token ${token}`,
        },
        asJSON: true,
      });
      this.graph.fragment(fragments);
      this.tokenExpires = parseTimePropertyValue(expiresAt) || 0;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: `https://api.github.com/app/installations/\${installationId}/access_tokens`,
        status: err.status,
        statusText: err.statusText,
      });
    }
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

    let queryPullRequests = this.graph(pullRequestQueryString);

    do {
      if (this.tokenExpires - 60000 < Date.now()) {
        //token expires in less than a minute
        await this.refreshToken();
        queryPullRequests = this.graph(pullRequestQueryString);
      }
      this.logger.info(
        { queryCursors },
        'Fetching batch of pull requests from GraphQL',
      );
      const pullRequestResponse = await this.retryGraphQL(
        pullRequestQueryString,
        async () => {
          return await queryPullRequests({
            query,
            ...queryCursors,
          });
        },
      );
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

    let queryIssues = this.graph(issueQueryString);

    do {
      if (this.tokenExpires - 60000 < Date.now()) {
        //token expires in less than a minute
        await this.refreshToken();
        queryIssues = this.graph(issueQueryString);
      }
      this.logger.info(
        { queryCursors },
        'Fetching batch of issues from GraphQL',
      );
      const issueResponse = await this.retryGraphQL(
        issueQueryString,
        async () => {
          return await queryIssues({
            query,
            ...queryCursors,
          });
        },
      );
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

    let query = this.graph(queryString);

    do {
      if (this.tokenExpires - 60000 < Date.now()) {
        //token expires in less than a minute
        await this.refreshToken();
        query = this.graph(queryString);
      }
      const response = await this.retryGraphQL(queryString, async () => {
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

    /*
      * there is some complicated cursor management happening here that can
      * make debugging difficult in case of GitHub GraphQL API failure
      * 
      * if all has gone well, the return statement below will return an object
      * with a property for each GitHubResource requested (such as 'organization'
      * or 'collaborators'). Each of those properties will be an array of
      * the particular objects appropriate to that resource - generally a flat object
      * with a list of resource-specific properties
      * 
      * Here's a short example of the processed reply provided by all the above code,
      * from our test account, where the requested GitHubResources are
      * 'organization', 'teams', and 'teamRepositories':
      * 
      {
        teamRepositories: [
          {
            node: undefined,
            permission: 'TRIAGE',
            id: 'MDEwOlJlcG9zaXRvcnkzNzE0MTk1OTg=',
            teams: 'MDQ6VGVhbTQ4NTgxNjk='
          },
          {
            node: undefined,
            permission: 'TRIAGE',
            id: 'MDEwOlJlcG9zaXRvcnkzNzE0MTk1OTg=',
            teams: 'MDQ6VGVhbTQ4NTgxNzA='
          }
        ],
        teams: [
          {
            node: undefined,
            id: 'MDQ6VGVhbTQ4NTgxNjk=',
            organization: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz'
          },
          {
            node: undefined,
            id: 'MDQ6VGVhbTQ4NTgxNzA=',
            organization: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz'
          },
        ],
        organization: [ { id: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz' } ],
        rateLimitConsumed: 1
      }
      * 
      * It is possible that the object returned by this function may lack
      * the expected GitHubResource property, leaving the calling function with
      * an undefined response. This happens if there were no instances of that
      * entity returned by the API, either because they don't exist in the
      * account, or something went wrong in GitHub's API processing.
      * 
      */

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

  private async retryGraphQL(queryString: string, query: () => Promise<any>) {
    const { logger } = this;

    //queryWithRateLimitCatch will be passed to the retry function below
    const queryWithRateLimitCatch = async () => {
      let response;
      //check for 4xx/5xx errors
      try {
        response = await query();
      } catch (err) {
        //just wrapping the original error so we can be more specific about the string that caused it
        throw new IntegrationProviderAPIError({
          message: 'Error during GraphQL query',
          status: err.status,
          statusText: `Error msg: ${err.message}, ${err.statusText}, query string: ${queryString}`,
          cause: err,
          endpoint: `GraphQL API 4xx/5xx at GitHubGraphQLClient.ts > retryGraphQL`,
        });
      }

      /*
       * In the case of a successful connection to the GitHub GraphQL API, but an
       * error in processing such as rate-limiting or a malformed query, we might get
       * a [200] code HTML response, but the returned response is an object with just
       * an error message as a string property called `message`
       * Example: {"message":"API rate limit exceeded for 98.53.189.133."}
       */

      if (response.message) {
        if (response.message.includes('rate limit')) {
          logger.warn(
            { response },
            'Hit a rate limit message when attempting to query GraphQL. Waiting before trying again.',
          );
          throw new IntegrationProviderAPIError({
            message: response.message,
            status: 429,
            statusText: `Error msg: ${response.message}, query string: ${queryString}`,
            cause: undefined,
            endpoint: `GraphQL API rate limiting at GitHubGraphQLClient.ts > retryGraphQL`,
          });
        } else {
          throw new IntegrationProviderAPIError({
            message: response.message,
            status: '200 error',
            statusText: `Error msg: ${response.message}, query string: ${queryString}`,
            cause: undefined,
            endpoint: `GraphQL API [200] custom error at GitHubGraphQLClient.ts > retryGraphQL`,
          });
        }
      }

      /*
       * in the happy path, the raw response should be an object with two properties

       * One is `rateLimit`, and it is an object with rate-limiting-related properties
       * such as 'limit', 'cost', 'remaining' and 'resetAt'
       * 
       * The other property will depend on the query. It might be 'organization' for
       * GraphQL queries that start with the org and return entities as sub-objects
       * Or it might be 'search', because the GraphQL query was structured that way 
       * for pull-requests or issues. In some inner-resource fetches, it might be
       * the name of the inner resource. In general, the object structure will mirror
       * the query structure found in queries.ts
       */

      if (!response.rateLimit) {
        throw new IntegrationProviderAPIError({
          message: 'GraphQL reply not valid or in unexpected format',
          status: '200 error',
          statusText: `Raw response properties: ${Object.keys(
            response,
          )}, query string: ${queryString}`,
          cause: undefined,
          endpoint: `GraphQL API failed to find rate limit info at GitHubGraphQLClient.ts > retryGraphQL`,
        });
      }

      /*
       * If we got this far, we have a well-formed GraphQL reply
       * Let's check how close we are to a rate limit, and take a break if needed.
       *
       * When you start using the API, GitHub sets your reset time to one hour in the future.
       * At that time, you get your full limit back. Until then, you do not refresh limits at all.
       * That means that if you burned up all your rate limits in 15 minutes, you're not getting more
       * for another 45 minutes (ie. until your first API calls are an hour old).
       * But then you get your full limit again right on the one hour mark (ie. your rate-limit
       * doesn't trickle in over 15 minutes like in a rolling-window scenario).
       *
       * In most cases, these rate limits are not a problem, but for large accounts they can be
       * They are very likely to become a problem if a customer has other automation hitting
       * these same limits at the same time that this integration is running
       */
      if (
        Number.isInteger(response.rateLimit.remaining) &&
        Number.isInteger(response.rateLimit.limit) &&
        parseTimePropertyValue(response.rateLimit.resetAt)
      ) {
        const thresholdToTakeABreak = 0.1;
        const rateLimitRemainingProportion =
          response.rateLimit.remaining / response.rateLimit.limit;
        const msUntilRateLimitReset =
          parseTimePropertyValue(response.rateLimit.resetAt)! - Date.now();
        if (rateLimitRemainingProportion < thresholdToTakeABreak) {
          this.logger.warn(
            {},
            `Rate limits are down to ${(
              rateLimitRemainingProportion * 100
            ).toPrecision(4)}% remaining, sleeping ${
              msUntilRateLimitReset / 1000
            } sec until ${response.rateLimit.resetAt}`,
          );
          await sleep(msUntilRateLimitReset);
        }
      } else {
        this.logger.warn(
          {},
          'GraphQL API Ratelimit details malformed in response, so could not calculate rate limit remaining',
        );
      }

      return response;
    };

    // Check https://github.com/lifeomic/attempt for options on retry
    return await retry(queryWithRateLimitCatch, {
      maxAttempts: 8,
      delay: 30_000, //30 seconds to start
      factor: 2, //exponential backoff factor. with 30 sec start and 8 attempts, longest delay is 64 min
      handleError(error: any, attemptContext: AttemptContext) {
        /* retry will keep trying to the limits of retryOptions
         * but it lets you intervene in this function - if you throw an error from in here,
         * it stops retrying. Otherwise you can just log the attempts.
         *
         * Github has "Secondary Rate Limits" in case of excessive polling or very costly API calls.
         * GitHub guidance is to "wait a few minutes" when we get one of these errors.
         * https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
         * this link is REST specific - however, the limits might apply to GraphQL as well,
         * and our GraphQL client is not using the @octokit throttling and retry plugins like our REST client
         * therefore some retry logic is appropriate here
         */

        // don't keep trying if it's not going to get better
        if (
          error.retryable === false ||
          error.status === 401 ||
          error.status === 403
        ) {
          logger.warn(
            { attemptContext, error },
            `Hit an unrecoverable error ${error.status} when attempting to query GraphQL. Aborting.`,
          );
          attemptContext.abort();
          throw error;
        }

        if (error.statusText?.includes('exceeded a secondary rate limit')) {
          logger.info(
            { attemptContext, error },
            '"Secondary Rate Limit" message received.',
          );
        }

        logger.warn(
          { attemptContext, error },
          `Hit a possibly recoverable error ${error.status} when attempting to query GraphQL. Waiting before trying again.`,
        );
      },
    });
  }
}
