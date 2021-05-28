import { ResourceMap, OrganizationResource, ResourceMetadata } from './types';

const pageInfo = `pageInfo {
  endCursor
  hasNextPage
}`;

export default function(
  pageLimit: number = 100
): ResourceMap<ResourceMetadata> {
  return {
    [OrganizationResource.Organization]: {
      graphRequestVariable: '$login: String!',
      graphProperty: 'organization',
      factory: (children: string = '') => `organization(login: $login) {
        id
        ...organizationFields
        ${children}
      }`
    },
    [OrganizationResource.Members]: {
      graphRequestVariable: '$members: String',
      graphProperty: 'membersWithRole',
      factory: (
        children: string = ''
      ) => `membersWithRole(first: ${pageLimit}, after: $members) {
        edges {
          node {
            id
            ...userFields
            ${children}
          }

          ...userEdgeFields
        }

        ${pageInfo}
      }`
    },
    [OrganizationResource.Teams]: {
      graphRequestVariable: '$teams: String',
      graphProperty: 'teams',
      factory: (
        children: string = ''
      ) => `teams(first: ${pageLimit}, after: $teams) {
        edges {
          node {
            id
            ...teamFields
            ${children}
          }
        }

        ${pageInfo}
      }`,
      children: [
        OrganizationResource.TeamMembers,
        OrganizationResource.TeamRepositories
      ]
    },
    [OrganizationResource.TeamMembers]: {
      graphRequestVariable: '$teamMembers: String',
      graphProperty: 'members',
      factory: (
        children: string = ''
      ) => `members(first: ${pageLimit}, after: $teamMembers) {
        edges {
          node {
            id
            ...teamMemberFields
            ${children}
          }

          ...teamMemberEdgeFields
        }

        ${pageInfo}
      }`,
      parent: OrganizationResource.Teams
    },
    [OrganizationResource.TeamRepositories]: {
      graphRequestVariable: '$teamRepositories: String',
      graphProperty: 'repositories',
      factory: (
        children: string = ''
      ) => `repositories(first: ${pageLimit}, after: $teamRepositories) {
        edges {
          node {
            id
            ...repositoryFields
            ${children}
          }

          ...teamRepositoryEdgeFields
        }

        ${pageInfo}
      }`,
      parent: OrganizationResource.Teams
    },
    [OrganizationResource.Repositories]: {
      graphRequestVariable: '$repositories: String',
      graphProperty: 'repositories',
      factory: (
        children: string = ''
      ) => `repositories(first: ${pageLimit}, after: $repositories) {
        edges {
          node {
            id
            ...repositoryFields
            ${children}
          }
        }

        ${pageInfo}
      }`
    }
  };
}
