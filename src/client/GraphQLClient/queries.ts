/**
 * GraphQL queries used for various resource requests
 *
 * Note that the spread-like syntax below ultimately references fragments.ts via a function
 * built-in to graphql.js. (For another example of how that works, see
 * https://www.apollographql.com/docs/react/data/fragments/ ).
 *
 * The actual GraphQL query that hits the API will have substituted in the parameters
 * and expanded the fragments.
 *
 */

export const ACCOUNT_QUERY_STRING = `query ($login: String!) {
    organization(login: $login) {
        id
        ...organizationFields

      }
...rateLimit
  }`;

export const REPOS_QUERY_STRING = `query ($login: String!, $repositories: String) {
      organization(login: $login) {
          id
          ...organizationFields
          repositories(first: 100, after: $repositories) {
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
    }`;

export const USERS_QUERY_STRING = `query ($login: String!, $membersWithRole: String) {
    organization(login: $login) {
        id
        ...organizationFields
        membersWithRole(first: 100, after: $membersWithRole) {
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
  }`;

export const TEAMS_QUERY_STRING = `query ($login: String!, $teams: String) {
    organization(login: $login) {
        id
        ...organizationFields
        teams(first: 100, after: $teams) {
        edges {
          node {
            id
            ...teamFields

          }
        }
        pageInfo {
  endCursor
  hasNextPage
}
      }
      }
...rateLimit
  }`;

export const TEAM_MEMBERS_QUERY_STRING = `query ($login: String!, $teams: String, $members: String) {
    organization(login: $login) {
        id
        ...organizationFields
        teams(first: 100, after: $teams) {
        edges {
          node {
            id
            ...teamFields
            members(first: 100, after: $members) {
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
  }`;

export const TEAM_REPOS_QUERY_STRING = `query ($login: String!, $teams: String, $teamRepositories: String) {
    organization(login: $login) {
        id
        ...organizationFields
        teams(first: 100, after: $teams) {
        edges {
          node {
            id
            ...teamFields
            repositories(first: 100, after: $teamRepositories) {
        edges {
          node {
            id
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
      }
...rateLimit
  }`;

export const ISSUES_QUERY_STRING = `query ($query: String!, $issues: String, $assignees: String, $labels: String) {
    search(first: 25, after: $issues, type: ISSUE, query: $query) {
        issueCount
        edges {
          node {
            ...issueFields
            ... on Issue {
          assignees(first: 100, after: $assignees) {
          totalCount
          edges {
            node {
              name
              login
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
... on Issue {
          labels(first: 100, after: $labels) {
          totalCount
          edges {
            node {
              id
              name
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
          }
        }
        pageInfo {
  endCursor
  hasNextPage
}
      }
...rateLimit
  }`;

export const PULL_REQUESTS_QUERY_STRING = `query ($query: String!, $pullRequests: String, $commits: String, $reviews: String, $labels: String) {
    search(first: 25, after: $pullRequests, type: ISSUE, query: $query) {
        issueCount
        edges {
          node {
            ...pullRequestFields
            ... on PullRequest {
        commits(first: 100, after: $commits) {
          totalCount
          edges {
            node {
              commit {
                ...commitFields
              }
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
... on PullRequest {
        reviews(first: 100, after: $reviews) {
          totalCount
          edges {
            node {
              ...reviewFields
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
... on PullRequest {
          labels(first: 100, after: $labels) {
          totalCount
          edges {
            node {
              id
              name
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
          }
        }
        pageInfo {
  endCursor
  hasNextPage
}
      }
...rateLimit
  }`;

export const SINGLE_PULL_REQUEST_QUERY_STRING = `query ($pullRequestNumber: Int!, $repoName: String!, $repoOwner: String!, $commits: String, $reviews: String, $labels: String) {
    repository(name: $repoName, owner: $repoOwner) {
          pullRequest(number: $pullRequestNumber) {
            ...pullRequestFields
            ... on PullRequest {
        commits(first: 100, after: $commits) {
          totalCount
          edges {
            node {
              commit {
                ...commitFields
              }
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
... on PullRequest {
        reviews(first: 100, after: $reviews) {
          totalCount
          edges {
            node {
              ...reviewFields
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
... on PullRequest {
          labels(first: 100, after: $labels) {
          totalCount
          edges {
            node {
              id
              name
            }
          }
          pageInfo {
  endCursor
  hasNextPage
}
        }
      }
          }
      }
...rateLimit
  }`;
