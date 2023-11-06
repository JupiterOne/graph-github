export const issuesTotalCountFragment = (lastSuccessfulExecution: string) => `
  issues(filterBy: { since: "${lastSuccessfulExecution}" }) {
    totalCount
  }
`;
