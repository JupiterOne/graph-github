## Updating the GitHub integration pagination and cursor handling logic

## Background

The GitHub integration relies almost completely on GraphQL, an API format where
the request POSTs a string that contains a JSON-like data structure
representation to tell the server the exact nested objects and properties
wanted. In the happy path, the server returns only the data requested, in the
format requested.

Pagination in GraphQL can be complex, because cursors exist at multiple levels
of the hierarchy of returned objects. For example, a top-level object could have
multiple child objects, which may have different numbers of pages required to
retrieve.

The J1-GitHub integration currently uses a recursive function called
`extractSelectedResourceFromData` (in `response.ts`) to scan the raw response
from the GraphQL API for the pagination cursors and desired data. This function
uses a data structure called the `resourceMetadataMap` to understand where data
is expected to be found in the structure of the GraphQL response.

## What is working?

Everything works properly today, thanks to several brittle hacks have been
introduced to overcome incorrect assumptions in the initial system design (see
below).

The function `extractSelectedResourceFromData` returns `resources` and
`cursors`.

The format and content of the returned `resources` is just fine today, and the
rest of the code works well with it, so we wouldn't want to change that output
when we change the code path.

The format and content of `cursors` is also fine for queries that go upto 2
levels of nested resources (eg. Organization has Repositories, or a Repository
has Collaborators). But if you go deeper (eg. Organization has Repositories
which have Pull Requests which have Labels...) the cursors break (see below).

## What is broken?

Some key initial assumptions that turned out not to be true:

- We thought that a given object type would always have only one type of parent.
  In truth, a child object such as `Labels` might turn up under multiple
  parents, such as `PullRequests` and `Issues`
  (https://github.com/JupiterOne/graph-github/blob/9b3d371e377012e68040f5322deed5f0fb54cffe/src/client/GraphQLClient/client.ts#L373)

- We thought that the name of an object would also be the unique name of the
  property containing those objects in the GraphQL response. In truth,
  `Repositories` might come back in a property called `repositories`, or
  `teamRepositories`, depending on the query context
  (https://github.com/JupiterOne/graph-github/blob/9b3d371e377012e68040f5322deed5f0fb54cffe/src/client/GraphQLClient/resourceMetadataMap.ts#L99)

- We thought that queries could be dynamically assembled because we would always
  want all the properties of each entity in the query. That turned out not to be
  true in pulling, say, team members under teams, where we don't need all the
  user properties since we already got them in a previous step.

- We thought that all queries would use the structure where an object has
  `edges`, which have `nodes`, which have the child entities. However, not all
  queries are best constructed that way
  (https://github.com/JupiterOne/graph-github/blob/9b3d371e377012e68040f5322deed5f0fb54cffe/src/client/GraphQLClient/queries.ts#L336).
  The cursor and pagination handler expecting it meant that a hack had to be
  introduced to retrofit a response that did not conform
  (https://github.com/JupiterOne/graph-github/blob/9b3d371e377012e68040f5322deed5f0fb54cffe/src/client/GraphQLClient/response.ts#L143)

The recursion in the function has also made it hard to troubleshoot and write
thorough unit tests. On multiple occasions, we have found bugs even though all
tests were passing, and we have been unable to elegantly update the recursive
function, resulting in the above hacks.

We have also discovered that the current code breaks when child entities are
nested more than two layers deep. So far, we have been able to arrange queries
to avoid more than two layers, but one hotly requested feature, ingesting
dependency graph data, will require a query three layers deep. We don't know how
to fix the current system to allow that.

Lastly, the whole concept of `resourceMetadataMap` makes the logic brittle. We
have to anticipate all possible data structures for the queries we use, and code
them into this unique logic structure that has a non-trivial learning curve.

## Long term objectives for the code

- The pagination is rock solid across all GitHub GraphQL APIs
- The code is easy to understand (ideally as simple as possible!)
- The code is unit tested
- The code is integration tested with recordings

## A graceful transition

Because changing the pagination logic has the potential to severely break this
integration, we'll start by coding an alternate code path that processes the raw
GraphQL response and then compares the `resources` and `cursors` produced to
those made today by `extractSelectedResourceFromData`. This happens in the
function `processGraphQlPageResult` in `response.ts`. All GraphQL API calls go
through that function currently.

Since everything is working properly today (to our knowledge) for many, many
customers, the output `resources` and `cursors` should be the same from the new
code path. We can let this soak in the field for an extended period, logging any
discrepancies, to make sure that the new code doesn't break anything.

Once that is certain, we can change the production codepath to use the new code,
and rip out all the old.

## What should the new response processor look like?

- It should return the same `resources` output as the old code
- It should be able to return appropriately formatted cursors to an arbitrary
  depth level
- The cursors up to depth 2 (ie. all current queries) should look the same as
  the old code
- It should take the actual GraphQL query as input, and read the query to
  understand the structure of the response
- It should be able to handle the variations of query structure currently
  present in `queries.ts`
- It should NOT need to use `resourceMetadataMap` or anything like it

The major point here, aside from not breaking things, is to use the query we are
sending to understand the response we are getting. The whole point of GraphQL is
that we can customize what we ask for, and get what we asked for, and we are not
leveraging that power today.

## Other thoughts

We are using a generic GraphQL client (`graphql.js`). GitHub does have their own
GraphQL client library now (it didn't exist during the inital dev on this
integration). It is https://github.com/octokit/graphql.js/

However, we haven't experimented with it at all, and changing would mean
changing quite a bit of client code, rate limiting code, and error handling
code. It would probably be for the better (perhaps natively understanding GH's
rate limiting, for example), but it would complicate the change.

It may also not be relevant. After all, our problem happens after we get the
response and we struggle to parse it properly - both in terms of cursors and the
resources themselves. Though the Octokit may (or may not) have some convenient
built-in multi-level GraphQL pagination logic, the data resources would probably
be returned in the same way (assuming both the generic client and the Octokit
client follow GraphQL standards).
