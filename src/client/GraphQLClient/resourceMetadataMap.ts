import { ResourceMap, ResourceMetadata, GithubResource } from './types';

const pageInfo = `pageInfo {
  endCursor
  hasNextPage
}`;

export default function (
  pageLimit: number = 100,
): ResourceMap<ResourceMetadata> {
  return {
    [GithubResource.PullRequest]: {
      graphRequestVariables: [
        '$pullRequestNumber: Int!',
        '$repoName: String!',
        '$repoOwner: String!',
      ],
      pathToDataInGraphQlResponse: 'repository.pullRequest',
      factory: (
        children: string = '',
      ) => `repository(name: $repoName, owner: $repoOwner) {
          ${GithubResource.PullRequest}(number: $pullRequestNumber) {
            ...pullRequestFields
            ${children}
          }
      }`,
      children: [
        GithubResource.Commits,
        GithubResource.Reviews,
        GithubResource.Labels,
      ],
    },
    [GithubResource.PullRequests]: {
      graphRequestVariables: [
        '$query: String!',
        `$${GithubResource.PullRequests}: String`,
      ],
      factory: (
        children: string = '',
      ) => `search(first: ${pageLimit}, after: $${GithubResource.PullRequests}, type: ISSUE, query: $query) {
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
        GithubResource.Commits,
        GithubResource.Reviews,
        GithubResource.Labels,
      ],
    },
    [GithubResource.Commits]: {
      graphRequestVariables: [`$${GithubResource.Commits}: String`],
      factory: () => `... on PullRequest {
        ${GithubResource.Commits}(first: ${pageLimit}, after: $${GithubResource.Commits}) {
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
    [GithubResource.Reviews]: {
      graphRequestVariables: [`$${GithubResource.Reviews}: String`],
      factory: () => `... on PullRequest {
        ${GithubResource.Reviews}(first: ${pageLimit}, after: $${GithubResource.Reviews}) {
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
    [GithubResource.Labels]: {
      graphRequestVariables: [`$${GithubResource.Labels}: String`],
      factory: () => `... on PullRequest {
          ${GithubResource.Labels}(first: ${pageLimit}, after: $${GithubResource.Labels}) {
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
    [GithubResource.Organization]: {
      graphRequestVariables: ['$login: String!'],
      pathToDataInGraphQlResponse: 'organization', // TODO: figure out if this is necessary
      factory: (
        children: string = '',
      ) => `${GithubResource.Organization}(login: $login) {
        id
        ...organizationFields
        ${children}
      }`,
      children: [
        GithubResource.OrganizationMembers,
        GithubResource.Teams,
        GithubResource.TeamMembers,
        GithubResource.Repositories,
      ],
    },
    [GithubResource.OrganizationMembers]: {
      graphRequestVariables: [`$${GithubResource.OrganizationMembers}: String`],
      factory: (
        children: string = '',
      ) => `${GithubResource.OrganizationMembers}(first: ${pageLimit}, after: $${GithubResource.OrganizationMembers}) {
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
    [GithubResource.Teams]: {
      graphRequestVariables: ['$teams: String'],
      factory: (
        children: string = '',
      ) => `${GithubResource.Teams}(first: ${pageLimit}, after: $teams) {
        edges {
          node {
            id
            ...teamFields
            ${children}
          }
        }
        ${pageInfo}
      }`,
      children: [GithubResource.TeamMembers, GithubResource.TeamRepositories],
    },
    [GithubResource.TeamMembers]: {
      graphRequestVariables: [`$${GithubResource.TeamMembers}: String`],
      factory: (
        children: string = '',
      ) => `${GithubResource.TeamMembers}(first: ${pageLimit}, after: $${GithubResource.TeamMembers}) {
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
      parent: GithubResource.Teams,
    },
    [GithubResource.TeamRepositories]: {
      graphRequestVariables: [`$${GithubResource.TeamRepositories}: String`],
      alternateGraphProperty: GithubResource.Repositories, // Need this alternative graphProperty in order to because still searching for repositories, just under teams
      factory: (
        children: string = '',
      ) => `${GithubResource.Repositories}(first: ${pageLimit}, after: $${GithubResource.TeamRepositories}) {
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
      parent: GithubResource.Teams,
    },
    [GithubResource.Repositories]: {
      graphRequestVariables: [`$${GithubResource.Repositories}: String`],
      factory: (
        children: string = '',
      ) => `${GithubResource.Repositories}(first: ${pageLimit}, after: $${GithubResource.Repositories}) {
        edges {
          node {
            id
            ...repositoryFields
            ${children}
          }
        }
        ${pageInfo}
      }`,
      // children: [GithubResource.RepositoryCollaborators],
    },
    //this is not quite working right yet
    // [GithubResource.RepositoryCollaborators]: {
    //   graphRequestVariables: ['$repositoryCollaborators: String'],
    //   factory: (
    //     children: string = '',
    //   ) => `collaborators(first: ${pageLimit}, after: $repositoryCollaborators) {
    //     edges {
    //       node {
    //         id
    //         ...userFields
    //         ${children}
    //       }

    //     },
    //     nodes {
    //       ...userFields
    //     }
    //     ${pageInfo}
    //   }`,
    //   parent: GithubResource.Repositories,
    // },
  };
}
