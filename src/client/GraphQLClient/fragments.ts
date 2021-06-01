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
  }`
};
