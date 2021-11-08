import { ResourceMap, ResourceMetadata, GithubResource } from './types';

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

export default function (): ResourceMap<ResourceMetadata> {
  return {
    [GithubResource.PullRequest]: {
      graphRequestVariables: [
        '$pullRequestNumber: Int!',
        '$repoName: String!',
        '$repoOwner: String!',
      ],
      pathToDataInGraphQlResponse: 'repository.pullRequest',
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
      children: [
        GithubResource.Commits,
        GithubResource.Reviews,
        GithubResource.Labels,
      ],
    },
    [GithubResource.Commits]: {
      graphRequestVariables: [`$${GithubResource.Commits}: String`],
    },
    [GithubResource.Reviews]: {
      graphRequestVariables: [`$${GithubResource.Reviews}: String`],
    },
    [GithubResource.Labels]: {
      graphRequestVariables: [`$${GithubResource.Labels}: String`],
    },
    [GithubResource.Issues]: {
      graphRequestVariables: [
        '$query: String!',
        `$${GithubResource.Issues}: String`,
      ],
      children: [GithubResource.Assignees, GithubResource.LabelsOnIssues],
    },
    [GithubResource.Assignees]: {
      graphRequestVariables: [`$${GithubResource.Assignees}: String`],
    },
    [GithubResource.LabelsOnIssues]: {
      graphRequestVariables: [`$${GithubResource.Labels}: String`],
    },
    [GithubResource.Organization]: {
      graphRequestVariables: ['$login: String!'],
      pathToDataInGraphQlResponse: 'organization',
      children: [
        GithubResource.OrganizationMembers,
        GithubResource.Teams,
        GithubResource.TeamMembers,
        GithubResource.Repositories,
      ],
    },
    [GithubResource.OrganizationMembers]: {
      graphRequestVariables: [`$${GithubResource.OrganizationMembers}: String`],
    },
    [GithubResource.Teams]: {
      graphRequestVariables: ['$teams: String'],
      children: [GithubResource.TeamMembers, GithubResource.TeamRepositories],
    },
    [GithubResource.TeamMembers]: {
      graphRequestVariables: [`$${GithubResource.TeamMembers}: String`],
      parent: GithubResource.Teams,
    },
    [GithubResource.TeamRepositories]: {
      graphRequestVariables: [`$${GithubResource.TeamRepositories}: String`],
      alternateGraphProperty: GithubResource.Repositories, // Need this alternative graphProperty in order to because still searching for repositories, just under teams
      parent: GithubResource.Teams,
    },
    [GithubResource.Repositories]: {
      graphRequestVariables: [`$${GithubResource.Repositories}: String`],
      children: [GithubResource.Collaborators],
    },
    [GithubResource.Collaborators]: {
      graphRequestVariables: [`$${GithubResource.Collaborators}: String`],
      parent: GithubResource.Repositories,
    },
  };
}
