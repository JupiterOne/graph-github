import {
  BaseQueryState,
  BranchProtectionRuleAllowancesResponse,
  BuildQuery,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import { allowancesFields, processActors } from './shared';

type QueryState = BaseQueryState;

export type QueryParams = {
  branchProtectionRuleIds: string[];
  gheServerVersion?: string;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
      query (
        $branchProtectionRuleIds: [ID!]!
        $maxLimit: Int!
      ) {
          nodes(ids: $branchProtectionRuleIds) {
            ...on BranchProtectionRule {
              id
              ${allowancesFields(queryParams.gheServerVersion)}
            }
          }
          ...${fragments.rateLimit}
      }
  `;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      branchProtectionRuleIds: queryParams.branchProtectionRuleIds,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  BranchProtectionRuleAllowancesResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const branchProtectionRules = responseData.nodes ?? [];

  for (const rule of branchProtectionRules) {
    if (!utils.hasProperties(rule)) {
      continue;
    }

    await iteratee({
      branchProtectionRuleId: rule.id,
      bypassForcePushAllowances: processActors(
        rule.bypassForcePushAllowances?.nodes,
      ),
      bypassPullRequestAllowances: processActors(
        rule.bypassPullRequestAllowances?.nodes,
      ),
      pushAllowances: processActors(rule.pushAllowances?.nodes),
      reviewDismissalAllowances: processActors(
        rule.reviewDismissalAllowances?.nodes,
      ),
    });
  }

  return {
    rateLimit,
  };
};

const iterateBranchProtectionRulesAllowances = async (
  queryParams: QueryParams,
  execute,
  iteratee,
) => {
  let queryState: QueryState = {};
  const executable = buildQuery(queryParams, queryState);
  const response = await execute(executable);
  queryState = await processResponseData(response, iteratee);

  const queryCost = queryState?.rateLimit?.cost ?? 0;

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iterateBranchProtectionRulesAllowances };
