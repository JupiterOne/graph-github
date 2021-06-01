import graphql, { GraphQLClient } from 'graphql.js';

import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import fragments from './fragments';
import {
  OrganizationResource,
  ResourceMap,
  OrganizationResourcesQueryResponse,
  ResourceMetadata,
} from './types';
import buildGraphQL from './buildGraphQL';
import {
  extractSelectedResources,
  mapResponseCursorsForQuery,
  mapResponseResourcesForQuery,
} from './response';

export class GitHubGraphQLClient {
  private graph: GraphQLClient;
  private resourceMetadataMap: ResourceMap<ResourceMetadata>;
  private logger: IntegrationLogger;

  constructor(
    token: string,
    resourceMetadataMap: ResourceMap<ResourceMetadata>,
    logger: IntegrationLogger
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

  // TODO: Derive return type from selectedResources to avoid having to
  // force-unwrap properties in consumers.
  public async fetchOrganization(
    organizationLogin: string,
    selectedResources: OrganizationResource[]
  ): Promise<OrganizationResourcesQueryResponse> {
    const resources: ResourceMap<any> = {};
    let queryCursors: ResourceMap<string> = {};
    let queryResources = selectedResources;
    let rateLimitConsumed = 0;

    do {
      const organizationQueryString = buildGraphQL(
        this.resourceMetadataMap,
        queryResources
      );
      this.logger.info(
        {
          organizationQueryString,
        },
        'Querying with GraphQL'
      );

      const queryOrganization = this.graph(organizationQueryString);

      const response = await queryOrganization({
        login: organizationLogin,
        ...queryCursors,
      });

      const rateLimit = response.rateLimit;
      rateLimitConsumed += rateLimit.cost;

      const organizationData = response.organization;

      const {
        resources: pageResources,
        cursors: pageCursors,
      } = extractSelectedResources(
        selectedResources,
        this.resourceMetadataMap,
        organizationData
      );

      for (const [resource, data] of Object.entries(pageResources)) {
        if (!resources[resource]) {
          resources[resource] = data;
          continue;
        }

        for (const item of data) {
          if (
            !resources[resource].find((r: any) => {
              const found = r.id === item.id;
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

      queryCursors = mapResponseCursorsForQuery(pageCursors, queryCursors);
      queryResources = mapResponseResourcesForQuery(
        pageCursors,
        this.resourceMetadataMap,
        selectedResources
      ) as OrganizationResource[];
    } while (Object.values(queryCursors).some(c => !!c));

    return {
      organization: resources.organization,
      ...resources,
      rateLimitConsumed,
    };
  }
}
