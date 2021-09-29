import { ResourceMap, ResourceMetadata, GithubResource } from './types';

const pageInfo = `pageInfo {
  endCursor
  hasNextPage
}`;

/**
 * Resource Metadata Map notes
 *
 * The idea is to store GraphQL object structure here so that queries with multiple levels
 * can be spontaneously built from these pieces. Generally, objects do not have a notion of
 * parent - instead, base objects have the notion of children, and our GraphQL query-assembling
 * code can walk that tree to assemble the nested GraphQL query that will be sent to GitHub's API
 *
 * Base objects often need a string to pin down which object(s) you need. For example, the
 * Organization base object requires a string for the login of the organization. There is
 * sometimes a choice about whether to implement an object as a base object with appropriate
 * parameters to locate it, or as the child of a parent object which locates the child through
 * their relationship.
 *
 * For example, GithubResource.Organization is implemented here as a base object, and it has children
 * of .OrganizationMembers, .Teams, .TeamMembers, and .Repositories.
 *
 * GithubResource.PullRequests is implemented as a base object, rather than as a child of .Repositories.
 * Therefore, the appropriate pull requests are found by passing in a string with filters based on
 * pull request type and the repo name. PullRequests has children .Commits, .Reviews, and .Labels.
 * PullRequests could have been implemented as a child object of .Repositories, but it was not because
 * the hierarchy would be getting pretty deep by the time we included Pull Request's children, and that
 * increases the risk that a failure during pagination of such a huge call creates propagating failures
 * that are difficult to troubleshoot.
 */

export default function (
  pageLimit: number = 100,
  pullRequestPageLimit: number = 25,
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
      ) => `search(first: ${pullRequestPageLimit}, after: $${GithubResource.PullRequests}, type: ISSUE, query: $query) {
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
    [GithubResource.Issues]: {
      graphRequestVariables: [
        '$query: String!',
        `$${GithubResource.Issues}: String`,
      ],
      factory: (
        children: string = '',
      ) => `search(first: ${pullRequestPageLimit}, after: $${GithubResource.Issues}, type: ISSUE, query: $query) {
        issueCount
        edges {
          node {
            ...issueFields
            ${children}
          }
        }
        ${pageInfo}
      }`,
      children: [],
    },
    [GithubResource.Organization]: {
      graphRequestVariables: ['$login: String!'],
      pathToDataInGraphQlResponse: 'organization',
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
    },
  };
}
