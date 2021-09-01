import {
  ResourceMap,
  OrganizationResource,
  ResourceMetadata,
  PullRequestResource,
} from './types';

const pageInfo = `pageInfo {
  endCursor
  hasNextPage
}`;

export default function (
  pageLimit: number = 100,
): ResourceMap<ResourceMetadata> {
  return {
    [PullRequestResource.PullRequests]: {
      graphRequestVariable: `$pullRequests: String`,
      graphRequestVariable2: '$query: String!',
      pathToDataInGraphQlResponse: 'search.edges[0].node',
      graphProperty: 'pullRequests',
      factory: (
        children: string = '',
      ) => `search(first: ${pageLimit}, after: $pullRequests, type: ISSUE, query: $query) {
        issueCount
        edges {
          node {
            ...pullRequestFields
            ${children}
          }
        }

        ${pageInfo}
      }`,
      children: [
        PullRequestResource.Commits,
        PullRequestResource.Reviews,
        PullRequestResource.Labels,
      ],
    },
    [PullRequestResource.Commits]: {
      graphRequestVariable: '$commits: String',
      graphProperty: 'commits',
      factory: () => `... on PullRequest {
        commits(first: ${pageLimit}, after: $commits) {
          totalCount
          edges {
            node {
              commit {
                ...commitFields
              }
            }
          }

          ${pageInfo}
        }
      }`,
    },
    [PullRequestResource.Reviews]: {
      graphRequestVariable: '$reviews: String',
      graphProperty: 'reviews',
      factory: () => `... on PullRequest {
        reviews(first: ${pageLimit}, after: $reviews) {
          totalCount
          edges {
            node {
              ...reviewFields
            }
          }

          ${pageInfo}
        }
      }`,
    },
    [PullRequestResource.Labels]: {
      graphRequestVariable: '$labels: String',
      graphProperty: 'labels',
      factory: () => `... on PullRequest {
          labels(first: ${pageLimit}, after: $labels) {
          totalCount
          edges {
            node {
              id
              name
            }
          }

          ${pageInfo}
        }
      }`,
    },
    [OrganizationResource.Organization]: {
      graphRequestVariable: '$login: String!',
      pathToDataInGraphQlResponse: 'organization',
      graphProperty: 'organization',
      factory: (children: string = '') => `organization(login: $login) {
        id
        ...organizationFields
        ${children}
      }`,
    },
    [OrganizationResource.Members]: {
      graphRequestVariable: '$members: String',
      graphProperty: 'membersWithRole',
      factory: (
        children: string = '',
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
      }`,
    },
    [OrganizationResource.Teams]: {
      graphRequestVariable: '$teams: String',
      graphProperty: 'teams',
      factory: (
        children: string = '',
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
        OrganizationResource.TeamRepositories,
      ],
    },
    [OrganizationResource.TeamMembers]: {
      graphRequestVariable: '$teamMembers: String',
      graphProperty: 'members',
      factory: (
        children: string = '',
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
      parent: OrganizationResource.Teams,
    },
    [OrganizationResource.TeamRepositories]: {
      graphRequestVariable: '$teamRepositories: String',
      graphProperty: 'repositories',
      factory: (
        children: string = '',
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
      parent: OrganizationResource.Teams,
    },
    [OrganizationResource.Repositories]: {
      graphRequestVariable: '$repositories: String',
      graphProperty: 'repositories',
      factory: (
        children: string = '',
      ) => `repositories(first: ${pageLimit}, after: $repositories) {
        edges {
          node {
            id
            ...repositoryFields
            ${children}
          }
        }

        ${pageInfo}
      }`,
      children: [OrganizationResource.RepositoryCollaborators],
    },
    //this is not quite working right yet
    [OrganizationResource.RepositoryCollaborators]: {
      graphRequestVariable: '$repositoryCollaborators: String',
      graphProperty: 'collaborators',
      factory: (
        children: string = '',
      ) => `collaborators(first: ${pageLimit}, after: $repositoryCollaborators) {
        edges {
          node {
            id
            ...userFields
            ${children}
          }
         
        },
        nodes {
          ...userFields
        }
        ${pageInfo}
      }`,
      parent: OrganizationResource.Repositories,
    },
  };
}
