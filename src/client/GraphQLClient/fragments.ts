export default {
  organizationFields: `on Organization {
    login
    name
  }`,
  userEdgeFields: `on OrganizationMemberEdge {
    hasTwoFactorEnabled
    role
  }`,
  userFields: `on User {
    login
    name
    isSiteAdmin
  }`,
  teamFields: `on Team {
    name
    url
    slug
  }`,
  teamMemberEdgeFields: `on TeamMemberEdge {
    role
  }`,
  teamMemberFields: `on User {
    name
    login
  }`,
  repositoryFields: `on Repository {
    name
    nameWithOwner
    url
    isPrivate
    isArchived
    createdAt
    updatedAt
  }`,
  teamRepositoryEdgeFields: `on TeamRepositoryEdge {
    permission
  }`,
  rateLimit: `on Query {
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }`,
  commitFields: `on Commit {
    id
    oid
    message
    authoredDate
    changedFiles
    commitUrl
    author {
      date
      user {
        ...userFields
      }
    }
  }`,
  reviewFields: `on PullRequestReview {
    id
    commit {
      oid
    }
    author {
      ...userFields
    }
    state
    submittedAt
    updatedAt
    url
  }`,
  pullRequestFields: `on PullRequest {
    additions
    author {
      ...userFields
    }
    authorAssociation
    baseRefName
    baseRefOid
    baseRepository {
      name
      owner {
        ...userFields
      }
    }
    body
    changedFiles
    checksUrl
    closed
    closedAt
    # comments(first: 100) {  # Might be nice to know who is commenting
    # commits(first: 100) {  # Handling in the query builder
    createdAt
    deletions
    editor {
      ...userFields
    }
    # files(first: 100) {  # Someday it would be great to connect PRs to files that create infrastructure
    headRefName
    headRefOid
    headRepository {
      name
      owner {
        ...userFields
      }
    }
    id
    isDraft
    # labels(first 100) {  # Handling in the query builder
    lastEditedAt
    locked
    mergeCommit {
      ...commitFields
    }
    mergeable
    merged
    mergedAt
    mergedBy {
      ...userFields
    }
    number
    permalink
    publishedAt
    reviewDecision
    # reviewRequests(first: 100) {  # Someday it would be nice to see how many users reviewed that were requested
    # reviews(first: 100) {  # Handling in the query builder
    state
    # suggestedReviewers  # Might be fun to know if the suggested reviewers were used or not
    title
    updatedAt
    url
  }`,
};
