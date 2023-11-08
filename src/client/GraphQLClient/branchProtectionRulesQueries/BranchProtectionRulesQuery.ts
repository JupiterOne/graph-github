import {
  BaseQueryState,
  BranchProtectionRuleResponse,
  BuildQuery,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import {
  branchProtectionRuleFields,
  buildVersionSafeFragments,
  processActors,
} from './shared';

interface QueryState extends BaseQueryState {
  isInitialQuery?: boolean;
}

export type QueryParams = {
  repoName: string;
  repoOwner: string;
  gheServerVersion?: string;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const versionSafeFragments = buildVersionSafeFragments(
    queryParams.gheServerVersion,
  );

  const query = `
      query (
        $repoName: String!
        $repoOwner: String!
        $maxLimit: Int!
      ) {
          repository(name: $repoName, owner: $repoOwner) {
            id
            name
            branchProtectionRules(first: $maxLimit) {
              nodes {
                ${branchProtectionRuleFields(versionSafeFragments)}
              }
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
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  BranchProtectionRuleResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const rules = responseData.repository?.branchProtectionRules.nodes ?? [];

  for (const rule of rules) {
    if (!utils.hasProperties(rule)) {
      continue;
    }

    const processedRule = {
      repoId: responseData.repository.id,
      repoName: responseData.repository.name,
      ...rule,
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
    };

    await iteratee(processedRule);
  }

  return {
    rateLimit,
  };
};

const iterateBranchProtectionRules = async (
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

export default { iterateBranchProtectionRules };
