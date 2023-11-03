// Note that the spread-like syntax below ultimately references fragments.ts via a function
// built-in to graphql.js. (For another example of how that works, see
// https://www.apollographql.com/docs/react/data/fragments/ ).
//
// The actual GraphQL query that hits the API will have substituted in the parameters
// and expanded the fragments.

export default {
  organizationFields: `on Organization {
    login
    name
    createdAt
    updatedAt
    description
    email
    databaseId
    isVerified
    location
    websiteUrl
    url
  }`,
  userEdgeFields: `on OrganizationMemberEdge {
    hasTwoFactorEnabled
    role
  }`,
  userFields: `on User {
    login
    name
    isSiteAdmin
    company
    createdAt
    databaseId
    email
    isEmployee
    location
    updatedAt
    url
    websiteUrl
  }`,
  teamFields: `on Team {
    name
    url
    slug
    createdAt
    updatedAt
    databaseId
    description
    privacy
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
    autoMergeAllowed
    databaseId
    deleteBranchOnMerge
    description
    forkCount
    forkingAllowed
    homepageUrl
    isDisabled
    isEmpty
    isFork
    isInOrganization
    isLocked
    isMirror
    isSecurityPolicyEnabled
    isTemplate
    isUserConfigurationRepository
    lockReason
    mergeCommitAllowed
    pushedAt
    rebaseMergeAllowed
    url
    visibility
    branchProtectionRules {
      totalCount
    }
    collaborators {
      totalCount
    }
    vulnerabilityAlerts {
      totalCount
    }
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
    oid
    message
    authoredDate
    author {
      user {
        login # this used to be ...userFields
      }
    }
  }`,
  associatedPullRequest: `
    associatedPullRequests(first: 1) {
      nodes {
        id
        number
        state
        reviewDecision
        url
      }
    }`,
  reviewFields: `on PullRequestReview {
    commit {
      oid
    }
    author {
      ...on User {
          name
          login
        }
    }
    state
  }`,
  privateRepoPRReviewFields: `on PullRequestReview {
    id
    author {
      ...on User {
          name
          login
        }
    }
    state
    submittedAt
    updatedAt
    url
  }`,
  pullRequestFields: `on PullRequest {
    additions
    author {
      ...on User {
        name
        login
      }
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
    databaseId
    deletions
    editor {
      ...userFields
    }
    # files # Maybe someday
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
      ...teamMemberFields # this used to be ...userFields
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
  privateRepoPullRequestFields: `on PullRequest {
    additions
    author {
      ...teamMemberFields # this used to be ...userFields
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
    databaseId
    deletions
    editor {
      ...userFields
    }
    # files # Maybe someday
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
    mergeable
    merged
    mergedAt
    mergedBy {
      ...teamMemberFields # this used to be ...userFields
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
  issueFields: `on Issue {
    id
    activeLockReason
    author {
      ...on User {
        name
        login
      }
    }
    authorAssociation
    body
    # bodyHTML
    # bodyResourcePath
    bodyText
    bodyUrl
    closed # boolean
    closedAt
    # comments # probably a child object if we want these
    createdAt
    createdViaEmail # boolean
    databaseId
    isPinned # boolean
    lastEditedAt
    locked # boolean
    # milestone # a Milestone object, could put the fields in-line like author
    number
    # participants # Participants objects
    # projectCards # ProjectCardConnection!
    publishedAt
    # reactionGroups # : [ReactionGroup!]
    resourcePath
    state
    title
    titleHTML
    updatedAt
    url
  }`,
};
