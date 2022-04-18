import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import { OrgQueryResponse, RateLimitStepSummary } from '../types';

const buildQuery = (login: string): ExecutableQuery => {
  const query = `
    query ($login: String!) {
      organization(login: $login) {
        id
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
      }
      ...rateLimit
    }`;

  return {
    query,
    queryVariables: {
      login,
    },
  };
};

export type OrganizationResults = {
  rateLimit: RateLimitStepSummary;
  organization: OrgQueryResponse;
};

const processResponseData = (responseData): OrganizationResults => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  const rateLimit = responseData.rateLimit;
  const organization = responseData.organization;

  return {
    rateLimit: {
      ...rateLimit,
      totalCost: rateLimit?.cost ?? 0,
    },
    organization,
  };
};

/**
 * Fetches organization associated with the provided login.
 * @param login - aka organization
 * @param execute
 */
const fetchOrganization = async (
  login: string,
  execute: QueryExecutor,
): Promise<OrganizationResults> => {
  const executable = buildQuery(login);
  const response = await execute(executable);

  return processResponseData(response);
};

export default { fetchOrganization };
