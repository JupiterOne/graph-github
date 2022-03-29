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

1. Caused when querying for an org that doesn't exist\*\*
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

2. Caused by bad token or expired token

```json
{
  "message": "Bad credentials",
  "documentation_url": "https://docs.github.com/graphql"
}
```

3. Caused by invalid field in query - no `type` is provided `error.errors` is
   what is given to the catch statement

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

4. Caused by querying for a resource that doesn't exist. See message

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

5. Caused by not having access to a resource

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

6. unknown cause

```
SyntaxError: Unexpected end of JSON input
at JSON.parse (<anonymous>)
at IncomingMessage.<anonymous> (/opt/jupiterone/app/node_modules/graphql.js/graphql.js:73:25)
at IncomingMessage.emit (events.js:387:35)
```

7. Caused by the fetch-account failing

```
Error: Expected to find Account entity in jobState.
at Object.fetchPrs [as executionHandler] (/opt/jupiterone/app/node_modules/@jupiterone/graph-github/dist/steps/pullRequests.js:21:15)
at async executeStep (/opt/jupiterone/app/node_modules/@jupiterone/integration-sdk-runtime/dist/src/execution/dependencyGraph.js:212:21)
at async timeOperation (/opt/jupiterone/app/node_modules/@jupiterone/integration-sdk-runtime/dist/src/metrics/index.js:6:12)
at async run (/opt/jupiterone/app/node_modules/p-queue/dist/index.js:163:29)
```

8. Caused by the GitHub API running into an issue. Could be query is pulling
   back too many nodes and timesout.

```
Error: iteratePullRequests: GraphQL errors (1), first: {"message":"Something went wrong while executing your query. This may be the result of a timeout, or it could be a GitHub bug. Please include `9E12:6C93:1987D3B:2F6FFCF:6238E3EE` when reporting this issue."}
```
