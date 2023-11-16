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
} from './shared';

type QueryState = BaseQueryState;

export type QueryParams = {
  repoIds: string[];
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
        $repoIds: [ID!]!
        $maxLimit: Int!
      ) {
          nodes(ids: $repoIds) {
            ...on Repository {
              id
              name
              branchProtectionRules(first: $maxLimit) {
                nodes {
                  ${branchProtectionRuleFields(versionSafeFragments)}
                }
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
      repoIds: queryParams.repoIds,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  BranchProtectionRuleResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const repositories = responseData.nodes ?? [];

  for (const repository of repositories) {
    const rules = repository.branchProtectionRules.nodes ?? [];
    for (const rule of rules) {
      if (!utils.hasProperties(rule)) {
        continue;
      }

      const processedRule = {
        repoId: repository.id,
        repoName: repository.name,
        ...rule,
        // bypassForcePushAllowances: processActors(
        //   rule.bypassForcePushAllowances?.nodes,
        // ),
        // bypassPullRequestAllowances: processActors(
        //   rule.bypassPullRequestAllowances?.nodes,
        // ),
        // pushAllowances: processActors(rule.pushAllowances?.nodes),
        // reviewDismissalAllowances: processActors(
        //   rule.reviewDismissalAllowances?.nodes,
        // ),
      };

      await iteratee(processedRule);
    }
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
