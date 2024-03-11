export const issuesTotalCountFragment = (issuesSinceDate: string) => `
  issues(filterBy: { since: "${issuesSinceDate}" }) {
    totalCount
  }
`;
