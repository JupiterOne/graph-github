import { GithubResource } from './client';

export interface ResourceMap<T> {
  [resource: string]: T;
}

export interface NestedQueryFactory {
  (children?: string): string;
}

/*
 * Metadata for a resource that is used to construct GraphQL queries and extract
 * relevant data from responses.
 */
export interface ResourceMetadata {
  /*
   * Any GraphQL variables needed for the query. This usually includes the
   * end cursor for pagination in the request to GitHub. Should be in the
   * format of "$variable: String" for direct interpolation into the GraphQL.
   */
  graphRequestVariables: string[];
  /*
   * The GraphQL property of this resource in relation to the root resource.
   * Will be used in the request as a field and to extract the data for that
   * field from the response.
   *
   * If not provided, the key of the ResourceMetadataMap will be defaulted.
   * Examples: GithubResource.Organization, GithubResource.OrganizationMembers, ...
   */
  alternateGraphProperty?: string;
  /*
   * The resources that are nested within this resource. For example, Team
   * Members is a child of Teams.
   */
  children?: GithubResource[];
  /*
   * The resource that this resource is nested within.
   */
  parent?: GithubResource;
  /*
   * The path to the relevant data when parsing a the graphQL response from its root.
   *
   * Example:
   *   When parsing the query:
   *     repository(name: $repoName, owner: $repoOwner) {
   *       pullRequest(number: $pullRequestNumber) {
   *        ...pullRequestFields
   *       }
   *     }
   *   The data we want to retrieve will be at the path "repository.pullRequest"
   */
  pathToDataInGraphQlResponse?: string;
}

/*
 * A hierarchy of nested query factories that is resolved to GraphQL.
 */
export interface QueryHierarchy {
  self: NestedQueryFactory;
  children: QueryHierarchy[];
}

/*
 * A hierarchy of cursors that correspond to nested resource pages in the
 * GraphQL response.
 */
export interface CursorHierarchy {
  /*
   * The root cursor for this resource hierarchy. Nullable because child
   * resources may have more pages when the parent resource does not.
   */
  self: string | null;
  children: {
    [childResource: string]: CursorHierarchy[];
  };
  hasNextPage?: boolean;
}
