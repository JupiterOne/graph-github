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
  repositoryOwnerFields: `on RepositoryOwner {
    login
    id
    url
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
      url
      owner {
        ...repositoryOwnerFields
      }
    }
    body
    changedFiles
    checksUrl
    closed
    closedAt
    # comments  # Maybe someday
    createdAt
    deletions
    editor {
      ...userFields
    }
    # files  # Maybe someday
    headRefName
    headRefOid
    headRepository {
      name
      owner {
        ...repositoryOwnerFields
      }
    }
    id
    isDraft
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
    # reviewRequests  # Maybe someday
    state
    # suggestedReviewers  # Maybe someday
    title
    updatedAt
    url
  }`,
};
