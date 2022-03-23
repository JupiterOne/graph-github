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
 * Note that if a GraphQL query pulls too much data, it will throw an error. This is especially
 * likely in cases where there are many nested objects, such as TEAM_REPOS_QUERY_STRING below,
 * where the query requests every repo assigned to every team. In such cases, the pagination
 * can be altered by changing the "first" parameter. We have often done this from 100 to 25 in
 * cases where we are concerned about large data returns.
 *
 */

export const MAX_REQUESTS_NUM = 100;
export const LIMITED_REQUESTS_NUM = 25; //this is sometimes used to avoid errors

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
          repositories(first: ${MAX_REQUESTS_NUM}, after: $repositories) {
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
        membersWithRole(first: ${MAX_REQUESTS_NUM}, after: $membersWithRole) {
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

// TODO: Should this argument be using `last` instead of `first` to get the most
// recent? Would that require changing `after` to `before` so that we can walk back?
// See https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#example-query
/**
 * A GraphQL query for fetching public repository data. This fetches data
 * visible to everyone without requiring Repository Content permissions.
 */
export const PUBLIC_REPO_PULL_REQUESTS_QUERY_STRING = `
  query ($query: String!, $pullRequests: String, $commits: String, $reviews: String, $labels: String) {
    search(first: ${LIMITED_REQUESTS_NUM}, after: $pullRequests, type: ISSUE, query: $query) {
      issueCount
      edges {
        node {
          ...pullRequestFields
          ... on PullRequest {
            commits(first: ${MAX_REQUESTS_NUM}, after: $commits) {
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
            reviews(first: ${MAX_REQUESTS_NUM}, after: $reviews) {
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
            labels(first: ${MAX_REQUESTS_NUM}, after: $labels) {
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
        commits(first: ${MAX_REQUESTS_NUM}, after: $commits) {
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
        reviews(first: ${MAX_REQUESTS_NUM}, after: $reviews) {
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
          labels(first: ${MAX_REQUESTS_NUM}, after: $labels) {
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

/**
 * Because teams are not top-level objects in GraphQL, we have to pull them using a slug under organization
 */

export const SINGLE_TEAM_MEMBERS_QUERY_STRING = `query ($login: String!, $slug: String!, $members: String) {
  organization(login: $login) {
      id
      team(slug: $slug) {
          id
          name
          members(first: ${MAX_REQUESTS_NUM}, after: $members) {
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
...rateLimit
}`;
