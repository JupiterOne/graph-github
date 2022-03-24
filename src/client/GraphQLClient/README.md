## Creating GraphQL Queries

When creating a new query, consider the query as a new domain being added to the
project. To prevent needing to setup a new GitHub organization that has test
data, contact samuel.poulton@jupiterone.com to gain access to a test GitHub org.

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
