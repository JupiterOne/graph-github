## Creating GraphQL Queries

When creating a new query, consider the query as a new domain being added to the
project. To prevent needing to setup a new GitHub organization that has test
data, request access to the
[j1-ingest organization](https://github.com/j1-ingest).

Each query requires:

1. The actual GraphQL query and query variables.
2. Ability to extract data from response and handle pagination
3. Respect rate limits
4. Refresh token as needed
5. Handle errors

1 & 2 are specific to the query while 3-5 can be handled generically.

### How-To:

1. Create new directory in /GraphQLClient (e.g. pullRequestQueries)
2. Implement method to construct the new GraphQL query using the BuildQuery
   interface.
   ```typescript
   type BuildQuery<P, S extends BaseQueryState> = (
     queryParams: P,
     queryState?: S,
   ) => ExecutableQuery;
   ```
   - Consider this
     [doc](https://docs.github.com/en/graphql/overview/resource-limitations) to
     understand how rate limit costs are calculated. Using the queryState
     dynamically build the query string to reduce rate costs, if applicable.
3. Implement response processing method to transform the response into an object
   ready to be passed to the `iteratee`. This method is unique to the query.
   During processing of the data, the `rateLimit` and `pageInfo` data should be
   returned.
4. Implement the `iterate<resource-name>` function following the
   `IteratePagination` interface:
   ```typescript
   type IteratePagination<P, I> = (
     queryParams: P,
     iteratee: ResourceIteratee<I>,
     execute: QueryExecutor,
   ) => Promise<GithubQueryResponse>;
   ```
   - Use the execute method to query the server.
   - Keep track of the total cost during pagination.
5. Add tests that validate pagination is working correctly.
6. Add tests that validate partial responses are handled gracefully.

### Best Practices

- If a GraphQL query pulls too much data, it will throw an error. This is
  especially likely in cases where there are many nested objects, such as the
  TeamRepositoryQuery, where the query requests every repo assigned to every
  team. In such cases, the pagination can be altered by changing the "first"
  parameter. We have often done this from 100 to 25 in cases where we are
  concerned about large data returns.

## Example GraphQL Errors

### 2022-4-28: Update error handling and examples

Check out the client documentation
https://github.com/octokit/graphql.js/#errors. This is a redacted example of a
FORBIDDEN error. Note that a partial dataset is included in the response.

```json5
{
  request: {
    query: '\n query (\n $pullRequestNumber: Int!\n $repoName: String!\n $repoOwner: String!\n $maxLimit: Int!\n $commitsCursor: String\n $reviewsCursor: String\n $labelsCursor: String\n ) {\n repository(name: $repoName, owner: $repoOwner) {\n pullRequest(number: $pullRequestNumber) {\n ...\n on PullRequest {\n additions\n author {\n ...on User {\n name\n login\n }\n }\n authorAssociation\n baseRefName\n baseRefOid\n baseRepository {\n name\n url\n owner {\n ...on RepositoryOwner {\n login\n id\n url\n }\n }\n }\n body\n changedFiles\n checksUrl\n closed\n closedAt\n # comments # Maybe someday\n createdAt\n databaseId\n deletions\n editor {\n ...on User {\n login\n name\n isSiteAdmin\n company\n createdAt\n databaseId\n email\n isEmployee\n location\n updatedAt\n url\n websiteUrl\n }\n }\n # files # Maybe someday\n headRefName\n headRefOid\n headRepository {\n name\n owner {\n ...on RepositoryOwner {\n login\n id\n url\n }\n }\n }\n id\n isDraft\n lastEditedAt\n locked\n mergeCommit {\n ...on Commit {\n id\n oid\n message\n authoredDate\n changedFiles\n commitUrl\n author {\n date\n user {\n login # this used to be ...userFields\n }\n }\n }\n }\n mergeable\n merged\n mergedAt\n mergedBy {\n ...on User {\n name\n login\n }\n }\n number\n permalink\n publishedAt\n reviewDecision\n # reviewRequests # Maybe someday\n state\n # suggestedReviewers # Maybe someday\n title\n updatedAt\n url\n }\n \n commits(first: $maxLimit, after: $commitsCursor) {\n totalCount\n nodes {\n commit {\n ...on Commit {\n id\n oid\n message\n authoredDate\n changedFiles\n commitUrl\n author {\n date\n user {\n login # this used to be ...userFields\n }\n }\n }\n }\n }\n \n pageInfo {\n endCursor\n hasNextPage\n }\n }\n \n reviews(first: $maxLimit, after: $reviewsCursor) {\n totalCount\n nodes {\n ...on PullRequestReview {\n id\n commit {\n oid\n }\n author {\n ...on User {\n name\n login\n }\n }\n state\n submittedAt\n updatedAt\n url\n }\n }\n pageInfo {\n endCursor\n hasNextPage\n }\n }\n \n labels(first: $maxLimit, after: $labelsCursor) {\n totalCount\n nodes {\n id\n name\n }\n pageInfo {\n endCursor\n hasNextPage\n }\n } \n }\n }\n ...on Query {\n rateLimit {\n limit\n cost\n remaining\n resetAt\n }\n }\n }',
    variables: {
      pullRequestNumber: 9988,
      repoName: 'Bob-Backend',
      repoOwner: 'bob',
      maxLimit: 100,
    },
  },
  headers: {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset',
    connection: 'close',
    'content-encoding': 'gzip',
    'content-security-policy': "default-src 'none'",
    'content-type': 'application/json; charset=utf-8',
    date: 'Thu, 28 Apr 2022 02:28:18 GMT',
    'referrer-policy': 'origin-when-cross-origin, strict-origin-when-cross-origin',
    server: 'GitHub.com',
    'strict-transport-security': 'max-age=31536000; includeSubdomains; preload',
    'transfer-encoding': 'chunked',
    vary: 'Accept-Encoding, Accept, X-Requested-With',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'deny',
    'x-github-media-type': 'github.v3; format=json',
    'x-github-request-id': 'D404:0565:3FA285:9692F0:6269FBC1',
    'x-ratelimit-limit': '12500',
    'x-ratelimit-remaining': '11755',
    'x-ratelimit-reset': '1651115149',
    'x-ratelimit-resource': 'graphql',
    'x-ratelimit-used': '745',
    'x-xss-protection': '0',
  },
  response: {
    data: 'see root level data object',
    errors: 'see root level errors object',
    queryString: 'see root level queryString property',
    queryVariables: 'see root level queryVariables property',
  },
  name: 'GraphqlResponseError',
  errors: [
    {
      type: 'FORBIDDEN',
      path: ['repository', 'pullRequest', 'commits', 'nodes', 0],
      extensions: {
        saml_failure: false,
      },
      locations: [
        {
          line: 117,
          column: 7,
        },
      ],
      message: 'Resource not accessible by integration',
    },
    {
      type: 'FORBIDDEN',
      path: ['repository', 'pullRequest', 'commits', 'nodes', 1],
      extensions: {
        saml_failure: false,
      },
      locations: [
        {
          line: 117,
          column: 7,
        },
      ],
      message: 'Resource not accessible by integration',
    },
    {
      type: 'FORBIDDEN',
      path: ['repository', 'pullRequest', 'commits', 'nodes', 2],
      extensions: {
        saml_failure: false,
      },
      locations: [
        {
          line: 117,
          column: 7,
        },
      ],
      message: 'Resource not accessible by integration',
    },
  ],
  data: {
    repository: {
      pullRequest: {
        id: 'properties have been removed',
        commits: {
          totalCount: 11,
          nodes: [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          pageInfo: {
            endCursor: 'MTE',
            hasNextPage: false,
          },
        },
        reviews: {
          totalCount: 117,
          nodes: [
            {
              id: 'PRR_234',
              commit: null,
              author: {},
              state: 'COMMENTED',
              submittedAt: '2022-04-19T04:33:08Z',
              updatedAt: '2022-04-19T04:33:08Z',
              url: 'https://github.com/bob/Bob-Backend/pull/9988#pullrequestreview-945046107',
            },
            {
              id: 'PRR_432',
              commit: null,
              author: {},
              state: 'COMMENTED',
              submittedAt: '2022-04-19T04:33:09Z',
              updatedAt: '2022-04-19T04:33:09Z',
              url: 'https://github.com/bob/Bob-Backend/pull/9988#pullrequestreview-945046115',
            },
            {
              id: 'additional nodes were removed',
            },
          ],
          pageInfo: {
            endCursor: 'asdf==',
            hasNextPage: true,
          },
        },
        labels: {
          totalCount: 0,
          nodes: [],
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    },
    rateLimit: {
      limit: 12500,
      cost: 1,
      remaining: 11755,
      resetAt: '2022-04-28T03:05:49Z',
    },
  },
  queryString: '\n query (\n $pullRequestNumber: Int!\n $repoName: String!\n $repoOwner: String!\n $maxLimit: Int!\n $commitsCursor: String\n $reviewsCursor: String\n $labelsCursor: String\n ) {\n repository(name: $repoName, owner: $repoOwner) {\n pullRequest(number: $pullRequestNumber) {\n ...\n on PullRequest {\n additions\n author {\n ...on User {\n name\n login\n }\n }\n authorAssociation\n baseRefName\n baseRefOid\n baseRepository {\n name\n url\n owner {\n ...on RepositoryOwner {\n login\n id\n url\n }\n }\n }\n body\n changedFiles\n checksUrl\n closed\n closedAt\n # comments # Maybe someday\n createdAt\n databaseId\n deletions\n editor {\n ...on User {\n login\n name\n isSiteAdmin\n company\n createdAt\n databaseId\n email\n isEmployee\n location\n updatedAt\n url\n websiteUrl\n }\n }\n # files # Maybe someday\n headRefName\n headRefOid\n headRepository {\n name\n owner {\n ...on RepositoryOwner {\n login\n id\n url\n }\n }\n }\n id\n isDraft\n lastEditedAt\n locked\n mergeCommit {\n ...on Commit {\n id\n oid\n message\n authoredDate\n changedFiles\n commitUrl\n author {\n date\n user {\n login # this used to be ...userFields\n }\n }\n }\n }\n mergeable\n merged\n mergedAt\n mergedBy {\n ...on User {\n name\n login\n }\n }\n number\n permalink\n publishedAt\n reviewDecision\n # reviewRequests # Maybe someday\n state\n # suggestedReviewers # Maybe someday\n title\n updatedAt\n url\n }\n \n commits(first: $maxLimit, after: $commitsCursor) {\n totalCount\n nodes {\n commit {\n ...on Commit {\n id\n oid\n message\n authoredDate\n changedFiles\n commitUrl\n author {\n date\n user {\n login # this used to be ...userFields\n }\n }\n }\n }\n }\n \n pageInfo {\n endCursor\n hasNextPage\n }\n }\n \n reviews(first: $maxLimit, after: $reviewsCursor) {\n totalCount\n nodes {\n ...on PullRequestReview {\n id\n commit {\n oid\n }\n author {\n ...on User {\n name\n login\n }\n }\n state\n submittedAt\n updatedAt\n url\n }\n }\n pageInfo {\n endCursor\n hasNextPage\n }\n }\n \n labels(first: $maxLimit, after: $labelsCursor) {\n totalCount\n nodes {\n id\n name\n }\n pageInfo {\n endCursor\n hasNextPage\n }\n } \n }\n }\n ...on Query {\n rateLimit {\n limit\n cost\n remaining\n resetAt\n }\n }\n }',
  queryVariables: {
    pullRequestNumber: 9988,
    repoName: 'asdf-Backend',
    repoOwner: 'bob',
    maxLimit: 100,
  },
}
```

2. Caused by bad token or expired token. Error type: HttpError, not
   GraphqlResponseError

```json
{
  "message": "Bad credentials",
  "documentation_url": "https://docs.github.com/graphql"
}
```

3. Caused by the GitHub API running into an issue. Could be query is pulling
   back too many nodes and timesout.

```
Error: iteratePullRequests: GraphQL errors (1), first: {"message":"Something went wrong while executing your query. This may be the result of a timeout, or it could be a GitHub bug. Please include `9E12:6C93:1987D3B:2F6FFCF:6238E3EE` when reporting this issue."}
```

---

## The errors below may not be valid. Please see above

1. INVALID: Caused when querying for an org that doesn't exist\*\*
   \*\*OrganizationQuery.ts Note: the "data" portion of the error/response is
   not included. The GraphQL project must not include it. `error.errors` is what
   is given to the catch statement

```json
{
  "errors": [
    {
      "type": "NOT_FOUND",
      "path": ["organization"],
      "locations": [
        {
          "line": 2,
          "column": 2
        }
      ],
      "message": "Could not resolve to an Organization with the login of 'j1-ingesst'."
    }
  ]
}
```

3. INVALID: Caused by invalid field in query - no `type` is provided
   `error.errors` is what is given to the catch statement

```json5
{
  errors: [
    {
      path: [
        'query',
        'repository',
        'pullRequest',
        'commits',
        'nodes',
        'commit',
        'asdf', // This caused 1st error
      ],
      extensions: {
        code: 'undefinedField',
        typeName: 'Commit',
        fieldName: 'asdf',
      },
      locations: [
        {
          line: 19,
          column: 7,
        },
      ],
      message: "Field 'asdf' doesn't exist on type 'Commit'",
    },
    {
      path: [
        'query',
        'repository',
        'pullRequest',
        'reviews',
        'nodes',
        'asdf', // This caused 2nd error
      ],
      extensions: {
        code: 'undefinedField',
        typeName: 'PullRequestReview',
        fieldName: 'asdf',
      },
      locations: [
        {
          line: 33,
          column: 6,
        },
      ],
      message: "Field 'asdf' doesn't exist on type 'PullRequestReview'",
    },
  ],
}
```

4. INVALID: Caused by querying for a resource that doesn't exist. See message

```
    [
  {
    "type": "NOT_FOUND",
    "path": [
      "repository",
      "pullRequest"
    ],
    "locations": [
      {
        "line": 12,
        "column": 13
      }
    ],
    "message": "Could not resolve to a PullRequest with the number of 67."
  }
]
```

5. INVALID: Caused by not having access to a resource

```
[
  {
    "type": "FORBIDDEN",
    "path": [
      "repository",
      "collaborators"
    ],
    "extensions": {
      "saml_failure": false
    },
    "locations": [
      {
        "line": 4,
        "column": 5
      }
    ],
    "message": "Resource not accessible by integration"
  }
]
```

6. unknown cause Update: appears this was not being handled appropriately by the
   graphql.js project.

```
SyntaxError: Unexpected end of JSON input
at JSON.parse (<anonymous>)
at IncomingMessage.<anonymous> (/opt/jupiterone/app/node_modules/graphql.js/graphql.js:73:25)
at IncomingMessage.emit (events.js:387:35)
```
