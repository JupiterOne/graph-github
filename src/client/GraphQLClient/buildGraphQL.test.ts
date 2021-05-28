import buildGraphQL from './buildGraphQL';
import resourceMetadataMap from './resourceMetadataMap';
import { OrganizationResource } from './types';

describe('resource-based query generation', () => {
  function clean(gql: string) {
    return gql.replace(/\s/g, '');
  }

  const metadataMap = resourceMetadataMap(1);
  const gql = (queryResources: OrganizationResource[]) => {
    return buildGraphQL(metadataMap, queryResources);
  };

  test('base resource only', () => {
    const graphQL = gql([]);
    expect(clean(graphQL)).toMatch(
      clean(`
      query ($login: String!) {
        organization(login: $login) {
          id
          ...organizationFields
        }

        ...rateLimit
      }
    `)
    );
  });

  test('single resource', () => {
    const graphQL = gql([OrganizationResource.Members]);
    expect(clean(graphQL)).toMatch(
      clean(`
      query ($login: String!, $members: String) {
        organization(login: $login) {
          id
          ...organizationFields
          membersWithRole(first: 1, after: $members) {
            edges {
              node {
                id
                ...userFields
              }

              ...userEdgeFields
            }

            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }

        ...rateLimit
      }
    `)
    );
  });

  test('resources with identical graph properties', () => {
    const graphQL = gql([
      OrganizationResource.TeamRepositories,
      OrganizationResource.Repositories
    ]);
    expect(clean(graphQL)).toMatch(
      clean(`
      query ($login: String!, $teams: String, $teamRepositories: String, $repositories: String) {
        organization(login: $login) {
          id
          ...organizationFields
          teams(first: 1, after: $teams) {
            edges {
              node {
                id
                ...teamFields
                repositories(first: 1, after: $teamRepositories) {
                  edges {
                    node {
                      id
                      ...repositoryFields
                    }

                    ...teamRepositoryEdgeFields
                  }

                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
            }

            pageInfo {
              endCursor
              hasNextPage
            }
          }

          repositories(first: 1, after: $repositories) {
            edges {
              node {
                id
                ...repositoryFields
              }
            }

            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }

        ...rateLimit
      }
      `)
    );
  });

  describe('resources with children', () => {
    const expected = `
      query ($login: String!, $teams: String, $teamMembers: String) {
        organization(login: $login) {
          id
          ...organizationFields
          teams(first: 1, after: $teams) {
            edges {
              node {
                id
                ...teamFields
                members(first: 1, after: $teamMembers) {
                  edges {
                    node {
                      id
                      ...teamMemberFields
                    }

                    ...teamMemberEdgeFields
                  }

                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
            }

            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }

        ...rateLimit
      }
    `;

    test('child resource only', () => {
      const graphQL = gql([OrganizationResource.TeamMembers]);
      expect(clean(graphQL)).toMatch(clean(expected));
    });

    test('child resource before parent', () => {
      const graphQL = gql([
        OrganizationResource.TeamMembers,
        OrganizationResource.Teams
      ]);
      expect(clean(graphQL)).toMatch(clean(expected));
    });
  });
});
