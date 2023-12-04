import fragments from '../fragments';

export const pullRequestFields = (isPublicRepo: boolean) => `
  author {
    ...${fragments.teamMemberFields}
  }
  baseRefName
  baseRefOid
  baseRepository {
    id
    name
    owner {
      ...on RepositoryOwner {
        login
      }
    }
    isPrivate
  }
  body
  changedFiles
  createdAt
  databaseId
  headRefName
  headRefOid
  headRepository {
    name
    owner {
      ...on RepositoryOwner {
        login
      }
    }
  }
  id
  ${
    isPublicRepo
      ? `mergeCommit {
            ...on Commit {
              commitUrl
              oid
            }
            associatedPullRequests(first: 1) {
              nodes {
                id
                number
              }
            }
          }`
      : ''
  }
  merged
  mergedAt
  mergedBy {
    ...${fragments.teamMemberFields}
  }
  number
  reviewDecision
  state
  title
  updatedAt
  url
  commits {
    totalCount
  }
  labels {
    totalCount
  }
  reviews {
    totalCount
  }
`;
