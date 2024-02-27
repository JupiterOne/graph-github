import {
  createDirectRelationship,
  Entity,
  IntegrationLogger,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { BranchProtectionRuleEntity, IdEntityMap, RepoData } from '../types';
import {
  BRANCH_PROTECTION_RULE_TOTAL_BY_REPO,
  GITHUB_APP_BY_APP_ID,
  GITHUB_REPO_TAGS_ARRAY,
  GithubEntities,
  IngestionSources,
  Relationships,
  Steps,
} from '../constants';
import { getTeamEntityKey, toBranchProtectionEntity } from '../sync/converters';
import {
  BranchProtectionRuleAllowancesResponse,
  BranchProtectionRuleResponse,
  getOrCreateGraphqlClient,
  GithubGraphqlClient,
} from '../client/GraphQLClient';
import { withBatching } from '../client/GraphQLClient/batchUtils';

const POLICIES_PROCESSING_BATCH_SIZE = 500;

export async function fetchBranchProtectionRule({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const graphqlClient = getOrCreateGraphqlClient(config, logger);
  const orgLogin = await graphqlClient.getOrganizationLogin();

  const repoTags = await jobState.getData<Map<string, RepoData>>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  const branchProtectionRuleTotalByRepo: Map<string, number> | undefined =
    await jobState.getData(BRANCH_PROTECTION_RULE_TOTAL_BY_REPO);
  if (!branchProtectionRuleTotalByRepo) {
    return;
  }

  const policiesMap = new Map<string, BranchProtectionRuleResponse>();
  const allowancesTotalByPolicy = new Map<string, number>();

  const processRawPolicies = async () => {
    const allowancesByPolicy = await fetchAllowances({
      graphqlClient,
      allowancesTotalByPolicy,
      logger,
    });
    await Promise.all(
      Array.from(policiesMap.values()).map((branchProtectionRule) => {
        return processPolicy({
          jobState,
          config,
          orgLogin,
          logger,
          branchProtectionRule,
          allowances: allowancesByPolicy.get(branchProtectionRule.id),
        });
      }),
    );
  };

  const iteratee = async (
    branchProtectionRule: BranchProtectionRuleResponse,
  ) => {
    policiesMap.set(branchProtectionRule.id, branchProtectionRule);
    const allowances = [
      'bypassForcePushAllowances',
      'bypassPullRequestAllowances',
      'pushAllowances',
      'reviewDismissalAllowances',
    ];
    for (const allowance of allowances) {
      const currentTotal =
        allowancesTotalByPolicy.get(branchProtectionRule.id) ?? 0;
      allowancesTotalByPolicy.set(
        branchProtectionRule.id,
        currentTotal + (branchProtectionRule[allowance]?.totalCount ?? 0),
      );
    }

    if (policiesMap.size >= POLICIES_PROCESSING_BATCH_SIZE) {
      await processRawPolicies();
      policiesMap.clear();
      allowancesTotalByPolicy.clear();
    }
  };

  await withBatching({
    totalConnectionsById: branchProtectionRuleTotalByRepo,
    threshold: 100,
    batchCb: async (repoKeys) => {
      await graphqlClient.iterateBranchProtectionRules(repoKeys, iteratee);
    },
    singleCb: async (repoKey) => {
      const repoData = repoTags.get(repoKey);
      if (!repoData) {
        return;
      }
      await graphqlClient.iterateBranchProtectionRules(repoData.name, iteratee);
    },
    logger,
  });

  // flush, process remaining policies
  if (policiesMap.size) {
    await processRawPolicies();
    policiesMap.clear();
    allowancesTotalByPolicy.clear();
  }

  await jobState.deleteData(BRANCH_PROTECTION_RULE_TOTAL_BY_REPO);
}

const fetchAllowances = async ({
  graphqlClient,
  allowancesTotalByPolicy,
  logger,
}: {
  graphqlClient: GithubGraphqlClient;
  allowancesTotalByPolicy: Map<string, number>;
  logger: IntegrationLogger;
}) => {
  const allowancesMap = new Map<
    string,
    BranchProtectionRuleAllowancesResponse
  >();

  const iteratee = (allowances: BranchProtectionRuleAllowancesResponse) => {
    allowancesMap.set(allowances.branchProtectionRuleId, allowances);
  };

  await withBatching({
    totalConnectionsById: allowancesTotalByPolicy,
    threshold: 100,
    batchCb: async (branchProtectionRuleIds) => {
      await graphqlClient.iteratePolicyAllowances(
        branchProtectionRuleIds,
        iteratee,
      );
    },
    singleCb: async (branchProtectionRuleId) => {
      await graphqlClient.iteratePolicyAllowances(
        [branchProtectionRuleId],
        iteratee,
      );
    },
    logger,
  });

  return allowancesMap;
};

async function processPolicy({
  jobState,
  orgLogin,
  config,
  logger,
  branchProtectionRule,
  allowances,
}: {
  jobState: JobState;
  orgLogin: string;
  config: IntegrationConfig;
  logger: IntegrationLogger;
  branchProtectionRule: BranchProtectionRuleResponse;
  allowances?: BranchProtectionRuleAllowancesResponse;
}) {
  const branchProtectionRuleEntity = (await jobState.addEntity(
    toBranchProtectionEntity(
      branchProtectionRule,
      config.githubApiBaseUrl,
      orgLogin,
      allowances,
    ),
  )) as BranchProtectionRuleEntity;

  if (branchProtectionRule.repoId) {
    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        fromType: GithubEntities.GITHUB_REPO._type,
        toType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
        fromKey: branchProtectionRule.repoId,
        toKey: branchProtectionRuleEntity._key,
      }),
    );
  }

  if (Array.isArray(allowances?.bypassPullRequestAllowances?.users)) {
    await Promise.all(
      (allowances?.bypassPullRequestAllowances?.users ?? []).map(
        async (user) => {
          if (jobState.hasKey(user.id)) {
            await jobState.addRelationship(
              createDirectRelationship({
                _class: RelationshipClass.OVERRIDES,
                fromType: GithubEntities.GITHUB_MEMBER._type,
                fromKey: user.id,
                toType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
                toKey: branchProtectionRuleEntity._key,
                properties: {
                  bypassPullRequestAllowance: true,
                },
              }),
            );
          } else {
            logger.warn(
              { user },
              'Failed to find user for bypassPullRequestAllowances',
            );
          }
        },
      ),
    );
  }

  if (Array.isArray(allowances?.bypassPullRequestAllowances?.teams)) {
    await Promise.all(
      (allowances?.bypassPullRequestAllowances.teams ?? []).map(
        async (team) => {
          const teamEntityKey = getTeamEntityKey(team.id);

          if (jobState.hasKey(teamEntityKey)) {
            await jobState.addRelationship(
              createDirectRelationship({
                _class: RelationshipClass.OVERRIDES,
                fromType: GithubEntities.GITHUB_TEAM._type,
                fromKey: teamEntityKey,
                toType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
                toKey: branchProtectionRuleEntity._key,
                properties: {
                  bypassPullRequestAllowance: true,
                },
              }),
            );
          } else {
            logger.warn(
              { team },
              'Failed to find team entity for bypassPullRequestAllowances.',
            );
          }
        },
      ),
    );
  }

  if (Array.isArray(allowances?.bypassPullRequestAllowances?.apps)) {
    const appsById =
      await jobState.getData<IdEntityMap<Entity['_key']>>(GITHUB_APP_BY_APP_ID);
    if (appsById) {
      await Promise.all(
        (allowances?.bypassPullRequestAllowances.apps ?? []).map(
          async (app) => {
            if (appsById.has(`${app.databaseId}`)) {
              const appEntityKey = appsById.get(`${app.databaseId}`) as string;
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.OVERRIDES,
                  fromType: GithubEntities.GITHUB_APP._type,
                  fromKey: appEntityKey,
                  toType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
                  toKey: branchProtectionRuleEntity._key,
                  properties: {
                    bypassPullRequestAllowance: true,
                  },
                }),
              );
            } else {
              logger.warn(
                { app },
                'Failed to find by databaseId for bypassPullRequestAllowances.',
              );
            }
          },
        ),
      );
    }
  }
}

export const branchProtectionRulesSteps: IntegrationStep<IntegrationConfig>[] =
  [
    {
      id: Steps.FETCH_BRANCH_PROTECTION_RULES,
      ingestionSourceId: IngestionSources.BRANCH_PROTECTION_RULES,
      name: 'Fetch Branch Protection Rules',
      entities: [GithubEntities.GITHUB_BRANCH_PROTECTION_RULE],
      relationships: [
        Relationships.REPO_HAS_BRANCH_PROTECTION_RULE,
        Relationships.USER_OVERRIDES_BRANCH_PROTECTION_RULE,
        Relationships.TEAM_OVERRIDES_BRANCH_PROTECTION_RULE,
        Relationships.APP_OVERRIDES_BRANCH_PROTECTION_RULE,
      ],
      dependsOn: [
        Steps.FETCH_REPOS,
        Steps.FETCH_USERS,
        Steps.FETCH_TEAMS,
        Steps.FETCH_APPS,
      ],
      executionHandler: fetchBranchProtectionRule,
    },
  ];
