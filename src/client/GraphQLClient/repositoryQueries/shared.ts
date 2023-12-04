export const teamReposFields = `
  edges {
    node {
      id
    }
    ...on TeamRepositoryEdge {
      permission
    }
  }
`;
